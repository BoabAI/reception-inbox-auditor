#!/usr/bin/env bun
/**
 * Capture screenshots for the explainer video.
 *
 * Launches a headed Chromium. You log in to Microsoft 365 once. Then we
 * navigate the 4 demo views and save PNGs to remotion/public/screenshots/.
 *
 * Auth state is persisted to .state/playwright-auth.json so subsequent runs
 * skip the login.
 *
 * Usage:  bun run scripts/video/capture.ts
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "../..");
const SP_HUB_URL =
  "https://smecai.sharepoint.com/sites/AIApplications/SitePages/Reception-Hub.aspx";
const OUTLOOK_URL =
  "https://outlook.cloud.microsoft/mail/demonstration@smecai.au/";
const SCREENSHOT_DIR = resolve(
  PROJECT_ROOT,
  "scripts/video/remotion/public/screenshots",
);
const AUTH_STATE_PATH = resolve(PROJECT_ROOT, ".state/playwright-auth.json");

const VIEWPORT = { width: 1920, height: 1080 };

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });
if (!existsSync(dirname(AUTH_STATE_PATH)))
  mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  storageState: existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined,
});
const page = await context.newPage();

console.log("");
console.log("================================================================");
console.log("  CAPTURE STARTING — look for the Chromium window in your dock");
console.log("  log in to Microsoft 365 as sean@smecai.au when prompted.");
console.log("  the script waits up to 10 minutes for the hub page to render.");
console.log("================================================================");
console.log("");
await page.goto(SP_HUB_URL, { waitUntil: "load", timeout: 600_000 });
console.log("[capture] initial load complete, waiting for hub content...");

// Poll the URL every 5s so we can see when the user clears auth.
const urlCheck = setInterval(() => {
  console.log(`[capture] current url: ${page.url()}`);
}, 8000);

try {
  // Wait for URL to land on the hub page (after auth)
  await page.waitForURL(/Reception-Hub\.aspx/i, { timeout: 600_000 });
  console.log("[capture] reached hub URL, waiting for content");
  await page.waitForLoadState("networkidle", { timeout: 60_000 });
  // Confirm the Inbox heading is present
  await page.locator("h2:has-text('Inbox'), span:has-text('Inbox')").first().waitFor({ timeout: 60_000 });
} finally {
  clearInterval(urlCheck);
}
console.log("[capture] hub page loaded");
await page.waitForTimeout(3500); // let webparts finish painting

// Save auth state IMMEDIATELY so even a later crash leaves usable credentials
await context.storageState({ path: AUTH_STATE_PATH });
console.log(`[capture] saved auth state to ${AUTH_STATE_PATH}`);

// Helper: click a heading text on the page to expand a collapsible section.
// Section headers are styled as large H2-like text — prefer role=heading
// matches over plain text matches (which can hit body copy).
async function clickHeading(text: string) {
  let target = page.getByRole("heading", { name: text, exact: true }).first();
  if ((await target.count()) === 0) {
    // Fallback: any element whose text is exactly that
    target = page.locator(`:text-is("${text}")`).first();
  }
  await target.scrollIntoViewIfNeeded();
  await target.click({ delay: 50 });
  await page.waitForTimeout(900);
  // After expanding, scroll so the section header is near the top of the viewport
  await target.evaluate((el: Element) => el.scrollIntoView({ block: "start" }));
  // Then nudge up a bit so the SharePoint sticky top bar doesn't cover it
  await page.evaluate("window.scrollBy(0, -100)");
  await page.waitForTimeout(1500);
}

// Expand the inbox list group (currently collapsed showing "Status: New (72)")
console.log("[capture] expanding Status: New group");
try {
  await page.locator("text=/Status: New/").first().click({ delay: 50 });
  await page.waitForTimeout(900);
} catch {
  console.log("[capture] no Status group toggle found, skipping");
}

// --- Capture 02 — hub Inbox section ---
console.log("[capture] capturing Inbox view");
await page.evaluate("window.scrollTo(0, 320)");
await page.waitForTimeout(900);
await page.screenshot({
  path: resolve(SCREENSHOT_DIR, "02-hub-inbox.png"),
  fullPage: false,
});
console.log("[capture] 02-hub-inbox.png saved");

// --- Capture 03 — hub Stats section ---
console.log("[capture] expanding Stats section");
await clickHeading("Stats");
await page.waitForTimeout(1800); // pie chart takes a moment to render
await page.screenshot({
  path: resolve(SCREENSHOT_DIR, "03-hub-stats.png"),
  fullPage: false,
});
console.log("[capture] 03-hub-stats.png saved");

// --- Capture 04 — hub Compliance section ---
console.log("[capture] expanding Compliance section");
await clickHeading("Compliance & Privacy");
await page.waitForTimeout(1200);
await page.screenshot({
  path: resolve(SCREENSHOT_DIR, "04-hub-compliance.png"),
  fullPage: false,
});
console.log("[capture] 04-hub-compliance.png saved");

// --- Capture 01 — Outlook inbox (different URL) ---
console.log("[capture] navigating to Outlook web");
await page.goto(OUTLOOK_URL, { waitUntil: "load", timeout: 120_000 });
await page.waitForTimeout(4000); // OWA is slow to fully render
await page.screenshot({
  path: resolve(SCREENSHOT_DIR, "01-outlook-inbox.png"),
  fullPage: false,
});
console.log("[capture] 01-outlook-inbox.png saved");

await context.storageState({ path: AUTH_STATE_PATH });
await browser.close();
console.log(`[capture] done. 4 PNGs in ${SCREENSHOT_DIR}`);
