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

const chartData = {
  dataVersion: "1.0",
  properties: {
    chartType: 5, // pie
    title: "Emails by Category",
    isCalloutVisible: true,
    isLegendVisible: true,
    chartTitleColor: "#323130",
    dataValuePrecision: 0,
    dataPointShape: 0,
    chartCategories: presentCategories.map(([cat]) => cat),
    chartSeries: [{ name: "Count", data: presentCategories.map(([, n]) => n) }],
    chartSeriesColors: presentCategories.map((_, i) => colors[i % colors.length]),
  },
  serverProcessedContent: {
    htmlStrings: {},
    searchablePlainTexts: { title: "Emails by Category" },
    imageSources: {},
    links: {},
  },
};

const lastUpdated = new Date().toISOString().replace("T", " ").slice(0, 19);

// --- Content ---
const introMarkdown = `# Reception Inbox

Single landing for the auto-logged reception inbox. Sections below are collapsible — click the header to expand.

- **Inbox** — the live list, grouped by Status. Receptionist works rows top-down.
- **Stats** — counts and a pie chart by category. Snapshot, refresh with \`bun run hub\`.
- **Compliance** — Australian Privacy Principles alignment + data residency.

_Last refreshed: ${lastUpdated} UTC. Total: **${total}** logged · **${referrals}** referrals · **${other}** other._`;

const statsSummaryMarkdown = `### Snapshot

**Total logged:** ${total}
**Referrals:** ${referrals}  ·  **Other:** ${other}

| Category | Count |
|---|---|
${presentCategories.map(([cat, n]) => `| ${cat} | **${n}** |`).join("\n")}

_Snapshot taken ${lastUpdated} UTC. Re-run \`bun run hub\` to refresh._`;

const compliance: string[] = [
  `### What we process

- **Source:** emails received in the clinic's shared M365 mailbox.
- **Per email, we read:** subject, sender display name + address, received timestamp, and the **first 500 characters** of the body.
- **We do not read:** attachments, full email bodies, or any other mailbox content.

The auto-log writes one row per email into the SharePoint list. The receptionist and practice manager work that list directly. No patient data is moved to any third-party system outside the clinic's M365 tenant.`,

  `### Where data lives

| Data | Location | Region |
|---|---|---|
| Email content (full) | Clinic's Exchange Online mailbox | Same M365 region as the tenant |
| Auto-log row (subject, sender, classification) | Clinic's SharePoint list | Same M365 region as the tenant |
| LLM classification call | Azure OpenAI — Australia East | Australia |
| LLM training | **Disabled** — Microsoft does not use customer data to train models | n/a |

For the POC, all processing runs in **SMEC AI's tenant** against \`demonstration@smecai.au\`, in Microsoft 365 Australia. No real patient data is used.`,

  `### Australian Privacy Principles alignment

| APP | Title | How the system addresses it |
|---|---|---|
| APP 1 | Open and transparent management | This page; SharePoint version history exposes every change |
| APP 6 | Use or disclosure | Patient data is used only to classify and log; no disclosure outside the clinic's tenant |
| APP 8 | Cross-border disclosure | **No cross-border transfer.** AI inference runs in Australia East. M365 tenant data residency = Australia |
| APP 11 | Security of personal information | Existing M365 RBAC + MFA; SharePoint list inherits site permissions; no new credential surface |
| APP 12 | Access | Existing M365 / Outlook access mechanisms apply unchanged |
| APP 13 | Correction | Receptionist edits the row inline; SharePoint version history retains corrections |

The system introduces **no new identity surface** — every actor is an existing M365 user authenticated by the clinic's existing AAD/Entra ID.`,

  `### AI provider obligations

- **Provider:** Microsoft Azure OpenAI Service (Australia East).
- **Data residency:** prompts and completions stay in the Australia East region.
- **Retention:** Azure OpenAI retains prompts and completions for up to 30 days for abuse monitoring, then deletes. Microsoft staff cannot read this data without a documented abuse investigation. Abuse monitoring **can be disabled** via Microsoft's healthcare exemption process.
- **Training:** Microsoft does **not** use customer data to train, retrain, or improve foundation models. Contractual, not a setting.
- **Authentication:** AAD-only via Managed Identity / DefaultAzureCredential. No API keys are stored in the repo or runtime config.`,

  `### Audit trail and retention

- The SharePoint list has **versioning enabled** — every row change is captured with the user's M365 identity and timestamp.
- The original AI classification is recoverable from version history if a receptionist override is questioned.
- Default list retention follows the clinic's tenant-level policy (typically 7 years for clinical correspondence under state-based health-records legislation, e.g. NSW HRIPA 2002, ACT Health Records (Privacy and Access) Act 1997).
- Emails themselves remain in Exchange Online under the clinic's existing retention policies — this system does not modify them.`,

  `### What this system does NOT do

- Does **not** auto-reply to patients.
- Does **not** trigger downstream actions (no auto-booking, no auto-billing, no claim submission).
- Does **not** export data to any system outside the clinic's M365 tenant.
- Does **not** delete or modify any email in the mailbox.

The mandate is **visibility, not automation**. The receptionist remains the decision-maker on every row.`,

  `### Recommended patient-facing wording

For inclusion in the clinic's privacy collection notice / website:

> "Emails received at our reception inbox are automatically logged into a secure tracking system to help us monitor and respond to clinical referrals. An AI tool, hosted in Australia by Microsoft, is used to suggest a classification for each email. Final handling is always done by clinic staff. Your email content is processed only within Australia and is not used to train any AI model. Email content is retained in line with our broader records retention policy."

Folds into the existing Privacy Collection Statement at intake / patient registration.`,

  `### Open issues for the clinic

- [ ] Confirm tenant region as Australia for the M365 subscription.
- [ ] Decide whether to disable Azure OpenAI abuse-monitoring retention (healthcare exemption).
- [ ] Update Privacy Collection Statement to mention AI-assisted email classification.
- [ ] Decide who has access to the SharePoint list (receptionist + practice manager + clinical lead).
- [ ] Decide list retention period (default: tenant policy).`,
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

// Section 1: Inbox content
console.log(`→ filling Inbox`);
await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${introMarkdown} --section 1`.quiet();
const listProps = {
  isDocumentLibrary: false,
  selectedListUrl: `${config.sp.sitePath}/Lists/${encodeURIComponent(config.sp.listName)}`,
  listTitle: config.sp.listName,
};
await $`m365 spo page clientsidewebpart add --webUrl ${webUrl} --pageName ${pageName} --standardWebPart List --webPartProperties ${JSON.stringify(listProps)} --section 1`.nothrow().quiet();

// Section 2: Stats content
console.log(`→ filling Stats`);
await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${statsSummaryMarkdown} --section 2`.quiet();
await $`m365 spo page clientsidewebpart add --webUrl ${webUrl} --pageName ${pageName} --standardWebPart QuickChart --webPartData ${JSON.stringify(chartData)} --section 2`.quiet();

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
