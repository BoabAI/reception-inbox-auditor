/**
 * SharePoint list upsert.
 *
 * Reads use Microsoft Graph (fast, indexed filter on MessageId).
 * Writes use direct SharePoint REST API (/_api/web/lists/.../items) because
 * Graph's /fields endpoint doesn't accept Hyperlink column values. SP REST
 * understands the SP.FieldUrlValue typed payload.
 *
 * Idempotent on Internet Message ID: getItemByMessageId looks up an existing
 * row first; we only insert when it returns null.
 */
import { graphClient, getSharePointToken } from "./graph.js";
import { config } from "./config.js";

type CachedRefs = {
  siteId: string;
  listId: string;
  webUrl: string;
  /** SP REST root, e.g. https://contoso.sharepoint.com/sites/foo */
  spRoot: string;
  /** ListItemEntityTypeFullName, e.g. SP.Data.Reception_x0020_Email_x0020_TrackerListItem */
  entityType: string;
};
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

  const spRoot = site.webUrl; // canonical SP site URL with proper case
  const entityType = await fetchEntityType(spRoot, config.sp.listName);

  refs = { siteId: site.id, listId: list.id, webUrl: site.webUrl, spRoot, entityType };
  return refs;
}

async function fetchEntityType(spRoot: string, listTitle: string): Promise<string> {
  const url = `${spRoot}/_api/web/lists/getbytitle('${encodeListTitle(listTitle)}')?$select=ListItemEntityTypeFullName`;
  const json = await spRestGet<{ d: { ListItemEntityTypeFullName: string } }>(url);
  return json.d.ListItemEntityTypeFullName;
}

function encodeListTitle(title: string): string {
  // single-quote needs doubling per OData; the rest is URL-encoded
  return encodeURIComponent(title.replace(/'/g, "''"));
}

async function spRestGet<T>(url: string): Promise<T> {
  const token = await getSharePointToken();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json;odata=verbose",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SP REST GET ${url} failed ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

async function spRestPost<T>(url: string, body: unknown): Promise<T> {
  const token = await getSharePointToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json;odata=verbose",
      "Content-Type": "application/json;odata=verbose",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SP REST POST ${url} failed ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export type ListItemFields = {
  Title: string;
  MessageId: string;
  FromAddress: string;
  Received: string; // ISO 8601 (UTC)
  EmailType: "Referral" | "Other" | "Unclassified";
  EmailStatus: "New" | "In Progress" | "Action Completed";
  Category?: string;
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
 * Insert a new list item via SharePoint REST. SP REST accepts ISO 8601 for
 * datetime fields and SP.FieldUrlValue typed payloads for hyperlink fields.
 */
export async function insertItem(fields: ListItemFields): Promise<{ id: string }> {
  const { spRoot, entityType } = await resolveRefs();
  const url = `${spRoot}/_api/web/lists/getbytitle('${encodeListTitle(config.sp.listName)}')/items`;

  const body: Record<string, unknown> = {
    __metadata: { type: entityType },
    Title: fields.Title,
    MessageId: fields.MessageId,
    FromAddress: fields.FromAddress,
    Received: fields.Received,
    EmailType: fields.EmailType,
    EmailStatus: fields.EmailStatus,
  };
  if (fields.Category) body.Category = fields.Category;
  if (fields.EmailLinkUrl) {
    body.EmailLink = {
      __metadata: { type: "SP.FieldUrlValue" },
      Url: fields.EmailLinkUrl,
      Description: fields.EmailLinkDescription ?? "Open original email",
    };
  }

  const data = await spRestPost<{ d: { Id: number } }>(url, body);
  return { id: String(data.d.Id) };
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

/**
 * Update specific fields on an existing list item by id. Used by re-classify.
 */
export async function updateItemFields(
  itemId: string,
  fields: Partial<Pick<ListItemFields, "EmailType" | "Category">>,
): Promise<void> {
  const { siteId, listId } = await resolveRefs();
  const client = await graphClient();
  const body: Record<string, string> = {};
  if (fields.EmailType) body.EmailType = fields.EmailType;
  if (fields.Category) body.Category = fields.Category;
  await client.api(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`).patch(body);
}

export type ListedItem = {
  id: string;
  fields: {
    Title?: string;
    MessageId?: string;
    FromAddress?: string;
    EmailType?: string;
    EmailStatus?: string;
    Category?: string;
  };
};

/**
 * Page through every item in the list. Used by reporting + reclassify.
 */
export async function listAllItems(): Promise<ListedItem[]> {
  const { siteId, listId } = await resolveRefs();
  const client = await graphClient();
  const items: ListedItem[] = [];
  let url: string | null = `/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=200`;
  while (url) {
    const page = (await client.api(url).get()) as { value: ListedItem[]; "@odata.nextLink"?: string };
    items.push(...page.value);
    url = page["@odata.nextLink"] ?? null;
    if (url) url = url.replace("https://graph.microsoft.com/v1.0", "");
  }
  return items;
}
