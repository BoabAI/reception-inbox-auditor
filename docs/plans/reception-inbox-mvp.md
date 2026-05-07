# Reception Inbox Auditor — POC Plan

**Client:** Dr Sandeep Rajagopal, Canberra Dizziness Clinic
**Author:** Sean O'Reilly (SMEC AI)
**Source:** Discovery call 2026-04-29 (`docs/transcripts/Sandeep Rajagopal - 30 minute meeting _ Meeting Notes Export.md`)
**Follow-up:** Wednesday 2026-05-13, 4:00 PM

---

## 1. What it does

Watches a single shared reception inbox in Microsoft 365. Auto-logs every email to a SharePoint list. AI pre-classifies each email as **Referral** or **Other**. The receptionist works the list directly (Microsoft Lists / SharePoint Quick Edit) — confirming/overriding classification, setting Status (`New` / `In Progress` / `Action Completed`), and adding notes. The practice manager opens the same list and sees the same view — same grid, same data, no separate dashboard.

The pitch is **visibility, not automation** — Sandeep wants to know what got missed, not eliminate the receptionist's workflow.

## 2. POC scope

The POC runs entirely inside SMEC AI's own M365 tenant against the test mailbox **`demonstration@smecai.au`**. No clinic data, no patient data. The POC is a working demo we show on May 13.

Synthetic test data: ~20 fabricated emails sent to `demonstration@smecai.au`, covering referrals (HealthLink-style, GP letters with PDFs, plain-text referrals) and other (rebooking requests, billing, marketing, spam).

## 3. Architecture

```
demonstration@smecai.au (M365 shared mailbox)
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
        ▼
Single shared view — used by receptionist AND manager
   • Grouped by Status (Action Completed group collapsed by default)
   • Sorted by Received desc within each group
   • All columns visible
   Receptionist works rows top-down in the "New" group.
   Sandeep scrolls / expands "Action Completed" for the audit trail.
```

Four components, all M365/Azure-native:
- Shared mailbox `demonstration@smecai.au` (in SMEC tenant)
- Power Automate auto-log flow (the only flow)
- Azure OpenAI deployment in Australia East (in SMEC subscription)
- SharePoint list with versioning enabled, single view for both audiences

## 4. SharePoint list schema

Idempotency is enforced via **Internet Message ID** (RFC 5322 unique identifier per email). Auto-log flow does upsert-by-message-id, never blind insert.

| Column | Type | Purpose |
|---|---|---|
| `MessageId` | Single-line text, **indexed, unique** | Internet Message ID — primary deduplication key |
| `Title` | Single-line text | Email subject |
| `From` | Single-line text | Sender display + address |
| `Received` | Date/time | Email received timestamp |
| `Type` | Choice | `Referral` / `Other` / `Unclassified` (default until AI runs; AI overwrites on log) |
| `Status` | Choice | `New` / `In Progress` / `Action Completed` |
| `Notes` | Multi-line text | Free-text |
| `EmailLink` | Hyperlink | Web link back to original message |

Versioning enabled. Auto-log flow logic: query list for existing item where `MessageId = $msgId` → if found, skip insert; if not, insert.

## 5. The single Power Automate flow

**Auto-log (idempotent)**
- Trigger: "When a new email arrives in shared mailbox"
- Step 1: Extract Internet Message ID, subject, from, received, web link
- Step 2: Get items from SharePoint list where `MessageId eq '<id>'` → if any results, terminate (already logged)
- Step 3: HTTP call to Azure OpenAI (AU East) with system prompt + subject + first 500 chars of body → parse JSON `{type, reason}`
- Step 4: Create item in SharePoint list with all metadata + Type set to AI classification + Status = `New`
- Retry/replay-safe by design: if Power Automate retries the trigger, step 2 catches the dupe.

**Receptionist's update workflow (no flow needed)**
- She opens the SharePoint list in Microsoft Lists (pinned to Teams) or browser
- Default (and only) view: grouped by Status, sorted Received desc within each group
- She works rows top-down inside the "New" group, editing Type / Status / Notes inline (Quick Edit grid) or via the standard edit form
- Sandeep opens the same list and sees the same view — no special manager dashboard
- SharePoint version history captures who changed what when, automatically

## 6. AI classification

Single LLM call per email at log time. Model: `gpt-4o-mini` on Azure OpenAI Australia East (in SMEC AI's subscription). Prompt:

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

Reply with strict JSON: {"type": "Referral" | "Other", "reason": "<one short sentence>"}

User: Subject: <subject>
From: <sender>
Body (first 500 chars): <body>
```

Receptionist always has the final say — she edits the `Type` cell directly in the list. Original AI value is recoverable from SharePoint version history if we ever want to measure override rate later.

## 7. May 13 deliverables

What Sean walks in with:

1. **Live demo** — `demonstration@smecai.au` test inbox; show:
   - An email arriving and auto-logging within ~30s
   - The single shared view (grouped by Status, sorted Received desc)
   - Grid-edit Status / Type / Notes inline as the receptionist would
   - Same view as Sandeep would see it: scroll to expand "Action Completed" for the audit trail
2. **This plan as a one-pager handout**
