# Reception Inbox Auditor — POC Plan

**Client:** Dr Sandeep Rajagopal, Canberra Dizziness Clinic
**Author:** Sean O'Reilly (SMEC AI)
**Source:** Discovery call 2026-04-29 (`docs/transcripts/Sandeep Rajagopal - 30 minute meeting _ Meeting Notes Export.md`)
**Follow-up:** Wednesday 2026-05-13, 4:00 PM

---

## 1. What it does

Watches a single shared reception inbox in Microsoft 365. Auto-logs every email to a SharePoint list. AI pre-classifies each email as **Referral** or **Other**. The receptionist works the list directly (Microsoft Lists / SharePoint Quick Edit) — confirming/overriding classification, setting Status (`New` / `In Progress` / `Action Completed`), and adding notes. The practice manager gets a SharePoint list view that shows what's open, what's overdue, and the inbound mix.

The pitch is **visibility, not automation** — Sandeep wants to know what got missed, not eliminate the receptionist's workflow.

## 2. POC scope (where we are now)

**The POC runs entirely inside SMEC AI's own M365 tenant against a synthetic test inbox.** No clinic data is touched. No patient data is processed. The POC is a working demo we show on May 13.

Synthetic test data: ~20 fabricated emails covering referrals (HealthLink-style, GP letters with PDFs, plain-text referrals) and other (rebooking requests, billing, marketing, spam).

This decision keeps the POC simple, fast, and outside any patient-data compliance scope.

## 3. Architecture

```
SMEC AI test inbox (M365)
        │
        ▼
Power Automate "Auto-log" flow
   • triggers on new mail
   • calls Azure OpenAI (AU East) for classification
   • upserts row in SharePoint list (idempotent on Internet Message ID)
        │
        ▼
SharePoint list "Reception Email Tracker"  (source of truth)
        │
        ├──────► Receptionist
        │       Microsoft Lists / SharePoint Quick Edit — pinned in Teams or browser
        │       Filtered view "My queue" (Status = New, sorted by Received desc)
        │       Edits Type / Status / Notes directly in the grid or edit form
        │
        └──────► Manager (Sandeep)
                SharePoint list view grouped by Status, filtered by date
                Optional: daily digest email of open items
```

Four components, all M365/Azure-native:
- Shared mailbox (existing in SMEC tenant)
- Power Automate auto-log flow (the only flow)
- Azure OpenAI deployment in Australia East (in SMEC subscription)
- SharePoint list with versioning enabled, plus filtered views for receptionist and manager

## 4. SharePoint list schema

Idempotency is enforced via **Internet Message ID** (RFC 5322 unique identifier per email). Auto-log flow does upsert-by-message-id, never blind insert.

| Column | Type | Purpose |
|---|---|---|
| `MessageId` | Single-line text, **indexed, unique** | Internet Message ID — primary deduplication key |
| `ConversationId` | Single-line text, indexed | Outlook conversation thread ID — group related emails |
| `MailboxAddress` | Single-line text | Source mailbox (future-proofs multi-mailbox) |
| `Title` | Single-line text | Email subject |
| `From` | Single-line text | Sender display + address |
| `Received` | Date/time | Email received timestamp |
| `Type` | Choice | `Referral` / `Other` / `Unclassified` (default until AI runs) |
| `TypeAISuggestion` | Choice (read-only) | Original LLM classification — preserved for audit even if user overrides |
| `TypeAIConfidence` | Number | 0–100 |
| `Status` | Choice | `New` / `In Progress` / `Action Completed` |
| `Notes` | Multi-line text | Free-text |
| `EmailLink` | Hyperlink | Web link back to original message |

Versioning enabled. Auto-log flow logic: query list for existing item where `MessageId = $msgId` → if found, skip insert; if not, insert. Status-update flow: query by `MessageId` → patch the matching item.

## 5. The single Power Automate flow

**Auto-log (idempotent)**
- Trigger: "When a new email arrives in shared mailbox"
- Step 1: Extract Internet Message ID, conversation ID, subject, from, received, web link
- Step 2: Get items from SharePoint list where `MessageId eq '<id>'` → if any results, terminate (already logged)
- Step 3: HTTP call to Azure OpenAI (AU East) with system prompt + subject + first 500 chars of body → parse JSON `{type, confidence, reason}`
- Step 4: Create item in SharePoint list with all metadata + AI suggestion + AI confidence + Type defaulted to AI suggestion + Status = `New`
- Retry/replay-safe by design: if Power Automate retries the trigger, step 2 catches the dupe.

**Receptionist's update workflow (no flow needed)**
- She opens the SharePoint list in Microsoft Lists (pinned to Teams) or browser
- Default view "My queue" filters Status = New, sorted Received desc
- She edits each row inline (Quick Edit grid) or via the standard edit form: confirm/override Type, set Status, add Notes
- SharePoint version history captures who changed what when, automatically

## 6. AI classification

Single LLM call per email at log time. Model: `gpt-4o-mini` on Azure OpenAI Australia East (in SMEC AI's subscription for the POC). Prompt:

```
System: You classify emails received at a vestibular clinic's reception inbox
as either "Referral" or "Other".

A "Referral" is an email where a doctor or healthcare professional refers a
patient to the clinic. Indicators: the word "referral" in subject/body, a
PDF attachment from a GP practice, HealthLink/Argus/Medical Objects formatting,
sender domain matching a known GP practice, body introducing a patient with
vestibular symptoms.

"Other" covers everything else: existing patients writing in, appointment
changes, results queries, billing, marketing, spam.

Reply with strict JSON: {"type": "Referral" | "Other", "confidence": 0-100, "reason": "<one short sentence>"}

User: Subject: <subject>
From: <sender>
Body (first 500 chars): <body>
```

Receptionist always has the final say via the ribbon-button form. AI suggestion is preserved in `TypeAISuggestion` so we can measure override rate.

## 7. May 13 deliverables

What Sean walks in with:

1. **Live demo** — SMEC AI test inbox; show:
   - An email arriving and auto-logging within ~30s
   - Receptionist view ("My queue") and grid-edit Status / Type / Notes inline
   - SharePoint dashboard view from the manager perspective (open >24h, weekly inbound mix)
2. **This plan as a one-pager handout**
3. **A "what production deployment looks like" page** (see §8) — so Sandeep understands what changes if he commits

## 8. What changes if Sandeep commits to deploy in his tenant

The POC runs in SMEC AI's environment on synthetic data. Moving to production in the clinic's M365 tenant introduces real patient data and triggers a separate set of requirements that are **not** part of the POC:

| Item | Owner | Notes |
|---|---|---|
| Azure OpenAI deployment in clinic's own Azure subscription (Australia East) | SMEC AI sets up; clinic owns | Required so patient email content goes only through resources the clinic controls. SMEC AI's Azure resource is not used in production. |
| Data Processing Agreement / subprocessor terms between SMEC AI and the clinic | Both | Standard short-form DPA covering build access only — SMEC AI does not retain or process patient data once handed over |
| SharePoint retention policy on the tracker list | SMEC AI configures; clinic admin grants permissions | AHPRA record-keeping (7 years). Requires Microsoft Purview admin role; verify the tenant's M365 SKU supports retention labels (Business Premium or E3+). If not, fall back to manual archival. |
| Build access (Sean as guest in clinic tenant, or screen-shared build with Sandeep driving) | Clinic decides | Either model works |
| Receptionist onboarding session (~30 min) | Sean delivers | Walk through the ribbon button + how to override AI |

Production deployment is a separate engagement from the POC. The POC validates the design; production adds the compliance scaffolding above.

## 9. Open questions for Sandeep

- M365 plan SKU (need to know if retention labels are supported under their tier)
- Azure subscription — exists, or willing to set one up
- Reception inbox volume estimate (emails/day)
- Working hours definition (so "open >24h" is calculated in business hours)
- Receptionist's current Outlook habits (categories? rules? quick steps?)

---

## Appendix — Out of scope (POC and any near-term production phase)

- Best Practice (PMS) integration — confirmed not relevant
- Multi-clinic / multi-mailbox tenancy
- Calendar-aware booking suggestions
- Outlook ribbon button / add-in (revisit only if direct list editing proves clunky in production)
- Referral PDF data extraction (patient name, DOB, GP) — useful Phase-1 enhancement, deferred
- Patient SMS / voicemail triage — separate channels, separate scope
