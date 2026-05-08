/**
 * SharePoint list upsert.
 *
 * Reads use Microsoft Graph (fast, indexed filter on MessageId).
 * Writes shell out to the m365 CLI because Graph doesn't accept Hyperlink
 * column values on classic SharePoint lists — m365 CLI talks SP REST under
 * the hood and handles FieldUrlValue correctly.
 *
 * Idempotent on Internet Message ID: getItemByMessageId looks up an existing
 * row first; we only insert when it returns null.
 */
import { $ } from "bun";
import { graphClient } from "./graph.ts";
import { config } from "./config.ts";

type CachedRefs = { siteId: string; listId: string; webUrl: string };
let refs: CachedRefs | null = null;

async function resolveRefs(): Promise<CachedRefs> {
  if (refs) return refs;
  const client = await graphClient();
  const site = (await client
    .api(`/sites/${config.sp.hostname}:${config.sp.sitePath}`)
    .get()) as { id: string; webUrl: string };
  const lists = (await client.api(`/sites/${site.id}/lists`).get()) as {
    value: Array<{ id: string; displayName: string }>;
  };
  const list = lists.value.find((l) => l.displayName === config.sp.listName);
  if (!list) throw new Error(`List '${config.sp.listName}' not found at ${config.sp.sitePath}`);
  refs = { siteId: site.id, listId: list.id, webUrl: site.webUrl };
  return refs;
}

export type ListItemFields = {
  Title: string;
  MessageId: string;
  FromAddress: string;
  Received: string; // ISO 8601 (UTC)
  EmailType: "Referral" | "Other" | "Unclassified";
  EmailStatus: "New" | "In Progress" | "Action Completed";
  EmailLinkUrl?: string;
  EmailLinkDescription?: string;
};

type GraphItemRef = { id: string; fields: { id: string; MessageId?: string } };

/**
 * Look up a list item by Internet Message ID. Returns null if no match.
 */
export async function getItemByMessageId(messageId: string): Promise<GraphItemRef | null> {
  const { siteId, listId } = await resolveRefs();
  const client = await graphClient();
  const safe = messageId.replace(/'/g, "''");
  const data = (await client
    .api(`/sites/${siteId}/lists/${listId}/items`)
    .expand("fields")
    .filter(`fields/MessageId eq '${safe}'`)
    .header("Prefer", "HonorNonIndexedQueriesWarningMayFailRandomly")
    .get()) as { value: GraphItemRef[] };
  return data.value[0] ?? null;
}

/**
 * Insert a new list item via m365 CLI (handles SP hyperlink columns properly).
 * m365 CLI requires the Received field as `M/D/YYYY h:mm AM/PM`, not ISO 8601.
 */
export async function insertItem(fields: ListItemFields): Promise<{ id: string }> {
  const webUrl = `https://${config.sp.hostname}${config.sp.sitePath}`;
  const args = [
    "spo",
    "listitem",
    "add",
    "--webUrl",
    webUrl,
    "--listTitle",
    config.sp.listName,
    "--Title",
    fields.Title,
    "--MessageId",
    fields.MessageId,
    "--FromAddress",
    fields.FromAddress,
    "--Received",
    formatReceivedForM365(fields.Received),
    "--EmailType",
    fields.EmailType,
    "--EmailStatus",
    fields.EmailStatus,
  ];
  if (fields.EmailLinkUrl) {
    const desc = fields.EmailLinkDescription ?? "Open original email";
    args.push("--EmailLink", `${fields.EmailLinkUrl}, ${desc}`);
  }

  const result = await $`m365 ${args} --output json`.quiet();
  const data = JSON.parse(result.stdout.toString()) as { Id: number };
  return { id: String(data.Id) };
}

function formatReceivedForM365(iso: string): string {
  const d = new Date(iso);
  // M/D/YYYY h:mm AM/PM (UTC kept as the moment, no timezone conversion)
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  let hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

/**
 * Insert iff no item with this MessageId exists. Returns "inserted" with the
 * new item id, or "skipped" with the existing item id.
 */
export async function upsertByMessageId(
  fields: ListItemFields,
): Promise<{ result: "inserted" | "skipped"; id: string }> {
  const existing = await getItemByMessageId(fields.MessageId);
  if (existing) return { result: "skipped", id: existing.id };
  const created = await insertItem(fields);
  return { result: "inserted", id: created.id };
}
