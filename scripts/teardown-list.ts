#!/usr/bin/env bun
/**
 * Roll back the SharePoint list created by create-list.ts.
 * Removes the list (which removes its fields, views, and items).
 */
import { $ } from "bun";
import { config } from "../src/config.ts";

const webUrl = `https://${config.sp.hostname}${config.sp.sitePath}`;
const listTitle = config.sp.listName;

const check = await $`m365 spo list get --webUrl ${webUrl} --title ${listTitle} --output json`.nothrow().quiet();
if (check.exitCode !== 0) {
  console.log(`✓ list "${listTitle}" not present — nothing to do`);
  process.exit(0);
}

console.log(`→ removing list "${listTitle}" from ${webUrl}`);
await $`m365 spo list remove --webUrl ${webUrl} --title ${listTitle} --force`;
console.log("✓ list removed");
