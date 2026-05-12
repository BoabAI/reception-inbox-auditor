/**
 * Cursor storage abstraction.
 *
 * The cursor records the most-recent receivedDateTime we've successfully
 * upserted to SharePoint, so the next poll skips already-processed mail.
 *
 * Two backends — pick via CURSOR_STORE env:
 *  - "file"  (default, dev) — local JSON file at .state/cursor.json
 *  - "table" (prod)         — Azure Table Storage, AAD via managed identity
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DefaultAzureCredential } from "@azure/identity";
import { TableClient, type TableEntity, odata } from "@azure/data-tables";
import { config } from "./config.js";

export interface CursorStore {
  read(mailbox: string): Promise<string | null>;
  write(mailbox: string, lastReceivedIso: string): Promise<void>;
}

// ─── File backend ─────────────────────────────────────────────────
class FileCursor implements CursorStore {
  constructor(private path: string) {}

  async read(_mailbox: string): Promise<string | null> {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as { lastReceivedDateTime?: string };
      return parsed.lastReceivedDateTime ?? null;
    } catch {
      return null;
    }
  }

  async write(_mailbox: string, lastReceivedIso: string): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify({ lastReceivedDateTime: lastReceivedIso }, null, 2));
  }
}

// ─── Azure Table backend ──────────────────────────────────────────
const PARTITION = "reception";

type CursorEntity = TableEntity<{ LastReceivedDateTime: string }>;

class TableCursor implements CursorStore {
  private client: TableClient;

  constructor(storageAccount: string, tableName: string) {
    const url = `https://${storageAccount}.table.core.windows.net`;
    this.client = new TableClient(url, tableName, new DefaultAzureCredential());
  }

  private rowKey(mailbox: string): string {
    // Table row keys can't contain / \ # ? — @ is fine, but encode just in case.
    return mailbox.replace(/[/\\#?]/g, "_");
  }

  async read(mailbox: string): Promise<string | null> {
    try {
      const e = await this.client.getEntity<CursorEntity>(PARTITION, this.rowKey(mailbox));
      return e.LastReceivedDateTime ?? null;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) return null;
      throw err;
    }
  }

  async write(mailbox: string, lastReceivedIso: string): Promise<void> {
    await this.ensureTable();
    await this.client.upsertEntity<CursorEntity>(
      {
        partitionKey: PARTITION,
        rowKey: this.rowKey(mailbox),
        LastReceivedDateTime: lastReceivedIso,
      },
      "Replace",
    );
  }

  private tableEnsured = false;
  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await this.client.createTable();
    } catch (err) {
      const code = (err as { details?: { errorCode?: string } }).details?.errorCode;
      if (code !== "TableAlreadyExists") throw err;
    }
    this.tableEnsured = true;
  }
}

// ─── Factory ──────────────────────────────────────────────────────
let _store: CursorStore | null = null;

export function getCursorStore(): CursorStore {
  if (_store) return _store;
  if (config.cursor.backend === "table") {
    _store = new TableCursor(config.cursor.storageAccount, config.cursor.tableName);
  } else {
    _store = new FileCursor(config.cursor.filePath);
  }
  return _store;
}

// re-export odata for callers that want to extend with queries later
export { odata };
