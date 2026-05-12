/**
 * Azure Functions v4 host. One timer trigger that runs the auto-log loop.
 *
 * Schedule: every 5 minutes. NCronTab format: {sec min hr day mon dow}.
 * Override via env AUTO_LOG_SCHEDULE if needed.
 *
 * Auth assumptions in this host:
 *   - GRAPH_AUTH_MODE=app  → ClientSecretCredential from app settings
 *   - CURSOR_STORE=table   → Azure Table Storage via managed identity
 *   - Azure OpenAI         → DefaultAzureCredential picks up managed identity
 */
import { app, type InvocationContext, type Timer } from "@azure/functions";
import { runOnce } from "../src/auto-log.js";

const SCHEDULE = process.env.AUTO_LOG_SCHEDULE ?? "0 */5 * * * *";

async function receptionPoll(_timer: Timer, context: InvocationContext): Promise<void> {
  context.log("[reception-poll] start");
  try {
    const r = await runOnce({ lookbackHours: 1, top: 50 });
    context.log(
      `[reception-poll] done mailbox=${r.mailbox} fetched=${r.fetched} inserted=${r.inserted} skipped=${r.skipped} cursorAfter=${r.cursorAfter}`,
    );
  } catch (err) {
    const e = err as Error;
    context.error(`[reception-poll] failed: ${e.message}\n${e.stack ?? ""}`);
    throw err; // let Functions runtime mark as failed for retry/alert
  }
}

app.timer("reception-poll", {
  schedule: SCHEDULE,
  runOnStartup: false,
  useMonitor: true,
  handler: receptionPoll,
});
