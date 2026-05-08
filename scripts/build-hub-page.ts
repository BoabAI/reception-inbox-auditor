#!/usr/bin/env bun
/**
 * Build / refresh the unified Reception Inbox Hub page.
 *
 * Single page with three collapsible sections behaving like tabs:
 *   1. Inbox        — embedded list web part
 *   2. Stats        — summary numbers + pie chart of categories
 *   3. Compliance   — privacy / APP alignment text
 *
 * Idempotent — running twice replaces the page. Also removes the older
 * standalone Reception-Stats.aspx and Compliance-and-Privacy.aspx pages so
 * there's one canonical surface.
 */
import { $ } from "bun";
import { config } from "../src/config.ts";
import { listAllItems } from "../src/sharepoint.ts";
import { CATEGORIES } from "../src/classify.ts";

const webUrl = `https://${config.sp.hostname}${config.sp.sitePath}`;
const pageName = "Reception-Hub.aspx";
const pageTitle = "Reception Inbox";

// --- Crunch numbers ---
const items = await listAllItems();
const total = items.length;
const referrals = items.filter((i) => i.fields.EmailType === "Referral").length;
const other = items.filter((i) => i.fields.EmailType === "Other").length;

const counts = new Map<string, number>();
for (const c of CATEGORIES) counts.set(c, 0);
for (const it of items) {
  const cat = it.fields.Category ?? "Other";
  counts.set(cat, (counts.get(cat) ?? 0) + 1);
}
const presentCategories = [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

console.log(`[hub] total=${total} referrals=${referrals} other=${other}`);

const colors = [
  "#0078D4", "#107C10", "#D83B01", "#5C2D91", "#E81123",
  "#00B294", "#FFB900", "#B4009E", "#737373", "#005A9E",
  "#498205", "#A80000", "#8E562E", "#243A5A",
];

/**
 * Inline-SVG pie chart with side legend. Replaces the SP QuickChart webpart
 * which is buggy (renderer crashes on `.filter()` regardless of data shape).
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildSvgPie(data: Array<readonly [string, number]>, palette: readonly string[]): string {
  const total = data.reduce((sum, [, n]) => sum + n, 0) || 1;
  const cx = 160;
  const cy = 160;
  const r = 140;
  let cumulative = 0;
  const slices: string[] = [];
  data.forEach(([cat, n], i) => {
    const startAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    cumulative += n;
    const endAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const color = palette[i % palette.length] ?? "#888";
    if (data.length === 1) {
      slices.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#fff" stroke-width="2"/>`);
    } else {
      slices.push(
        `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}" stroke="#fff" stroke-width="2"><title>${escapeHtml(cat)}: ${n}</title></path>`,
      );
    }
  });
  const legend = data
    .map(
      ([cat, n], i) =>
        `<tr><td style="padding:2px 8px;"><span style="display:inline-block;width:12px;height:12px;background:${palette[i % palette.length]};border-radius:2px;"></span></td><td style="padding:2px 6px;font:14px Segoe UI,Arial,sans-serif;">${escapeHtml(cat)}</td><td style="padding:2px 6px;font:600 14px Segoe UI,Arial,sans-serif;text-align:right;">${n}</td><td style="padding:2px 6px;font:13px Segoe UI,Arial,sans-serif;color:#666;">${((n / total) * 100).toFixed(1)}%</td></tr>`,
    )
    .join("");
  return `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;margin:8px 0;"><svg viewBox="0 0 320 320" width="320" height="320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pie chart of emails by category">${slices.join("")}</svg><table style="border-collapse:collapse;"><thead><tr><th></th><th style="text-align:left;font:600 14px Segoe UI,Arial,sans-serif;padding:2px 6px;">Category</th><th style="text-align:right;font:600 14px Segoe UI,Arial,sans-serif;padding:2px 6px;">Count</th><th style="text-align:right;font:600 14px Segoe UI,Arial,sans-serif;padding:2px 6px;">%</th></tr></thead><tbody>${legend}</tbody></table></div>`;
}

const pieSvgHtml = `<h3>Emails by Category</h3>${buildSvgPie(presentCategories, colors)}`;

const lastUpdated = new Date().toISOString().replace("T", " ").slice(0, 19);

// --- Content (HTML — SP text webpart accepts HTML, not markdown) ---
const introHtml = `<p>Single landing for the auto-logged reception inbox. Sections below are collapsible — click the header to expand.</p>
<ul>
  <li><strong>Inbox</strong> — the live list, grouped by Status. Receptionist works rows top-down.</li>
  <li><strong>Stats</strong> — counts and a pie chart by category. Snapshot, refresh with <code>bun run hub</code>.</li>
  <li><strong>Compliance</strong> — Australian Privacy Principles alignment + data residency.</li>
</ul>
<p><em>Last refreshed: ${lastUpdated} UTC. Total: <strong>${total}</strong> logged · <strong>${referrals}</strong> referrals · <strong>${other}</strong> other.</em></p>`;

const statsSummaryHtml = `<h3>Snapshot</h3>
<p><strong>Total logged:</strong> ${total} &nbsp;·&nbsp; <strong>Referrals:</strong> ${referrals} &nbsp;·&nbsp; <strong>Other:</strong> ${other}</p>
<p><em>Snapshot taken ${lastUpdated} UTC. Re-run <code>bun run hub</code> to refresh.</em></p>`;

const compliance: string[] = [
  `<h3>What we process</h3>
<ul>
  <li><strong>Source:</strong> emails received in the clinic's shared M365 mailbox.</li>
  <li><strong>Per email, we read:</strong> subject, sender display name + address, received timestamp, and the <strong>first 500 characters</strong> of the body.</li>
  <li><strong>We do not read:</strong> attachments, full email bodies, or any other mailbox content.</li>
</ul>
<p>The auto-log writes one row per email into the SharePoint list. The receptionist and practice manager work that list directly. No patient data is moved to any third-party system outside the clinic's M365 tenant.</p>`,

  `<h3>Where data lives</h3>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;">
  <thead><tr><th align="left">Data</th><th align="left">Location</th><th align="left">Region</th></tr></thead>
  <tbody>
    <tr><td>Email content (full)</td><td>Clinic's Exchange Online mailbox</td><td>Same M365 region as the tenant</td></tr>
    <tr><td>Auto-log row (subject, sender, classification)</td><td>Clinic's SharePoint list</td><td>Same M365 region as the tenant</td></tr>
    <tr><td>LLM classification call</td><td>Azure OpenAI — Australia East</td><td>Australia</td></tr>
    <tr><td>LLM training</td><td><strong>Disabled</strong> — Microsoft does not use customer data to train models</td><td>n/a</td></tr>
  </tbody>
</table>
<p>For the POC, all processing runs in <strong>SMEC AI's tenant</strong> against <code>demonstration@smecai.au</code>, in Microsoft 365 Australia. No real patient data is used.</p>`,

  `<h3>Australian Privacy Principles alignment</h3>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;">
  <thead><tr><th>APP</th><th>Title</th><th>How the system addresses it</th></tr></thead>
  <tbody>
    <tr><td>APP 1</td><td>Open and transparent management</td><td>This page; SharePoint version history exposes every change</td></tr>
    <tr><td>APP 6</td><td>Use or disclosure</td><td>Patient data is used only to classify and log; no disclosure outside the clinic's tenant</td></tr>
    <tr><td>APP 8</td><td>Cross-border disclosure</td><td><strong>No cross-border transfer.</strong> AI inference runs in Australia East. M365 tenant data residency = Australia</td></tr>
    <tr><td>APP 11</td><td>Security of personal information</td><td>Existing M365 RBAC + MFA; SharePoint list inherits site permissions; no new credential surface</td></tr>
    <tr><td>APP 12</td><td>Access</td><td>Existing M365 / Outlook access mechanisms apply unchanged</td></tr>
    <tr><td>APP 13</td><td>Correction</td><td>Receptionist edits the row inline; SharePoint version history retains corrections</td></tr>
  </tbody>
</table>
<p>The system introduces <strong>no new identity surface</strong> — every actor is an existing M365 user authenticated by the clinic's existing AAD/Entra ID.</p>`,

  `<h3>AI provider obligations</h3>
<ul>
  <li><strong>Provider:</strong> Microsoft Azure OpenAI Service (Australia East).</li>
  <li><strong>Data residency:</strong> prompts and completions stay in the Australia East region.</li>
  <li><strong>Retention:</strong> Azure OpenAI retains prompts and completions for up to 30 days for abuse monitoring, then deletes. Microsoft staff cannot read this data without a documented abuse investigation. Abuse monitoring <strong>can be disabled</strong> via Microsoft's healthcare exemption process.</li>
  <li><strong>Training:</strong> Microsoft does <strong>not</strong> use customer data to train, retrain, or improve foundation models. Contractual, not a setting.</li>
  <li><strong>Authentication:</strong> AAD-only via Managed Identity / DefaultAzureCredential. No API keys are stored in the repo or runtime config.</li>
</ul>`,

  `<h3>Audit trail and retention</h3>
<ul>
  <li>The SharePoint list has <strong>versioning enabled</strong> — every row change is captured with the user's M365 identity and timestamp.</li>
  <li>The original AI classification is recoverable from version history if a receptionist override is questioned.</li>
  <li>Default list retention follows the clinic's tenant-level policy (typically 7 years for clinical correspondence under state-based health-records legislation, e.g. NSW HRIPA 2002, ACT Health Records (Privacy and Access) Act 1997).</li>
  <li>Emails themselves remain in Exchange Online under the clinic's existing retention policies — this system does not modify them.</li>
</ul>`,

  `<h3>What this system does NOT do</h3>
<ul>
  <li>Does <strong>not</strong> auto-reply to patients.</li>
  <li>Does <strong>not</strong> trigger downstream actions (no auto-booking, no auto-billing, no claim submission).</li>
  <li>Does <strong>not</strong> export data to any system outside the clinic's M365 tenant.</li>
  <li>Does <strong>not</strong> delete or modify any email in the mailbox.</li>
</ul>
<p>The mandate is <strong>visibility, not automation</strong>. The receptionist remains the decision-maker on every row.</p>`,

  `<h3>Recommended patient-facing wording</h3>
<p>For inclusion in the clinic's privacy collection notice / website:</p>
<blockquote>
"Emails received at our reception inbox are automatically logged into a secure tracking system to help us monitor and respond to clinical referrals. An AI tool, hosted in Australia by Microsoft, is used to suggest a classification for each email. Final handling is always done by clinic staff. Your email content is processed only within Australia and is not used to train any AI model. Email content is retained in line with our broader records retention policy."
</blockquote>
<p>Folds into the existing Privacy Collection Statement at intake / patient registration.</p>`,

  `<h3>Open issues for the clinic</h3>
<ul>
  <li>Confirm tenant region as Australia for the M365 subscription.</li>
  <li>Decide whether to disable Azure OpenAI abuse-monitoring retention (healthcare exemption).</li>
  <li>Update Privacy Collection Statement to mention AI-assisted email classification.</li>
  <li>Decide who has access to the SharePoint list (receptionist + practice manager + clinical lead).</li>
  <li>Decide list retention period (default: tenant policy).</li>
</ul>`,
];

// --- Helpers ---
async function pageExists(name: string): Promise<boolean> {
  const r = await $`m365 spo page get --webUrl ${webUrl} --name ${name} --output json`.nothrow().quiet();
  return r.exitCode === 0;
}

async function removePageIfExists(name: string): Promise<void> {
  if (await pageExists(name)) {
    console.log(`→ removing ${name}`);
    await $`m365 spo page remove --webUrl ${webUrl} --name ${name} --force`.quiet();
  }
}

// --- Build ---
await removePageIfExists(pageName);
await removePageIfExists("Reception-Stats.aspx");
await removePageIfExists("Compliance-and-Privacy.aspx");

console.log(`→ creating ${pageName}`);
await $`m365 spo page add --webUrl ${webUrl} --name ${pageName} --title ${pageTitle} --layoutType Article`.quiet();

// m365 CLI has a quirk where consecutive section adds shift collapsibleTitle
// across zones by one. Workaround: reverse the title order so the bug rotates
// them into the right zones.
console.log(`→ adding 3 collapsible sections (titles in reverse to compensate for m365 CLI title-rotation bug)`);
await $`m365 spo page section add --webUrl ${webUrl} --pageName ${pageName} --sectionTemplate OneColumn --isCollapsibleSection --collapsibleTitle "Compliance & Privacy" --headingLevel 2`.quiet();
await $`m365 spo page section add --webUrl ${webUrl} --pageName ${pageName} --sectionTemplate OneColumn --isCollapsibleSection --collapsibleTitle "Inbox" --isExpanded --headingLevel 2`.quiet();
await $`m365 spo page section add --webUrl ${webUrl} --pageName ${pageName} --sectionTemplate OneColumn --isCollapsibleSection --collapsibleTitle "Stats" --headingLevel 2`.quiet();

// Resolve list ID (List webpart needs selectedListId to render)
const listJson = JSON.parse((await $`m365 spo list get --webUrl ${webUrl} --title ${config.sp.listName} --output json`.quiet().text()).trim()) as { Id: string };

// Section 1: Inbox content
console.log(`→ filling Inbox`);
await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${introHtml} --section 1`.quiet();
const listProps = {
  isDocumentLibrary: false,
  selectedListId: listJson.Id,
  webRelativeListUrl: `${config.sp.sitePath}/Lists/${encodeURIComponent(config.sp.listName)}`,
  listTitle: config.sp.listName,
  webpartHeightKey: 1,
};
await $`m365 spo page clientsidewebpart add --webUrl ${webUrl} --pageName ${pageName} --standardWebPart List --webPartProperties ${JSON.stringify(listProps)} --section 1`.nothrow().quiet();

// Section 2: Stats content (SVG pie embedded as HTML, no QuickChart webpart)
console.log(`→ filling Stats`);
await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${statsSummaryHtml} --section 2`.quiet();
await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${pieSvgHtml} --section 2`.quiet();

// Section 3: Compliance content
console.log(`→ filling Compliance`);
for (const [i, block] of compliance.entries()) {
  console.log(`  → block ${i + 1}/${compliance.length}`);
  await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${block} --section 3`.quiet();
}

console.log(`→ publishing`);
await $`m365 spo page set --webUrl ${webUrl} --name ${pageName} --publish`.quiet();

console.log(`\n✓ hub page ready`);
console.log(`  ${webUrl}/SitePages/${pageName}`);
