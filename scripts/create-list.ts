#!/usr/bin/env bun
/**
 * Create the SharePoint list "Reception Email Tracker" used by the auto-log loop.
 * Idempotent: skips list/columns/view that already exist (checked by InternalName).
 *
 * Rollback: bun run list:teardown
 */
import { $ } from "bun";
import { config } from "../src/config.ts";

const webUrl = `https://${config.sp.hostname}${config.sp.sitePath}`;
const listTitle = config.sp.listName;

type FieldDef = {
  internalName: string;
  displayName: string;
  xml: string;
};

// Internal name == Name attribute in CAML. We rename the display name afterwards
// via spo field set so the UI reads nicely without affecting the internal name.
const fields: FieldDef[] = [
  {
    internalName: "MessageId",
    displayName: "MessageId",
    xml: `<Field Type="Text" DisplayName="MessageId" Required="TRUE" StaticName="MessageId" Name="MessageId" MaxLength="255" Indexed="TRUE" />`,
  },
  {
    internalName: "FromAddress",
    displayName: "From",
    xml: `<Field Type="Text" DisplayName="FromAddress" StaticName="FromAddress" Name="FromAddress" MaxLength="255" />`,
  },
  {
    internalName: "Received",
    displayName: "Received",
    xml: `<Field Type="DateTime" DisplayName="Received" StaticName="Received" Name="Received" Format="DateTime" />`,
  },
  {
    internalName: "EmailType",
    displayName: "Type",
    xml: `<Field Type="Choice" DisplayName="EmailType" Format="Dropdown" StaticName="EmailType" Name="EmailType">
      <CHOICES><CHOICE>Referral</CHOICE><CHOICE>Other</CHOICE><CHOICE>Unclassified</CHOICE></CHOICES>
      <Default>Unclassified</Default>
    </Field>`,
  },
  {
    internalName: "EmailStatus",
    displayName: "Status",
    xml: `<Field Type="Choice" DisplayName="EmailStatus" Format="Dropdown" StaticName="EmailStatus" Name="EmailStatus">
      <CHOICES><CHOICE>New</CHOICE><CHOICE>In Progress</CHOICE><CHOICE>Action Completed</CHOICE></CHOICES>
      <Default>New</Default>
    </Field>`,
  },
  {
    internalName: "Category",
    displayName: "Category",
    xml: `<Field Type="Choice" DisplayName="Category" Format="Dropdown" StaticName="Category" Name="Category">
      <CHOICES>
        <CHOICE>Referral - HealthLink/Argus/MedObjects</CHOICE>
        <CHOICE>Referral - GP letter</CHOICE>
        <CHOICE>Referral - Plain text / informal</CHOICE>
        <CHOICE>Referral - WorkCover/DVA</CHOICE>
        <CHOICE>Referral - Specialist handoff</CHOICE>
        <CHOICE>Patient enquiry</CHOICE>
        <CHOICE>Rebooking / cancellation</CHOICE>
        <CHOICE>Billing / Medicare</CHOICE>
        <CHOICE>Clinical result</CHOICE>
        <CHOICE>Marketing / CME</CHOICE>
        <CHOICE>Phishing / spam</CHOICE>
        <CHOICE>System (NDR, OOO, receipt)</CHOICE>
        <CHOICE>Internal admin</CHOICE>
        <CHOICE>Other</CHOICE>
      </CHOICES>
      <Default>Other</Default>
    </Field>`,
  },
  {
    internalName: "Notes",
    displayName: "Notes",
    xml: `<Field Type="Note" DisplayName="Notes" StaticName="Notes" Name="Notes" NumLines="4" RichText="FALSE" />`,
  },
  {
    internalName: "EmailLink",
    displayName: "EmailLink",
    xml: `<Field Type="URL" DisplayName="EmailLink" StaticName="EmailLink" Name="EmailLink" Format="Hyperlink" />`,
  },
];

async function listExists(): Promise<boolean> {
  const r = await $`m365 spo list get --webUrl ${webUrl} --title ${listTitle} --output json`.nothrow().quiet();
  return r.exitCode === 0;
}

async function fieldExists(internalName: string): Promise<boolean> {
  const r = await $`m365 spo field get --webUrl ${webUrl} --listTitle ${listTitle} --internalName ${internalName} --output json`
    .nothrow()
    .quiet();
  return r.exitCode === 0;
}

async function viewExists(viewTitle: string): Promise<boolean> {
  const r = await $`m365 spo list view get --webUrl ${webUrl} --listTitle ${listTitle} --title ${viewTitle} --output json`
    .nothrow()
    .quiet();
  return r.exitCode === 0;
}

async function main() {
  console.log(`Site:  ${webUrl}`);
  console.log(`List:  ${listTitle}`);

  if (await listExists()) {
    console.log("✓ list already exists — skipping create");
  } else {
    console.log("→ creating list");
    await $`m365 spo list add \
      --webUrl ${webUrl} \
      --title ${listTitle} \
      --baseTemplate GenericList \
      --enableVersioning true \
      --description "Reception inbox auditor — auto-logged emails with referral classification"`.quiet();
  }

  for (const f of fields) {
    if (await fieldExists(f.internalName)) {
      console.log(`✓ field ${f.internalName} exists — skipping`);
      continue;
    }
    console.log(`→ adding field ${f.internalName}`);
    await $`m365 spo field add --webUrl ${webUrl} --listTitle ${listTitle} --xml ${f.xml}`.quiet();

    // Rename display name if it differs from internal name
    if (f.displayName !== f.internalName) {
      console.log(`  → setting display name "${f.displayName}"`);
      await $`m365 spo field set --webUrl ${webUrl} --listTitle ${listTitle} --internalName ${f.internalName} --Title ${f.displayName}`.quiet();
    }
  }

  const viewTitle = "Reception View";
  if (await viewExists(viewTitle)) {
    console.log(`✓ view ${viewTitle} exists — skipping`);
  } else {
    console.log(`→ creating view ${viewTitle}`);
    const viewQuery = `<GroupBy Collapse="TRUE" GroupLimit="100"><FieldRef Name="EmailStatus" /></GroupBy><OrderBy><FieldRef Name="Received" Ascending="FALSE" /></OrderBy>`;
    const viewFields = "Title,FromAddress,Received,EmailType,EmailStatus,Notes,EmailLink";
    await $`m365 spo list view add \
      --webUrl ${webUrl} \
      --listTitle ${listTitle} \
      --title ${viewTitle} \
      --type list \
      --fields ${viewFields} \
      --viewQuery ${viewQuery} \
      --default`.quiet();
  }

  console.log("\n✓ list ready");
  console.log(`  ${webUrl}/Lists/${encodeURIComponent(listTitle)}`);
}

await main();
