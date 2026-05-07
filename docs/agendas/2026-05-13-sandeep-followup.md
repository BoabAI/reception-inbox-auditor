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

Show Sandeep a working POC built in SMEC AI's test environment, get his read on whether it solves what he was describing, and find out if there's appetite to take it further.

---

## Agenda

| Time | Item | Owner |
|---|---|---|
| 0:00 – 0:03 | Welcome + 60-second recap of the discovery call | Sean |
| 0:03 – 0:15 | **Live demo** — `demonstration@smecai.au` test inbox: email arrives → auto-logs (idempotent on Internet Message ID) → AI classifies Referral/Other → single shared SharePoint list view (grouped by Status, sorted Received desc) used by both receptionist and manager → grid-edit Status + Notes inline | Sean |
| 0:15 – 0:25 | Sandeep's questions, reactions, must-haves | Sandeep |
| 0:25 – 0:30 | Sense check on next steps | Both |

---

## What Sean is Trying to Learn

1. Does what Sandeep saw match what he was imagining when he described the problem?
2. What would make the difference between "interesting demo" and "I want this"?
3. Is there appetite for a follow-up conversation about taking it further?

---

## Sean's Prep Checklist (Before the Meeting)

- [ ] `demonstration@smecai.au` shared mailbox provisioned and accessible
- [ ] Auto-log Power Automate flow live (idempotent on Internet Message ID)
- [ ] Azure OpenAI deployment running in SMEC AI's Australia East
- [ ] SharePoint list populated with ~20 representative synthetic emails
- [ ] Single shared view configured (grouped by Status, sorted Received desc, "Action Completed" group collapsed by default)
- [ ] Plan PDF as handout
- [ ] Backup screen-recording in case live demo fails

---

## After the Meeting — Sean's Follow-up

- Written summary of the conversation within 24h
- If interest is there: propose a separate scoping conversation
- If not: ask what would have made it land, log the learning

---

## Teams Meeting Body — Ready to Paste

```
Hi Sandeep,

Following our discovery call on April 29, this 30-minute session will cover:

  1. Live demo of a working reception inbox auditor (built in SMEC AI's test
     environment against demonstration@smecai.au, running against synthetic
     emails — no clinic data involved)
  2. Your reactions and questions
  3. A quick sense check on whether to take it further

I'll send the written plan ahead of the meeting so we can spend our time on
the demo and the discussion rather than reading.

Talk Wednesday.

Sean
```
