#!/usr/bin/env bun
/**
 * Reclassify every existing item in the SharePoint list.
 *
 * Use case: schema change (e.g. added Category) — back-fill the new field on
 * historic rows by re-running the classifier against subject/from data we
 * already have on the row. We don't need the full body for batch
 * reclassification; subject + from is usually enough.
 *
 * Idempotent — running twice produces the same labels (temperature=0).
 */
import { listAllItems, updateItemFields } from "../src/sharepoint.ts";
import { classifyEmail } from "../src/classify.ts";

const items = await listAllItems();
console.log(`[reclassify] ${items.length} items to process`);

let updated = 0;
let unchanged = 0;
let failed = 0;

for (const it of items) {
  const subject = it.fields.Title ?? "";
  const from = it.fields.FromAddress ?? "";
  if (!subject) continue;
  try {
    const cls = await classifyEmail({ subject, from, body: "" });
    const needsUpdate = it.fields.EmailType !== cls.type || it.fields.Category !== cls.category;
    if (needsUpdate) {
      await updateItemFields(it.id, { EmailType: cls.type, Category: cls.category });
      updated++;
      console.log(`  ✓ id=${it.id} -> ${cls.type} | ${cls.category}  ${subject.slice(0, 50)}`);
    } else {
      unchanged++;
    }
  } catch (e) {
    failed++;
    console.error(`  ✗ id=${it.id}: ${(e as Error).message}`);
  }
}

console.log(`\n[reclassify] updated=${updated} unchanged=${unchanged} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
