# Reception Inbox Auditor — POC

POC for **Canberra Dizziness Clinic** (Dr Sandeep Rajagopal). Watches a shared
M365 mailbox, classifies each email as Referral / Other via Azure OpenAI, and
upserts into a SharePoint list that the receptionist works directly.

**Demo target:** May 13, 2026
**Demo mailbox:** `demonstration@smecai.au` (SMEC AI test tenant)
**Plan:** [docs/plans/reception-inbox-mvp.md](docs/plans/reception-inbox-mvp.md)
**Handout:** [docs/handouts/2026-05-13-poc-onepager.md](docs/handouts/2026-05-13-poc-onepager.md)

## Stack

- **Runtime:** Bun + TypeScript strict
- **Mail/Lists:** Microsoft Graph (delegated), m365 CLI for SP writes
- **Classification:** Azure OpenAI `gpt-4.1-nano`, Australia East, AAD auth
- **Auth:** piggybacks on `m365 login` (no separate app registration) and
  `az login` (DefaultAzureCredential for Azure OpenAI)

## Setup (one-time, already done in SMEC tenant)

```bash
# 1. Authenticate the local CLIs
m365 login                                    # browser auth as sean@smecai.au
az login                                      # browser auth as sean@smecai.au

# 2. Grant Sean the data-plane role on Azure OpenAI
bash scripts/grant-openai-role.sh

# 3. Convert demo mailbox to Shared and grant Sean Full Access
bash scripts/grant-mailbox-access.sh
bash scripts/convert-to-shared.sh

# 4. Provision the SharePoint list
bun install
bun run list:create
```

## Running

```bash
# Send 20 fabricated test emails (referrals + other)
bun run seed

# Run the auto-log loop once (poll, classify, upsert)
bun run start
```

For continuous polling, wrap `bun run start` in a launchd job, cron, or `watch`.

## Rollback

| What | How |
|---|---|
| Code changes | `git revert <commit>` |
| SharePoint list | `bun run list:teardown` |
| Mailbox conversion (Shared → Regular) | `Set-Mailbox demonstration@smecai.au -Type Regular` (EXO PS) |
| OpenAI role assignment | `az role assignment delete --assignee sean@smecai.au --role 'Cognitive Services OpenAI User' --scope ...` |
| Mailbox delegation | `Remove-MailboxPermission -Identity demonstration@smecai.au -User sean@smecai.au -AccessRights FullAccess` |

## Layout

```
src/
  config.ts        env config (lazy validation per script)
  graph.ts         Microsoft Graph wrapper (mail read + send)
  classify.ts      Azure OpenAI classifier
  sharepoint.ts    Idempotent upsert by Internet Message ID
  auto-log.ts      Main loop entry
scripts/
  create-list.ts          provision SP list (idempotent)
  teardown-list.ts        rollback SP list
  seed-emails.ts          send 20 synthetic test emails
  test-graph.ts           smoke test mailbox reader
  test-classify.ts        smoke test classifier
  test-sharepoint.ts      smoke test SP upsert + dedup
  grant-openai-role.sh    one-shot Azure RBAC grant
  grant-mailbox-access.sh one-shot EXO mailbox delegation
  convert-to-shared.sh    one-shot EXO mailbox type conversion
docs/
  plans/                  the original plan
  agendas/                meeting agendas
  handouts/               one-pagers for Sandeep
  transcripts/            discovery call transcripts
```

## Production path

The Bun script is a POC. For real-clinic deployment, port the same logic to a
**Power Automate flow** in the clinic's M365 tenant. The Azure OpenAI prompt and
SharePoint schema carry over unchanged.
