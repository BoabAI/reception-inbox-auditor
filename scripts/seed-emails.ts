#!/usr/bin/env bun
/**
 * Send ~20 fabricated emails from sean@smecai.au to demonstration@smecai.au
 * to populate the POC mailbox with realistic test data.
 *
 * Mix mirrors the plan: HealthLink-style referral, GP letter referrals (with
 * fake PDF attachment placeholders), plain-text referrals, rebooking, billing,
 * marketing, spam.
 *
 * Re-running re-sends — the auto-log loop will dedup by Internet Message ID
 * if SOME messages happen to land with duplicate IDs (they won't here; Exchange
 * stamps a unique ID per send).
 */
import { config } from "../src/config.ts";
import { sendMail } from "../src/graph.ts";

type Sample = {
  subject: string;
  body: string;
  expected: "Referral" | "Other";
  category: string;
};

const samples: Sample[] = [
  // --- Referrals ---
  {
    expected: "Referral",
    category: "GP letter",
    subject: "Referral: Mr John Smith — vestibular assessment",
    body: `Dear Doctor,

I am referring Mr John Smith (DOB 14/03/1962) for assessment of recurrent positional vertigo. He reports rotational vertigo lasting <30s on rolling over in bed for the past 6 weeks. No hearing loss, no tinnitus. Otologic exam unremarkable.

Past history: hypertension, well controlled.
Medications: perindopril 4mg.

Grateful for your assessment and BPPV management.

Kind regards,
Dr Anita Sharma
Northside General Practice
T: 02 6234 5678`,
  },
  {
    expected: "Referral",
    category: "GP letter",
    subject: "Patient referral — Mrs Margaret O'Donnell, dizziness x 3 months",
    body: `Hi team,

Please see Mrs Margaret O'Donnell (DOB 02/11/1955) — 3-month history of constant dizziness, worse on head movement. Negative head impulse test in clinic. Audiogram normal (PDF attached).

Suspect persistent postural-perceptual dizziness vs vestibular migraine. Would value your input.

Regards
Dr Tom Greene
Hawker Family Medical`,
  },
  {
    expected: "Referral",
    category: "HealthLink-style",
    subject: "HealthLink Message — Patient Referral",
    body: `HealthLink secure messaging delivery.
Sender: Dr Mark Tan, Belconnen Medical Centre
EDI: BMCBELCO

Patient: Mary O'Brien
DOB: 22/07/1948
Gender: F
Medicare: 2356 78901 1

Reason for referral: Chronic dizziness and falls assessment. Three falls in past 6 weeks, no LOC. Trial of Stemetil ineffective.

Attachments: 1 (Referral_OBrien.pdf, 248kb)`,
  },
  {
    expected: "Referral",
    category: "HealthLink-style",
    subject: "HealthLink: Vestibular referral — Peter Nguyen",
    body: `HealthLink secure clinical message.
From: Dr Sue Chen <dr.chen@argusclinic.com.au>
EDI: ARGUSCLN

Patient demographics enclosed.
Clinical: 58 y/o male with episodic vertigo, ?Meniere's. ENT review pending. Audiology scheduled 2026-05-22.

Please assess and consider canal repositioning if BPPV component identified.

Attachment: Referral_Letter.pdf`,
  },
  {
    expected: "Referral",
    category: "Plain text referral",
    subject: "Referring patient for vestibular rehab",
    body: `Hello,

Could you please see one of my patients, Mrs Diane Kelly, for vestibular physiotherapy. She had a labyrinthitis 3 weeks ago and has persistent unsteadiness. ENT has cleared her for active rehab.

Will fax the referral letter shortly.

Thanks,
Dr B Patel`,
  },
  {
    expected: "Referral",
    category: "Plain text referral",
    subject: "New referral — recurrent BPPV",
    body: `Dear Sir/Madam,

I would like to refer Mr Alan Wright (06/05/1970) for management of recurrent right posterior canal BPPV. Three episodes in 6 months. Previous Epley successful but recurs.

Symptoms: brief rotational vertigo on lying down, looking up.

Yours
Dr Faisal Ahmed
Dickson Medical Centre`,
  },
  {
    expected: "Referral",
    category: "Plain text referral",
    subject: "Referral letter attached — vertigo",
    body: `Dear Colleague

Please see attached referral for Mrs Janet Lim, who I am referring to your service for assessment of central vs peripheral cause of her vertigo. MRI brain reported normal. ENG attached.

Best regards
Dr Owen Hall`,
  },

  // --- Other ---
  {
    expected: "Other",
    category: "Patient rebooking",
    subject: "Need to change my appointment next Tuesday",
    body: `Hi, I have an appointment next Tuesday at 2pm but I need to reschedule. Can I move to Wednesday afternoon if possible?

Thanks,
Karen Smith`,
  },
  {
    expected: "Other",
    category: "Patient rebooking",
    subject: "Rebooking question",
    body: `Hello, sorry to be a pain. I missed my appointment this morning because of the school run. When's the next available slot please?

— Tom Wilson`,
  },
  {
    expected: "Other",
    category: "Patient rebooking",
    subject: "Cancellation",
    body: `Hi I won't be able to make it on Friday. Please cancel and I will rebook online when I can.

J Murphy`,
  },
  {
    expected: "Other",
    category: "Billing query",
    subject: "Invoice 2451 query",
    body: `Hi,

The invoice from my last visit doesn't match what we discussed regarding the Medicare rebate. Could you please check?

Thanks
Robert Lane`,
  },
  {
    expected: "Other",
    category: "Billing query",
    subject: "Receipt for Medicare claim",
    body: `Hello, could you send me the itemised receipt for my Aug 14 visit? My Medicare app says it was bulk billed but I paid a gap.

Cheers
H. Patel`,
  },
  {
    expected: "Other",
    category: "Results query",
    subject: "Did my MRI report come back?",
    body: `Hi, just chasing up on whether my MRI report has reached you. Dr Sharma asked me to follow up.

Thanks,
Lisa F`,
  },
  {
    expected: "Other",
    category: "Marketing",
    subject: "Boost your clinic revenue with our SEO services",
    body: `Hi there,

We help medical practices triple their patient bookings using AI-driven SEO. Book a free 15-min consult today!

— GrowMyClinic team`,
  },
  {
    expected: "Other",
    category: "Marketing",
    subject: "Exclusive: 50% off premium clinical software",
    body: `Limited-time offer for medical practices. Our cloud EMR is now half-price for the first 3 months.

Click below to schedule a demo.`,
  },
  {
    expected: "Other",
    category: "Marketing",
    subject: "Free CME webinar: managing complex chronic dizziness",
    body: `Dear practitioner,

Join us for a complimentary CME webinar on chronic dizziness, sponsored by VertigoPharma. Earn 1 CPD point.

Register at the link below.`,
  },
  {
    expected: "Other",
    category: "Spam",
    subject: "URGENT: Unpaid invoice — please action",
    body: `Dear sir/madam, our records show an invoice of $2,489 unpaid since Feb. Please remit immediately to avoid debt collection. PDF attached.

(this is a phishing pattern — should be classified as Other)`,
  },
  {
    expected: "Other",
    category: "Spam",
    subject: "You've been selected for a prize draw",
    body: `Congratulations! You've been selected as one of our lucky winners. Click here to claim your prize within 24 hours.`,
  },
  {
    expected: "Other",
    category: "Patient query",
    subject: "Question about my next session",
    body: `Hi reception, I'm not sure if I should be doing the head exercises every day or only when symptoms come on. Could you check with Dr please?

Thanks
Sarah B`,
  },
  {
    expected: "Other",
    category: "Patient query",
    subject: "Address change",
    body: `Hi, my address has changed — could you update it on my file please?

New address: 14 Currong St, Braddon ACT 2612

Cheers
Mike L`,
  },
];

const TO = config.watchedMailbox;
const FROM_MAILBOX = "sean@smecai.au";

console.log(`[seed] sending ${samples.length} emails as ${FROM_MAILBOX} -> ${TO}`);

let sent = 0;
let failed = 0;
for (const s of samples) {
  try {
    await sendMail({ fromMailbox: FROM_MAILBOX, to: TO, subject: s.subject, body: s.body });
    sent++;
    console.log(`  ✓ [${s.expected}] ${s.subject}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${s.subject}: ${(e as Error).message}`);
  }
  // Tiny pause to space out — Exchange dislikes burst sends from a single user
  await new Promise((resolve) => setTimeout(resolve, 250));
}

console.log(`\n[seed] sent=${sent} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
