#!/usr/bin/env bun
/**
 * Interactive setup CLI for deploying the Reception Inbox Auditor into a
 * customer's M365 tenant + Azure subscription.
 *
 * Run as the SMEC AI engineer, paired with the customer's admin. The engineer
 * needs:
 *   - m365 CLI logged into the customer tenant (m365 login)
 *   - az CLI logged into the customer's Azure subscription (az login)
 *   - Azure Functions Core Tools v4 (func --version)
 *
 * The customer admin needs to be available for:
 *   - Clicking the admin consent URL
 *   - Running one Exchange Online PowerShell command (New-ApplicationAccessPolicy)
 *
 * Idempotent: each step checks for existing resources before creating.
 */
import { $ } from "bun";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DIVIDER = "─".repeat(70);

function header(s: string): void {
  console.log(`\n${DIVIDER}\n  ${s}\n${DIVIDER}`);
}

async function prompt(label: string, fallback?: string): Promise<string> {
  const hint = fallback ? ` [${fallback}]` : "";
  process.stdout.write(`${label}${hint}: `);
  for await (const chunk of Bun.stdin.stream()) {
    const v = new TextDecoder().decode(chunk).trim();
    return v || fallback || "";
  }
  return fallback ?? "";
}

async function confirm(label: string): Promise<boolean> {
  const v = (await prompt(`${label} (y/N)`, "n")).toLowerCase();
  return v === "y" || v === "yes";
}

// ─── Required permissions ─────────────────────────────────────────
// Microsoft Graph API id is well-known.
const GRAPH_APP_ID = "00000003-0000-0000-c000-000000000000";
// Application permission scope IDs:
const MAIL_READ_APP_ROLE = "810c84a8-4a9e-49e6-bf7d-12d183f40d01"; // Mail.Read
const SITES_SELECTED_ROLE = "883ea226-0bf2-4a8f-9f9d-92c9162a727d"; // Sites.Selected

type Params = {
  m365TenantId: string;
  watchedMailbox: string;
  sharePointHostname: string;
  sharePointSitePath: string;
  sharePointListName: string;
  azureOpenAIEndpoint: string;
  azureOpenAIDeployment: string;
  azureOpenAIResourceId: string;
  azureSubscriptionId: string;
  azureLocation: string;
  namePrefix: string;
  env: string;
};

async function gather(): Promise<Params> {
  header("Step 1 — Tenant & resource info");
  console.log("Press enter to accept the default shown in [brackets].\n");

  const m365TenantId = await prompt("Customer M365 tenant ID");
  const watchedMailbox = await prompt("Watched shared mailbox (e.g. reception@clinic.example)");
  const sharePointHostname = await prompt("SharePoint hostname (e.g. clinic.sharepoint.com)");
  const sharePointSitePath = await prompt("SharePoint site path", "/sites/Reception");
  const sharePointListName = await prompt("SharePoint list display name", "Reception Email Tracker");
  const azureOpenAIEndpoint = await prompt("Azure OpenAI endpoint URL");
  const azureOpenAIDeployment = await prompt("Azure OpenAI deployment name", "gpt-4.1-nano");
  const azureOpenAIResourceId = await prompt("Azure OpenAI resource ID (full ARM ID)");
  const azureSubscriptionId = await prompt("Azure subscription ID");
  const azureLocation = await prompt("Azure region", "australiaeast");
  const namePrefix = await prompt("Resource name prefix (3-10 lowercase alphanumeric)", "recept");
  const env = await prompt("Environment suffix", "prod");

  return {
    m365TenantId,
    watchedMailbox,
    sharePointHostname,
    sharePointSitePath,
    sharePointListName,
    azureOpenAIEndpoint,
    azureOpenAIDeployment,
    azureOpenAIResourceId,
    azureSubscriptionId,
    azureLocation,
    namePrefix,
    env,
  };
}

async function checkPrereqs(p: Params): Promise<void> {
  header("Step 2 — Verify prerequisites");

  const required = ["m365", "az", "func"];
  for (const cmd of required) {
    try {
      await $`which ${cmd}`.quiet();
      console.log(`  ✓ ${cmd} on PATH`);
    } catch {
      throw new Error(`Missing required CLI: ${cmd}. Install before continuing.`);
    }
  }

  // Confirm az is pointing at the right subscription
  await $`az account set --subscription ${p.azureSubscriptionId}`.quiet();
  const acct = await $`az account show --output json`.quiet();
  const { tenantId, name } = JSON.parse(acct.stdout.toString()) as { tenantId: string; name: string };
  console.log(`  ✓ Azure subscription "${name}" (${tenantId})`);
  if (tenantId.toLowerCase() !== p.m365TenantId.toLowerCase()) {
    console.log(`  ⚠ Azure tenant (${tenantId}) differs from M365 tenant (${p.m365TenantId}).`);
    console.log(`    This is OK if the customer's Azure subscription is in a different tenant.`);
  }
}

async function createOrFindAppRegistration(p: Params): Promise<{ appId: string; clientSecret: string; objectId: string }> {
  header("Step 3 — App registration (Graph app-only auth)");

  const appName = `Reception Inbox Auditor (${p.env})`;
  const existing = await $`az ad app list --display-name ${appName} --output json`.quiet();
  const apps = JSON.parse(existing.stdout.toString()) as Array<{ appId: string; id: string }>;

  let appId: string;
  let objectId: string;

  if (apps.length > 0) {
    appId = apps[0]!.appId;
    objectId = apps[0]!.id;
    console.log(`  · App reg "${appName}" already exists (appId=${appId})`);
  } else {
    const create = await $`az ad app create --display-name ${appName} --sign-in-audience AzureADMyOrg --output json`.quiet();
    const created = JSON.parse(create.stdout.toString()) as { appId: string; id: string };
    appId = created.appId;
    objectId = created.id;
    console.log(`  ✓ Created app reg (appId=${appId})`);

    // Add Mail.Read + Sites.Selected permissions
    await $`az ad app permission add --id ${appId} --api ${GRAPH_APP_ID} --api-permissions ${MAIL_READ_APP_ROLE}=Role ${SITES_SELECTED_ROLE}=Role`.quiet();
    console.log(`  ✓ Added Mail.Read + Sites.Selected (application)`);
  }

  // Ensure service principal exists for this app in this tenant
  try {
    await $`az ad sp show --id ${appId} --output json`.quiet();
  } catch {
    await $`az ad sp create --id ${appId}`.quiet();
    console.log(`  ✓ Created service principal`);
  }

  // Create a client secret (idempotent — adds a new one each run; prompts to skip if user already has one)
  let clientSecret = "";
  const skipSecret = await confirm("App reg already has a client secret you'd like to reuse?");
  if (skipSecret) {
    clientSecret = await prompt("Paste existing client secret");
  } else {
    const sec = await $`az ad app credential reset --id ${appId} --display-name "auto-${Date.now()}" --years 2 --output json`.quiet();
    const parsed = JSON.parse(sec.stdout.toString()) as { password: string };
    clientSecret = parsed.password;
    console.log(`  ✓ Created new client secret (expires in 2 years)`);
    console.log(`    Saved to .env — DO NOT commit .env to source control.`);
  }

  return { appId, clientSecret, objectId };
}

function consentUrl(p: Params, appId: string): string {
  return `https://login.microsoftonline.com/${p.m365TenantId}/adminconsent?client_id=${appId}`;
}

async function waitForAdminConsent(p: Params, appId: string): Promise<void> {
  header("Step 4 — Customer admin consents to app permissions");

  console.log("Send this URL to the customer admin (Global Admin or Privileged Role Admin):\n");
  console.log(`  ${consentUrl(p, appId)}\n`);
  console.log("They will be prompted to grant: Mail.Read (Application), Sites.Selected (Application).\n");
  console.log("Wait here until they confirm they've granted consent.");

  const ok = await confirm("Has the customer admin granted consent?");
  if (!ok) throw new Error("Admin consent is required before continuing. Re-run when ready.");
}

function applicationAccessPolicyScript(p: Params, appId: string): string {
  return `
Connect-ExchangeOnline -UserPrincipalName <admin>@${p.sharePointHostname.replace(".sharepoint.com", ".onmicrosoft.com")}

# Limit the app to ONLY read the watched mailbox (least privilege)
New-ApplicationAccessPolicy \`
  -AppId ${appId} \`
  -PolicyScopeGroupId ${p.watchedMailbox} \`
  -AccessRight RestrictAccess \`
  -Description "Reception Inbox Auditor — scoped to watched mailbox only"

# Verify
Test-ApplicationAccessPolicy -Identity ${p.watchedMailbox} -AppId ${appId}
`.trim();
}

async function configureApplicationAccessPolicy(p: Params, appId: string): Promise<void> {
  header("Step 5 — Scope Mail.Read to the watched mailbox only");

  console.log("Mail.Read (Application) reads ANY mailbox by default. We restrict it to");
  console.log("just the watched mailbox via Application Access Policy (Exchange Online).\n");
  console.log("Ask the customer's Exchange Admin to run this PowerShell:\n");
  console.log(applicationAccessPolicyScript(p, appId));
  console.log("");

  const ok = await confirm("Has the Application Access Policy been applied?");
  if (!ok) throw new Error("Run the PowerShell above and re-run this script when done.");
}

async function grantSiteSelected(p: Params, appId: string): Promise<void> {
  header("Step 6 — Grant app write access to the SharePoint site");

  console.log("Sites.Selected gives the app NO access by default — we must grant per-site.");
  console.log(`Granting write access to https://${p.sharePointHostname}${p.sharePointSitePath}\n`);

  const siteUrl = `https://${p.sharePointHostname}${p.sharePointSitePath}`;
  try {
    await $`m365 spo site apppermission add --siteUrl ${siteUrl} --appId ${appId} --appDisplayName "Reception Inbox Auditor" --permission write`.quiet();
    console.log(`  ✓ Granted write permission on ${siteUrl}`);
  } catch (err) {
    console.log(`  ⚠ Grant failed (may already exist): ${(err as Error).message}`);
  }
}

async function writeEnvFile(p: Params, appId: string, clientSecret: string): Promise<void> {
  header("Step 7 — Write .env for local provisioning scripts");

  const lines = [
    `# Generated by scripts/package-init.ts on ${new Date().toISOString()}`,
    `M365_TENANT_ID=${p.m365TenantId}`,
    `M365_CLIENT_ID=`,
    `WATCHED_MAILBOX=${p.watchedMailbox}`,
    ``,
    `GRAPH_AUTH_MODE=app`,
    `GRAPH_CLIENT_ID=${appId}`,
    `GRAPH_CLIENT_SECRET=${clientSecret}`,
    ``,
    `SP_HOSTNAME=${p.sharePointHostname}`,
    `SP_SITE_PATH=${p.sharePointSitePath}`,
    `SP_LIST_NAME=${p.sharePointListName}`,
    ``,
    `AZURE_OPENAI_ENDPOINT=${p.azureOpenAIEndpoint}`,
    `AZURE_OPENAI_DEPLOYMENT=${p.azureOpenAIDeployment}`,
    `AZURE_OPENAI_API_VERSION=2024-08-01-preview`,
    ``,
    `# Local provisioning uses file cursor; Function App uses table (see bicep)`,
    `CURSOR_STORE=file`,
    `CURSOR_FILE_PATH=.state/cursor.json`,
    ``,
  ].join("\n");

  if (existsSync(".env")) {
    const overwrite = await confirm(".env already exists — overwrite?");
    if (!overwrite) {
      console.log("  · Keeping existing .env");
      return;
    }
  }
  await writeFile(".env", lines, { mode: 0o600 });
  console.log("  ✓ Wrote .env (mode 0600)");
}

async function provisionList(): Promise<void> {
  header("Step 8 — Provision SharePoint list + hub page");
  console.log("Running bun run list:create ...");
  await $`bun run list:create`;
  console.log("\nRunning bun run hub ...");
  await $`bun run hub`;
}

async function writeBicepParams(p: Params, appId: string, clientSecret: string): Promise<void> {
  header("Step 9 — Write infra/main.parameters.json");

  const params = {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    contentVersion: "1.0.0.0",
    parameters: {
      namePrefix: { value: p.namePrefix },
      env: { value: p.env },
      location: { value: p.azureLocation },
      m365TenantId: { value: p.m365TenantId },
      watchedMailbox: { value: p.watchedMailbox },
      sharePointHostname: { value: p.sharePointHostname },
      sharePointSitePath: { value: p.sharePointSitePath },
      sharePointListName: { value: p.sharePointListName },
      azureOpenAIEndpoint: { value: p.azureOpenAIEndpoint },
      azureOpenAIDeployment: { value: p.azureOpenAIDeployment },
      azureOpenAIResourceId: { value: p.azureOpenAIResourceId },
      graphClientId: { value: appId },
      graphClientSecret: { value: clientSecret },
    },
  };
  await writeFile("infra/main.parameters.json", JSON.stringify(params, null, 2), { mode: 0o600 });
  console.log("  ✓ Wrote infra/main.parameters.json (mode 0600 — contains secret)");
}

async function deployBicep(p: Params): Promise<void> {
  header("Step 10 — Deploy Azure infrastructure");
  console.log(`Running az deployment sub create in ${p.azureLocation} ...`);
  await $`az deployment sub create --location ${p.azureLocation} --template-file infra/main.bicep --parameters @infra/main.parameters.json --output table`;
}

async function getFunctionAppName(): Promise<string> {
  const out = await $`az deployment sub show --name main --query properties.outputs.functionAppName.value --output tsv`.quiet().nothrow();
  const name = out.stdout.toString().trim();
  if (!name) throw new Error("Could not read functionAppName from deployment output.");
  return name;
}

async function publishFunction(): Promise<void> {
  header("Step 11 — Build and publish Function code");

  console.log("Building (tsc -p tsconfig.fn.json) ...");
  await $`bun run fn:clean`.nothrow();
  await $`bun run fn:build`;

  const fnName = await getFunctionAppName();
  console.log(`Publishing to ${fnName} ...`);
  await $`func azure functionapp publish ${fnName} --no-build`;
}

async function printValidation(p: Params): Promise<void> {
  header("Done — validation");
  console.log(`
1. Send a test email to ${p.watchedMailbox} from any sender.
2. Watch the Function log stream:
     az functionapp log tail --name <function-app-name> --resource-group rg-${p.namePrefix}-${p.env}
3. Within 5 minutes you should see a row appear in:
     https://${p.sharePointHostname}${p.sharePointSitePath}/Lists/${encodeURIComponent(p.sharePointListName)}/Reception%20View.aspx
4. Refresh stats: bun run hub  (regenerates SVG pie + count)

Rollback:
  bun run list:teardown      # remove SharePoint list
  az group delete --name rg-${p.namePrefix}-${p.env} --yes  # remove Azure resources
`);
}

async function main(): Promise<void> {
  header("Reception Inbox Auditor — packaged install");
  console.log("This script will configure a customer-tenant deployment.\n");
  if (!(await confirm("Continue?"))) return;

  const p = await gather();
  await checkPrereqs(p);
  const { appId, clientSecret } = await createOrFindAppRegistration(p);
  await waitForAdminConsent(p, appId);
  await configureApplicationAccessPolicy(p, appId);
  await grantSiteSelected(p, appId);
  await writeEnvFile(p, appId, clientSecret);
  await provisionList();
  await writeBicepParams(p, appId, clientSecret);
  await deployBicep(p);
  await publishFunction();
  await printValidation(p);
}

await main();
