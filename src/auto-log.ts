#!/usr/bin/env bun
/**
 * Auto-log loop. One pass:
 *   1. Read cursor (last seen receivedDateTime) from .state/cursor.json
 *   2. List inbox messages received >= cursor
 *   3. For each new message: classify with Azure OpenAI, upsert into SharePoint
 *   4. Advance cursor to the most recent receivedDateTime we've seen
 *
 * Designed to be invoked on a cron / loop (e.g. every 60s). The dedup is
 * Internet-Message-Id-based, so re-running is safe.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "./config.ts";
import { listInboxMessages, type MailMessage } from "./graph.ts";
import { classifyEmail } from "./classify.ts";
import { upsertByMessageId } from "./sharepoint.ts";

const CURSOR_PATH = ".state/cursor.json";
const DEFAULT_LOOKBACK_HOURS = 24;

type Cursor = { lastReceivedDateTime: string };

async function loadCursor(): Promise<Cursor> {
  try {
    const raw = await readFile(CURSOR_PATH, "utf8");
    return JSON.parse(raw) as Cursor;
  } catch {
    const fallback = new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 3600_000).toISOString();
    return { lastReceivedDateTime: fallback };
  }
}

async function saveCursor(cursor: Cursor): Promise<void> {
  await mkdir(dirname(CURSOR_PATH), { recursive: true });
  await writeFile(CURSOR_PATH, JSON.stringify(cursor, null, 2));
}

async function processMessage(m: MailMessage): Promise<{ status: "logged" | "skipped"; type: string; category: string; id: string }> {
  const cls = await classifyEmail({ subject: m.subject, from: m.from, body: m.bodyPreview });
  const res = await upsertByMessageId({
    Title: m.subject.slice(0, 250),
    MessageId: m.internetMessageId,
    FromAddress: m.from.slice(0, 250),
    Received: m.receivedDateTime,
    EmailType: cls.type,
    EmailStatus: "New",
    Category: cls.category,
    EmailLinkUrl: m.webLink,
    EmailLinkDescription: "Open in Outlook",
  });
  return { status: res.result === "inserted" ? "logged" : "skipped", type: cls.type, category: cls.category, id: res.id };
}

async function main(): Promise<void> {
  const cursor = await loadCursor();
  console.log(`[auto-log] mailbox=${config.watchedMailbox} since=${cursor.lastReceivedDateTime}`);

  const messages = await listInboxMessages(config.watchedMailbox, { since: cursor.lastReceivedDateTime, top: 50 });
  console.log(`[auto-log] fetched ${messages.length} message(s)`);

  let newest = cursor.lastReceivedDateTime;
  let inserted = 0;
  let skipped = 0;

  // Process oldest -> newest so cursor advances safely if we crash mid-batch.
  for (const m of [...messages].reverse()) {
    try {
      const r = await processMessage(m);
      if (r.status === "logged") inserted++;
      else skipped++;
      console.log(`  ${r.status === "logged" ? "+" : "·"} [${r.type}|${r.category}] ${m.subject.slice(0, 65)} (id=${r.id})`);
    } catch (e) {
      console.error(`  ! failed to process ${m.internetMessageId}: ${(e as Error).message}`);
      // Don't advance cursor past a failure.
      break;
    }
    if (m.receivedDateTime > newest) newest = m.receivedDateTime;
  }

  if (newest !== cursor.lastReceivedDateTime) {
    await saveCursor({ lastReceivedDateTime: newest });
    console.log(`[auto-log] cursor advanced to ${newest}`);
  }
  console.log(`[auto-log] done — inserted=${inserted} skipped=${skipped}`);
}

await main();
