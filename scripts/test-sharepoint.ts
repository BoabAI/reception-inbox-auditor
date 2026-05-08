#!/usr/bin/env bun
/**
 * Smoke test for src/sharepoint.ts — exercises the dedup path:
 *   1. upsert a fake row -> expect "inserted"
 *   2. upsert the same row -> expect "skipped"
 *   3. clean up by id
 */
import { graphClient } from "../src/graph.ts";
import { config } from "../src/config.ts";
import { upsertByMessageId, getItemByMessageId } from "../src/sharepoint.ts";

const messageId = `smoke-test-${Date.now()}@local`;
const fields = {
  Title: "TEST: smoke row from sharepoint.ts",
  MessageId: messageId,
  FromAddress: "smoke@example.com",
  Received: new Date().toISOString(),
  EmailType: "Unclassified" as const,
  EmailStatus: "New" as const,
  EmailLinkUrl: "https://outlook.office.com/test",
  EmailLinkDescription: "Open original",
};

console.log("1. First upsert (expect inserted)");
console.log("   step a: lookup by MessageId");
const lookup = await getItemByMessageId(messageId);
console.log(`   lookup result: ${lookup ? "found" : "null"}`);
const r1 = await upsertByMessageId(fields);
console.log(`   ${r1.result} id=${r1.id}`);
if (r1.result !== "inserted") {
  console.error("FAIL: expected inserted");
  process.exit(1);
}

console.log("2. Second upsert with same MessageId (expect skipped)");
const r2 = await upsertByMessageId(fields);
console.log(`   ${r2.result} id=${r2.id}`);
if (r2.result !== "skipped") {
  console.error("FAIL: expected skipped (dedup failed)");
  process.exit(1);
}
if (r2.id !== r1.id) {
  console.error("FAIL: skipped id should match the original inserted id");
  process.exit(1);
}

console.log("3. Lookup by MessageId");
const found = await getItemByMessageId(messageId);
if (!found || found.id !== r1.id) {
  console.error("FAIL: getItemByMessageId did not return original");
  process.exit(1);
}

console.log("4. Cleanup — removing test row");
const client = await graphClient();
const site = await client.api(`/sites/${config.sp.hostname}:${config.sp.sitePath}`).get();
const listsResp = (await client.api(`/sites/${site.id}/lists`).get()) as { value: { id: string; displayName: string }[] };
const listId = listsResp.value.find((l) => l.displayName === config.sp.listName)!.id;
await client.api(`/sites/${site.id}/lists/${listId}/items/${r1.id}`).delete();
console.log("   removed");

console.log("\n✓ all sharepoint upsert checks passed");
