# Reception Inbox Auditor — Follow-up Meeting

**When:** Wednesday 2026-05-13, 4:00 PM AEST
**Where:** Microsoft Teams (link in calendar invite)
**Duration:** 30 minutes

**Attendees**
- Dr Sandeep Rajagopal — Manager, Canberra Dizziness Clinic
- Sean O'Reilly — SMEC AI

**Pre-read**
- Solution plan: `docs/plans/reception-inbox-mvp.md` (sent prior to meeting)
- Discovery report from 2026-04-29

---

## Purpose

Show Sandeep a working POC built in SMEC AI's test environment, walk through what production deployment in his tenant would look like, and agree the next step.

---

## Agenda

| Time | Item | Owner |
|---|---|---|
| 0:00 – 0:03 | Welcome + 60-second recap of the discovery call | Sean |
| 0:03 – 0:13 | **Live demo** — SMEC AI test inbox: email arrives → auto-logs (idempotent on Internet Message ID) → AI classifies Referral/Other → receptionist works "My queue" view in Microsoft Lists and updates Status + Notes inline → manager dashboard view | Sean |
| 0:13 – 0:20 | What changes for production in his tenant — Azure OpenAI in his subscription, retention policy, build access, DPA. Out-of-scope items reaffirmed. | Sean |
| 0:20 – 0:25 | Sandeep's questions, concerns, must-haves | Sandeep |
| 0:25 – 0:30 | Decision + next steps | Both |

---

## Key Decisions to Land

1. **Production go/no-go** — does Sandeep want to deploy this in his clinic tenant?
2. **Build access model** — Sean as guest in clinic tenant, or screen-shared build with Sandeep driving
3. **Build window** — calendar dates if go
4. **Success criteria for production** — confirm the metrics (auto-log latency, AI override rate, receptionist time-per-email, "open >24h" dashboard signal)

---

## Pre-production Prerequisites to Confirm with Sandeep

- [ ] M365 plan SKU — does it support retention labels (Business Premium / E3+)? Determines if AHPRA 7-year retention is automatic or manual archival
- [ ] Azure subscription exists, or willingness to set one up (POC's Azure OpenAI does NOT carry over — production needs its own deployment in clinic's subscription)
- [ ] Reception inbox mailbox name + access permissions
- [ ] Approval for a short-form Data Processing Agreement covering build-time access
- [ ] Receptionist's availability for a 30-minute onboarding session post-deployment

---

## Out of Scope (Reaffirm if Asked)

- Best Practice (PMS) integration — confirmed not part of this engagement
- Multi-clinic / multi-mailbox tenancy
- Calendar-aware booking suggestions
- Outlook ribbon button / add-in (revisit only if direct list editing proves clunky in production)
- Referral PDF data extraction (deferred enhancement)
- SMS / voicemail triage

---

## Sean's Prep Checklist (Before the Meeting)

- [ ] SMEC AI test inbox provisioned in dev tenant
- [ ] Auto-log Power Automate flow live (idempotent on Internet Message ID)
- [ ] "My queue" filtered view configured for the receptionist (Status = New, sorted Received desc)
- [ ] Azure OpenAI deployment running in SMEC AI's Australia East
- [ ] SharePoint list populated with ~20 representative synthetic emails (referrals + patient messages + spam)
- [ ] SharePoint dashboard view configured (grouped by Status, "open >24h" filter)
- [ ] Plan PDF as handout
- [ ] Backup screen-recording in case live demo fails

---

## After the Meeting — Sean's Follow-up

- Written summary of decisions within 24h
- If go: production scope brief for sign-off + tenant-access instructions + DPA template
- If no-go: ask for the deal-breaker, log the learning, propose lighter alternative if appropriate

---

## Teams Meeting Body — Ready to Paste

```
Hi Sandeep,

Following our discovery call on April 29, this 30-minute session will cover:

  1. Live demo of a working reception inbox auditor (built in SMEC AI's test
     environment, running against synthetic emails — no clinic data involved
     at this stage)
  2. Walkthrough of what production deployment in your tenant would involve
  3. Your questions
  4. Agreement on next steps

I'll send the written plan ahead of the meeting so we can spend our time on
the demo and on your questions rather than reading.

Two things that would help me prepare:
  - Confirmation of your Microsoft 365 plan (Business Basic / Standard /
    Premium / E3 etc.) — this affects the retention-policy story
  - Whether you have an existing Azure subscription, or are happy to set one up

Talk Wednesday.

Sean
```
