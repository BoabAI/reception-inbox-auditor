#!/usr/bin/env bun
/**
 * Smoke test for src/graph.ts — lists the most recent messages in the watched
 * mailbox so we can confirm auth + Graph reachability.
 */
import { config } from "../src/config.ts";
import { listInboxMessages } from "../src/graph.ts";

const messages = await listInboxMessages(config.watchedMailbox, { top: 5 });
console.log(`Recent messages in ${config.watchedMailbox} (${messages.length}):`);
for (const m of messages) {
  console.log(`  - [${m.receivedDateTime}] ${m.subject}`);
  console.log(`    from: ${m.from}`);
  console.log(`    msgId: ${m.internetMessageId}`);
}
