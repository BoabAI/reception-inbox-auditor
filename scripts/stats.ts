#!/usr/bin/env bun
/**
 * Build / refresh the "Reception Stats" page on the AIApplications site.
 *
 * Reads the list, counts items by Category, and (re-)creates a SharePoint
 * Modern Page with:
 *   - a header Text section showing total / Referral / Other counts
 *   - a QuickChart web part — pie chart of category distribution
 *   - a Text section with a categorised count table
 *   - a List web part embedding the Reception Email Tracker
 *
 * QuickChart web part data is a snapshot. Re-run to refresh.
 *
 * Idempotent — running twice replaces the page with up-to-date numbers.
 */
import { $ } from "bun";
import { config } from "../src/config.ts";
import { listAllItems } from "../src/sharepoint.ts";
import { CATEGORIES } from "../src/classify.ts";

const webUrl = `https://${config.sp.hostname}${config.sp.sitePath}`;
const pageName = "Reception-Stats.aspx";
const pageTitle = "Reception Inbox — Stats";

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

console.log(`[stats] total=${total} referrals=${referrals} other=${other}`);
for (const [cat, n] of presentCategories) console.log(`  ${n.toString().padStart(3)}  ${cat}`);

// QuickChart web part data — pie chart of category counts
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
    chartSeries: [
      {
        name: "Count",
        data: presentCategories.map(([, n]) => n),
        color: undefined,
      },
    ],
    chartSeriesColors: presentCategories.map((_, i) => colors[i % colors.length]),
  },
  serverProcessedContent: {
    htmlStrings: {},
    searchablePlainTexts: { title: "Emails by Category" },
    imageSources: {},
    links: {},
  },
};

// --- Render markdown summary for a Text web part ---
const lastUpdated = new Date().toISOString();
const summaryMarkdown = `## Reception Inbox at a glance

**Total logged emails:** ${total}
**Referrals:** ${referrals}  ·  **Other:** ${other}

_Last refreshed: ${lastUpdated.replace("T", " ").slice(0, 19)} UTC. Run \`bun run stats\` to refresh._`;

const breakdownMarkdown = `## Breakdown by category

| Category | Count |
|---|---|
${presentCategories.map(([cat, n]) => `| ${cat} | **${n}** |`).join("\n")}
`;

// --- Recreate page idempotently ---
async function pageExists(): Promise<boolean> {
  const r = await $`m365 spo page get --webUrl ${webUrl} --name ${pageName} --output json`.nothrow().quiet();
  return r.exitCode === 0;
}

if (await pageExists()) {
  console.log(`→ removing existing page ${pageName}`);
  await $`m365 spo page remove --webUrl ${webUrl} --name ${pageName} --force`.quiet();
}

console.log(`→ creating page ${pageName}`);
await $`m365 spo page add --webUrl ${webUrl} --name ${pageName} --title ${pageTitle} --layoutType Article`.quiet();

console.log(`→ adding header text`);
await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${summaryMarkdown}`.quiet();

console.log(`→ adding QuickChart web part (pie)`);
await $`m365 spo page clientsidewebpart add --webUrl ${webUrl} --pageName ${pageName} --standardWebPart QuickChart --webPartData ${JSON.stringify(chartData)}`.quiet();

console.log(`→ adding category breakdown text`);
await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${breakdownMarkdown}`.quiet();

// List web part — best effort; configuration of which list to show is via webPartProperties
const listWebPartData = {
  properties: {
    isDocumentLibrary: false,
    selectedListUrl: `${config.sp.sitePath}/Lists/${encodeURIComponent(config.sp.listName)}`,
    listTitle: config.sp.listName,
  },
};
console.log(`→ adding List web part`);
await $`m365 spo page clientsidewebpart add --webUrl ${webUrl} --pageName ${pageName} --standardWebPart List --webPartProperties ${JSON.stringify(listWebPartData.properties)}`.nothrow().quiet();

console.log(`→ publishing page`);
await $`m365 spo page set --webUrl ${webUrl} --name ${pageName} --publish`.quiet();

console.log(`\n✓ stats page ready`);
console.log(`  ${webUrl}/SitePages/${pageName}`);
