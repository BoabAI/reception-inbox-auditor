#!/usr/bin/env bun
/**
 * Smoke test for src/classify.ts — runs a few hand-crafted emails through the
 * Azure OpenAI classifier so we can sanity-check classification quality before
 * wiring it into the auto-log loop.
 */
import { classifyEmail } from "../src/classify.ts";

const cases: Array<{ label: string; subject: string; from: string; body: string; expected: "Referral" | "Other" }> = [
  {
    label: "GP referral letter",
    subject: "Referral: Mr John Smith — vestibular assessment",
    from: "Dr Anita Sharma <reception@northsidegp.com.au>",
    body: "Dear Doctor, I am referring Mr John Smith (DOB 14/03/1962) for assessment of recurrent positional vertigo. He reports rotational vertigo lasting <30s on rolling over in bed for the past 6 weeks...",
    expected: "Referral",
  },
  {
    label: "HealthLink formatted referral",
    subject: "HealthLink Message — Patient Referral",
    from: "no-reply@healthlink.net",
    body: "HealthLink secure messaging delivery. Sender: Dr Mark Tan, Hawker Family Practice. Patient: Mary O'Brien, DOB 22/07/1948. Reason: chronic dizziness and falls assessment. Attachments: 1 PDF...",
    expected: "Referral",
  },
  {
    label: "Patient rebooking request",
    subject: "Need to change my appointment",
    from: "Karen Smith <karens.home@gmail.com>",
    body: "Hi, I have an appointment next Tuesday at 2pm but I need to reschedule. Can I move to Wednesday afternoon if possible? Thanks, Karen",
    expected: "Other",
  },
  {
    label: "Marketing spam",
    subject: "Boost your clinic revenue with our SEO services",
    from: "marketing@growmycli.io",
    body: "Hi there, We help medical practices triple their patient bookings using AI-driven SEO. Book a free 15-min consult...",
    expected: "Other",
  },
  {
    label: "Billing query from existing patient",
    subject: "Invoice 2451 query",
    from: "robert@bigpond.net.au",
    body: "Hi, the invoice from my last visit doesn't match what we discussed. Could you check please? Thanks Robert",
    expected: "Other",
  },
];

let pass = 0;
for (const c of cases) {
  const start = Date.now();
  try {
    const result = await classifyEmail({ subject: c.subject, from: c.from, body: c.body });
    const ms = Date.now() - start;
    const ok = result.type === c.expected ? "✓" : "✗";
    if (result.type === c.expected) pass++;
    console.log(`${ok} ${c.label} -> ${result.type} (${ms}ms)`);
    console.log(`  reason: ${result.reason}`);
  } catch (e) {
    console.log(`✗ ${c.label} -> ERROR ${(e as Error).message}`);
  }
}

console.log(`\n${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
