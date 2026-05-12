# Reception Inbox Auditor — Customer Deployment Playbook

This document walks a customer's IT admin and the SMEC AI engineer through a
single-tenant production install. Total wall-clock time: ~45 minutes assuming
prerequisites are ready.

All resources land inside **the customer's** Azure subscription and M365
tenant — no data leaves their boundary. Stays inside Australia East for AU
Privacy Act / APP 8 compliance.

---

## 1. Prerequisites (do these days before)

These can take 24-72 hours and must be done before the install session.

| Item | Owner | Notes |
|---|---|---|
| Azure subscription with Owner permission for the deployer | Customer IT | Used for resource creation + RBAC |
| Azure OpenAI resource provisioned in Australia East | Customer IT | Quota request can take 24-72h; deploy `gpt-4.1-nano` (or compatible) |
| SharePoint site already created (e.g. `/sites/Reception`) | Customer IT | The list + hub page get provisioned into this site |
| Watched mailbox converted to SharedMailbox type | Customer IT | `Set-Mailbox -Identity reception@clinic.example -Type Shared` in Exchange Online |
| Global Admin (or Privileged Role Admin) availability for 10 mins | Customer IT | Needed to grant admin consent + run one PowerShell command |
| `m365` CLI, `az` CLI, `func` Core Tools v4 installed on engineer's workstation | SMEC AI | `npm install -g @microsoft/mgt-cli @azure/cli azure-functions-core-tools@4` |

---

## 2. Day-of installation

### Engineer side

1. Clone the repo locally and `bun install`
2. `m365 login` — sign in as a user who can create app registrations in the customer tenant (the customer admin may need to do this if the engineer is external)
3. `az login` — sign in to the customer's Azure subscription
4. Run `bun run package:init`

The setup CLI walks through 11 steps and prompts for confirmation between
each. It is idempotent — safe to re-run if interrupted.

### Customer admin side

Two interventions during install:

1. **Click an admin consent URL** the engineer pastes. Grants the app `Mail.Read` (Application) and `Sites.Selected` (Application).
2. **Run one Exchange Online PowerShell command** to scope `Mail.Read` to just the watched mailbox (least privilege). The engineer provides the exact paste.

```powershell
Connect-ExchangeOnline -UserPrincipalName <admin>@<tenant>.onmicrosoft.com
New-ApplicationAccessPolicy -AppId <appId> -PolicyScopeGroupId <watchedMailbox> -AccessRight RestrictAccess -Description "Reception Inbox Auditor — scoped"
```

### What the script does, step by step

| # | Step | Reversible? |
|---|---|---|
| 1 | Gather tenant + resource info from engineer prompts | yes — re-run to change |
| 2 | Verify `m365`, `az`, `func` CLIs are installed and logged in | n/a |
| 3 | Create app registration (or find existing) + client secret | yes — `az ad app delete --id <appId>` |
| 4 | Wait for customer admin to grant consent | n/a |
| 5 | Wait for customer admin to apply Application Access Policy | reversible — `Remove-ApplicationAccessPolicy` |
| 6 | Grant app `Sites.Selected` write permission on the SharePoint site | reversible — `m365 spo site apppermission remove` |
| 7 | Write `.env` (mode 0600, contains client secret) | safe to delete after install |
| 8 | Provision SharePoint list + hub page (`bun run list:create`, `bun run hub`) | reversible — `bun run list:teardown` |
| 9 | Write `infra/main.parameters.json` from prompts (mode 0600) | safe to delete after install |
| 10 | Deploy bicep template (Function App + Storage + Key Vault + RBAC) | reversible — `az group delete --name rg-<prefix>-<env>` |
| 11 | Build + publish Function code via `func azure functionapp publish` | overwritten by next publish |

---

## 3. Validation

After step 11 completes:

1. Send a test email to the watched mailbox from any sender outside the tenant
2. Tail the Function log:
   ```bash
   az functionapp log tail --name <function-app-name> --resource-group rg-<prefix>-<env>
   ```
3. Within 5 minutes you'll see `[reception-poll] start ... fetched=1 inserted=1`
4. Refresh the SharePoint hub page — the new email appears in the Inbox list, and after `bun run hub` is re-run the pie chart updates

---

## 4. Compliance

This deployment aligns with the Australian Privacy Principles documented on
the SharePoint **Compliance & Privacy** page that the install creates. Key
points:

- **APP 1 (Open and transparent management)** — privacy collection notice on the SharePoint page
- **APP 5 (Notification of collection)** — only email metadata + subject/from/preview are read; no full bodies
- **APP 6 (Use and disclosure)** — data used only for inbox triage classification
- **APP 8 (Cross-border)** — all data stays in Australia East: Azure OpenAI, Function App, Storage, SharePoint
- **APP 11 (Security)** — secret in Key Vault, RBAC via managed identity, no broad mailbox or site permissions

---

## 5. Rollback

To remove the entire deployment:

```bash
# Remove SharePoint list (data) — destructive
bun run list:teardown

# Remove Azure resources
az group delete --name rg-<prefix>-<env> --yes --no-wait

# Remove app registration
az ad app delete --id <appId>

# Remove Application Access Policy (in Exchange Online PowerShell)
Remove-ApplicationAccessPolicy -Identity <policyId>

# Remove SharePoint site Sites.Selected grant
m365 spo site apppermission remove --siteUrl https://<host>/sites/<site> --appId <appId>
```

The SharePoint site itself is **not** removed — it predates the install.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Function 401 reading Graph | Admin consent not granted, or Application Access Policy missing | Re-run steps 4 + 5 |
| Function 403 writing SharePoint | Sites.Selected not granted on this site | Re-run step 6 |
| Function 401 on Azure OpenAI | Role assignment not propagated yet | Wait 5 mins; restart Function App |
| Cursor doesn't advance | Table Storage write failing | Check Function MSI has `Storage Table Data Contributor` on the storage account |
| Stats page out of date | Hub page is a snapshot | Run `bun run hub` locally (or schedule a daily build) |
| Mailbox returns no messages | Mailbox is `UserMailbox`, not `SharedMailbox` | `Set-Mailbox -Type Shared` in Exchange Online |

---

## 7. Cost estimate

For a single-clinic deployment at typical reception inbox volume (<100 emails/day):

| Resource | Tier | Estimated monthly cost (AUD) |
|---|---|---|
| Function App | Consumption | $0 (within free grant) |
| Storage Account | LRS, <1 GB | $0.05 |
| Key Vault | Standard, ~30 ops/day | $0.10 |
| Application Insights | Default sampling | $0–2 |
| Azure OpenAI gpt-4.1-nano | ~10K tokens/day | $0.50–2 |
| **Total** |  | **~$1–5/month** |

The customer pays this directly on their Azure subscription. SMEC AI does not
hold any customer data or credentials.
