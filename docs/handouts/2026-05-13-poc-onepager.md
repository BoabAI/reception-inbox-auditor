# Reception Inbox Auditor — POC Handout

**Client:** Dr Sandeep Rajagopal, Canberra Dizziness Clinic
**Date:** Wednesday 2026-05-13
**Demo mailbox:** demonstration@smecai.au (SMEC AI test tenant)

---

## What it does

A single shared reception inbox is watched by an automated logger. Every email
that arrives is auto-recorded into a SharePoint list. AI pre-classifies each
email as **Referral** or **Other**. The receptionist works the list — confirming
or correcting the classification, setting **Status** (`New` → `In Progress` →
`Action Completed`), and adding notes. The practice manager opens the same list
and sees the same view. Same grid, same data, no separate dashboard.

The pitch: **visibility, not automation**. Sandeep wants to know what got missed,
not eliminate the receptionist's workflow.

## What you will see today

1. Live demo of the shared inbox at `demonstration@smecai.au`.
2. The SharePoint list "Reception Email Tracker" with 22 logged emails:
   - 7 referrals (HealthLink-style, GP letters with PDFs, plain-text referrals)
   - 15 other (rebookings, billing queries, marketing, phishing, patient queries)
3. The single shared view, grouped by Status, sorted by Received (newest first):
   - "New" group expanded — receptionist works rows top-down here
   - "In Progress" group below
   - "Action Completed" group collapsed by default — Sandeep expands for the audit trail
4. Inline grid edit: change Type / Status / Notes directly in the list, no separate form.

## Architecture

```
demonstration@smecai.au (M365 shared mailbox)
        │
        ▼
Auto-log script (Bun + TypeScript)
   • triggers on new mail (poll-based for POC; production = Power Automate flow)
   • calls Azure OpenAI gpt-4.1-nano (Australia East) for classification
   • upserts row in SharePoint list (idempotent on Internet Message ID)
        │
        ▼
SharePoint list "Reception Email Tracker"  (source of truth)
        │
        ▼
Single shared view — used by receptionist AND manager
   • Grouped by Status (Action Completed group collapsed by default)
   • Sorted by Received desc within each group
   Receptionist works rows top-down in the "New" group.
   Sandeep scrolls / expands "Action Completed" for the audit trail.
```

## Production path

This POC uses a polling Bun script for speed. For Canberra Dizziness Clinic
production:
- Same logic ports to a **Power Automate flow** (no code, runs in clinic's M365 tenant).
- Or **Azure Function** (timer trigger) if the clinic gets an Azure subscription.
- The classification prompt and SharePoint schema carry over unchanged.

All AI inference stays in Australia (Azure OpenAI Australia East) — meets
Australian Privacy Act / APP 8 obligations for patient data.

## Schema (SharePoint list)

| Column      | Type             | Purpose                                         |
|-------------|------------------|-------------------------------------------------|
| Title       | Text             | Email subject                                   |
| MessageId   | Text (indexed)   | Internet Message ID — primary deduplication key |
| From        | Text             | Sender display + address                        |
| Received    | DateTime         | When the email arrived                          |
| Type        | Choice           | Referral / Other / Unclassified                 |
| Status      | Choice           | New / In Progress / Action Completed            |
| Notes       | Multi-line text  | Receptionist's free-text notes                  |
| EmailLink   | Hyperlink        | One-click jump back to original email in OWA    |

Versioning is enabled — every edit is auditable (who, what, when).

## What's next

If Sandeep approves the POC:

1. Stand up a shared mailbox `reception@canberradizziness.com.au` in the clinic's tenant.
2. Provision an Azure OpenAI deployment in clinic tenant (Australia East).
3. Build the Power Automate flow with the same logic as the POC script.
4. Train receptionist + practice manager on the list view.
5. Soft-launch with a 2-week shadow period; review classification accuracy and override patterns.

---

*Prepared by Sean O'Reilly, SMEC AI · sean@smecai.au*
