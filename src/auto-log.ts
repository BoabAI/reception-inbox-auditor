#!/usr/bin/env bun
/**
 * Auto-log loop. One pass:
 *   1. Read cursor (last seen receivedDateTime) from the configured CursorStore
 *   2. List inbox messages received >= cursor
 *   3. For each new message: classify with Azure OpenAI, upsert into SharePoint
 *   4. Advance cursor to the most recent receivedDateTime we've seen
 *
 * Designed to be invoked on a cron / loop (locally) or by an Azure Function
 * timer trigger. Dedup is Internet-Message-Id-based, so re-running is safe.
 *
 * Entry points:
 *   - bun run src/auto-log.ts  → runs `runOnce()` once and exits (CLI mode)
 *   - import { runOnce } from "./auto-log" → for Function host & tests
 */
import { config } from "./config.js";
import { listInboxMessages, type MailMessage } from "./graph.js";
import { classifyEmail } from "./classify.js";
import { upsertByMessageId } from "./sharepoint.js";
import { getCursorStore } from "./cursor.js";

const DEFAULT_LOOKBACK_HOURS = 24;

export type RunOptions = {
  /** Override the configured lookback when no cursor exists yet. */
  lookbackHours?: number;
  /** Max messages to fetch per pass. */
  top?: number;
  /** Override the mailbox (defaults to config.watchedMailbox). */
  mailbox?: string;
};

export type RunResult = {
  mailbox: string;
  fetched: number;
  inserted: number;
  skipped: number;
  cursorBefore: string;
  cursorAfter: string;
};

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

export async function runOnce(opts: RunOptions = {}): Promise<RunResult> {
  const mailbox = opts.mailbox ?? config.watchedMailbox;
  const top = opts.top ?? 50;
  const lookbackHours = opts.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
  const store = getCursorStore();

  const cursorBefore =
    (await store.read(mailbox)) ?? new Date(Date.now() - lookbackHours * 3600_000).toISOString();
  console.log(`[auto-log] mailbox=${mailbox} since=${cursorBefore}`);

  const messages = await listInboxMessages(mailbox, { since: cursorBefore, top });
  console.log(`[auto-log] fetched ${messages.length} message(s)`);

  let cursorAfter = cursorBefore;
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
    if (m.receivedDateTime > cursorAfter) cursorAfter = m.receivedDateTime;
  }

  if (cursorAfter !== cursorBefore) {
    await store.write(mailbox, cursorAfter);
    console.log(`[auto-log] cursor advanced to ${cursorAfter}`);
  }
  console.log(`[auto-log] done — inserted=${inserted} skipped=${skipped}`);

  return { mailbox, fetched: messages.length, inserted, skipped, cursorBefore, cursorAfter };
}

// CLI bootstrap. Under Bun this file is invoked via `bun run src/auto-log.ts`
// and Bun.main / import.meta.path are defined. Under Node (Function host) the
// file is imported, not run directly — Bun is undefined and this block is a
// no-op.
declare const Bun: { main?: string } | undefined;

if (typeof Bun !== "undefined" && Bun?.main !== undefined) {
  const meta = import.meta as ImportMeta & { path?: string };
  if (meta.path !== undefined && Bun.main === meta.path) {
    await runOnce();
  }
}
