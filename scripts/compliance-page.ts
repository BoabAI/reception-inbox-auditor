#!/usr/bin/env bun
/**
 * Build the "Compliance & Privacy" SharePoint page on the AIApplications site.
 *
 * Content covers how the Reception Inbox Auditor handles Australian medical
 * data: Privacy Act 1988 / APPs, AU data residency, audit trail, retention,
 * and the patient-data carve-out (no data leaves the AU region).
 *
 * Idempotent — running twice replaces the page.
 */
import { $ } from "bun";
import { config } from "../src/config.ts";

const webUrl = `https://${config.sp.hostname}${config.sp.sitePath}`;
const pageName = "Compliance-and-Privacy.aspx";
const pageTitle = "Compliance & Privacy";

// Each entry becomes a Text web part on the page. SharePoint's Text web part
// supports a useful subset of markdown.

const sections = [
  `# Compliance & Privacy

This page documents how the **Reception Inbox Auditor** handles Australian
medical data and the obligations the deployment is designed to meet.

_Last reviewed: ${new Date().toISOString().slice(0, 10)}._`,

  `## What we process

- **Source:** emails received in the clinic's shared M365 mailbox (e.g. \`reception@<clinic>.com.au\`).
- **Per email, we read:** subject, sender display name + address, received timestamp, and the **first 500 characters** of the body.
- **We do not read:** attachments, full email bodies, or any other mailbox content.

The auto-log writes one row per email into a SharePoint list owned by the
clinic. The receptionist and practice manager work that list directly. No
patient data is moved to any third-party system outside the clinic's M365
tenant.`,

  `## Where data lives

| Data | Location | Region |
|---|---|---|
| Email content (full) | Clinic's Exchange Online mailbox | Same M365 region as the tenant |
| Auto-log row (subject, sender, classification) | Clinic's SharePoint list | Same M365 region as the tenant |
| LLM classification call | Azure OpenAI — Australia East | Australia |
| LLM training | **Disabled** — Azure OpenAI does not use customer prompts/completions for model training | n/a |

For the POC, all processing runs in **SMEC AI's tenant** against
\`demonstration@smecai.au\`, in Microsoft 365 Australia. No real patient data
is used.`,

  `## Australian Privacy Principles (APPs) alignment

| APP | Title | How the system addresses it |
|---|---|---|
| APP 1 | Open and transparent management | This page; SharePoint version history exposes every change |
| APP 6 | Use or disclosure | Patient data is used only to classify and log; no disclosure outside the clinic's tenant |
| APP 8 | Cross-border disclosure | **No cross-border transfer.** AI inference runs in Azure OpenAI Australia East. M365 tenant data residency = Australia |
| APP 11 | Security of personal information | Existing M365 RBAC + MFA; SharePoint list inherits site permissions; no new credential surface |
| APP 12 | Access to personal information | Existing M365 / Outlook access mechanisms apply unchanged |
| APP 13 | Correction | Receptionist edits the row inline (Type, Status, Notes); SharePoint version history retains corrections |

**The system introduces no new identity surface** — every actor is an existing
M365 user authenticated by the clinic's existing AAD/Entra ID, with the same
controls (MFA, conditional access) that already protect the mailbox.`,

  `## AI provider obligations

- **Provider:** Microsoft Azure OpenAI Service (deployed in Australia East).
- **Data residency:** prompts and completions stay in the Australia East region.
- **Retention:** Azure OpenAI retains prompts and completions for up to 30 days
  for abuse monitoring (Microsoft staff cannot read this data without a
  documented abuse investigation), then deletes. **Abuse monitoring can be
  disabled via a Microsoft-approved exemption** for healthcare workloads when
  required by the deployment.
- **Training:** Microsoft does **not** use customer data to train, retrain, or
  improve foundation models. This is contractual, not a setting.
- **Authentication:** AAD-only via Managed Identity / DefaultAzureCredential.
  No API keys are stored in the repo or in the runtime config.`,

  `## Audit trail and retention

- The SharePoint list has **versioning enabled**. Every change to a row
  (classification override, status change, notes edit) is captured with the
  user's M365 identity and a timestamp.
- The original AI classification is recoverable from version history if a
  receptionist override is ever questioned.
- Default retention for the list is the clinic's tenant-level retention policy
  (typically 7 years for clinical correspondence records under Australian
  state-based health-records legislation, e.g. NSW Health Records and
  Information Privacy Act 2002, ACT Health Records (Privacy and Access) Act
  1997).
- Emails themselves remain in the Exchange Online mailbox under whatever
  Exchange retention policies the clinic already applies — this system does
  not modify them.`,

  `## What this system does NOT do

- It does **not** auto-reply to patients.
- It does **not** trigger downstream actions (no auto-booking, no auto-billing,
  no claim submission).
- It does **not** export data to any system outside the clinic's M365 tenant.
- It does **not** delete or modify any email in the mailbox.

The mandate is **visibility, not automation**. The receptionist remains the
decision-maker on every row.`,

  `## Disclosures to make to patients (recommended wording)

For inclusion in the clinic's privacy collection notice and website:

> "Emails received at our reception inbox are automatically logged into a
> secure tracking system to help us monitor and respond to clinical referrals.
> An AI tool, hosted in Australia by Microsoft, is used to suggest a
> classification for each email (e.g. Referral vs general enquiry). Final
> handling is always done by clinic staff. Your email content is processed
> only within Australia and is not used to train any AI model. Email content
> is retained in line with our broader records retention policy."

This wording can be folded into the clinic's existing Privacy Collection
Statement at intake / patient registration.`,

  `## Open issues / decisions for the clinic

- [ ] Confirm tenant region as Australia for the M365 subscription.
- [ ] Confirm whether to disable Azure OpenAI abuse-monitoring retention via
      Microsoft's healthcare exemption process.
- [ ] Update the clinic's Privacy Collection Statement to mention AI-assisted
      email classification (suggested wording above).
- [ ] Decide who has access to the SharePoint list (receptionist + practice
      manager + clinical lead, typically).
- [ ] Decide list retention period (default: inherit from tenant policy).`,

  `## Owner

Sean O'Reilly (SMEC AI), \`sean@smecai.au\`. Source: this repository includes
a build-session learnings document at \`docs/learnings.md\` and the
implementation plan at \`docs/plans/reception-inbox-mvp.md\`.`,
];

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

for (const [i, section] of sections.entries()) {
  console.log(`→ adding section ${i + 1}/${sections.length}`);
  await $`m365 spo page text add --webUrl ${webUrl} --pageName ${pageName} --text ${section}`.quiet();
}

console.log(`→ publishing page`);
await $`m365 spo page set --webUrl ${webUrl} --name ${pageName} --publish`.quiet();

console.log(`\n✓ compliance page ready`);
console.log(`  ${webUrl}/SitePages/${pageName}`);
