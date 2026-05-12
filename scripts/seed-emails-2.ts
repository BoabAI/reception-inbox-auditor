#!/usr/bin/env bun
/**
 * Second batch — 50 additional fabricated emails for the POC demo.
 *
 * Designed to stress the classifier with edge cases:
 *  - patients asking *for* a referral letter (Other, not Referral)
 *  - specialist replies back to GP (still Referral by definition)
 *  - mis-targeted referrals (ENT, neurology) — Referral
 *  - out-of-office auto-replies, NDRs, read receipts (Other)
 *  - pathology/imaging results, hospital discharge summaries (Other)
 *  - HealthLink, Argus, Medical Objects formatting variants (Referral)
 *  - reply chains and forwards
 *
 * Run with: bun run seed:2
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
  // ============================================================
  // Referrals — straight cases
  // ============================================================
  {
    expected: "Referral",
    category: "GP letter — vertigo",
    subject: "Referral: Mrs Helen Park — recurrent vertigo",
    body: `Dear Doctor,
Mrs Helen Park (DOB 18/06/1958) presents with 4 months of recurrent vertigo, worse with positional change. Audiogram unremarkable. ENT cleared.
Grateful for vestibular assessment and rehab.
Yours sincerely,
Dr Adam Liu
Belconnen Family Medical
Provider 0234567X`,
  },
  {
    expected: "Referral",
    category: "GP letter — falls",
    subject: "Patient referral: Mr Walter Davies, falls and unsteadiness",
    body: `Hi team,
Please see Mr Walter Davies (DOB 03/04/1942) — multiple falls in past 8 weeks. CT brain unremarkable. Suspect bilateral vestibular hypofunction. Currently using a 4-wheel walker.
Thanks
Dr Priya Reddy`,
  },
  {
    expected: "Referral",
    category: "GP letter — Meniere's",
    subject: "Referral letter — Mr Tony Esposito (?Meniere's)",
    body: `Dear Sirs,
Referring 47-year-old male with classic Meniere's triad — episodic vertigo, fluctuating left-sided hearing loss, tinnitus. ENT review pending. Audiogram and MRI attached.
Yours,
Dr Helena Marquez, Lyneham Surgery`,
  },
  {
    expected: "Referral",
    category: "GP letter — post-stroke",
    subject: "Referral: Mrs Jenny Wong — post-stroke balance",
    body: `Dear Vestibular Team,
Please see Mrs Jenny Wong, 67F, 8 weeks post lacunar stroke (right pons). Persistent unsteadiness, no clear vertigo. Neuro stable. Would benefit from balance retraining.
Best
Dr Chris Bowen, Manuka Family Practice`,
  },
  {
    expected: "Referral",
    category: "GP letter — child",
    subject: "Paediatric referral — Master Lucas Berg, 9yo episodic dizziness",
    body: `Dear colleague,
Paediatric referral. 9 y/o boy with 6-month history of brief dizzy spells, sometimes with headache. Paeds neuro assessed — query vestibular migraine. Mum keen for non-pharm options.
Dr R. Dawson (paediatric registrar)`,
  },
  {
    expected: "Referral",
    category: "HealthLink",
    subject: "HealthLink secure message — patient referral (BPPV)",
    body: `HealthLink delivery via Argus.
Sender: Dr Tessa Brown, Curtin GP Clinic <tessa.brown@curtin-gp.com.au>
EDI: CURTNGP

Patient: Mr Aaron Foster, DOB 11/02/1971
Reason: posterior canal BPPV, two prior Epley manoeuvres at GP, recurs.

1 attachment: Foster_Referral.pdf (192kb)`,
  },
  {
    expected: "Referral",
    category: "HealthLink",
    subject: "HealthLink: Vestibular referral — Ms Joan Petrov",
    body: `HealthLink secure clinical message
From: Dr Yusuf Ali, Yass Family Practice
Patient demographics enclosed.
Clinical: 53 y/o with 6 weeks dizziness post URTI. Suspect post-viral vestibular neuritis. Slow recovery.
Attachment: Petrov_referral.pdf`,
  },
  {
    expected: "Referral",
    category: "Medical Objects",
    subject: "Medical-Objects referral — Mr Peter Wright",
    body: `Medical-Objects secure delivery.
Originating practice: Tuggeranong Medical Centre
Provider: Dr Martin Hua (PRV: 0789123Y)
Patient: Mr Peter Wright (DOB 1965-08-22), MRN TMC-44892
Subject: vestibular assessment — recurrent BPPV, post-Epley recurrence
Attachments: 1 (Referral_Letter_PWright.pdf)`,
  },
  {
    expected: "Referral",
    category: "Argus",
    subject: "Argus delivery: Patient referral — chronic dizziness",
    body: `Argus message
From: Dr Rajiv Krishnan
Practice: Phillip Family Practice
Provider Number: 5512889W

Re: Mrs Anjali Kumar, DOB 12/12/1948
Reason for referral: 3-month chronic dizziness, no rotational element. Imaging unremarkable. Query PPPD.

Letter attached.`,
  },
  {
    expected: "Referral",
    category: "Plain text",
    subject: "Quick referral — Mrs Sue Tindale",
    body: `Hi guys,

Quick one — Mrs Sue Tindale needs to be seen by you. Right horizontal canal BPPV. Won't sit through Epley with me. Could you have a go?

Cheers,
Dr Greg`,
  },
  {
    expected: "Referral",
    category: "Plain text",
    subject: "Referring patient: persistent unsteadiness",
    body: `Hi reception,

Referring Mr James Calloway. 71yo male. Persistent unsteadiness without clear vertigo, 6 months. ENG borderline. Worth your input on whether vestibular rehab is appropriate.

Will fax letter today.

Dr Karen Foley`,
  },
  {
    expected: "Referral",
    category: "Plain text",
    subject: "Referral attached — chronic dizziness post head injury",
    body: `Dear Sir/Madam,
Please find attached a referral for Mr B. Salim. 34M, head injury 6 weeks ago (cycling, helmet on). Persistent dizziness, fogginess. Concussion clinic discharged him. ENT cleared.
Regards
Dr O. Hennessy`,
  },
  {
    expected: "Referral",
    category: "Plain text",
    subject: "Internal referral from neurology",
    body: `Dear Vestibular Service,

Internal referral for Mrs Charlotte Lim, who I have seen in neurology clinic today. MRI normal. Attacks of vertigo + headache responsive to triptans — vestibular migraine. Would value your help with non-pharm management.

Best
Dr S. Mehta (neuro registrar)`,
  },
  {
    expected: "Referral",
    category: "Edge — wrong specialty",
    subject: "Referral: query Meniere's — for ENT review",
    body: `Dear team,

Probably should have gone to ENT — apologies. Mr Norman Bates, 62yo, classic Meniere's. If you're not the right team please forward.

Dr Imogen Steele`,
  },
  {
    expected: "Referral",
    category: "Edge — re-referral",
    subject: "Re-referral: Ms Annabelle Yates",
    body: `Hi,

Re-referring Annabelle who you saw last year. Symptoms back, asking to be seen again.

Dr R. Khattar`,
  },
  {
    expected: "Referral",
    category: "Edge — informal",
    subject: "could you see one of mine?",
    body: `Hey, could you fit in Mr Eric Tang? 58, started getting episodes of vertigo last week. Will send a proper referral letter shortly but didn't want him to wait.

— Dr H`,
  },
  {
    expected: "Referral",
    category: "Edge — locum",
    subject: "Locum referral — Sue Marshall",
    body: `Hello, I'm a locum at Hawker GP this week. Patient Sue Marshall (53F) has BPPV not responding to Epley. Permanent GP Dr Khan has asked me to refer.

Dr P. Williams (locum)`,
  },
  {
    expected: "Referral",
    category: "Specialist referring back",
    subject: "Audiology -> Vestibular handoff",
    body: `Dear Vestibular team,

Audiology referral. Mr Brian Holt — sudden sensorineural hearing loss 2 weeks ago, now reports vertigo on head turning. ENG abnormal on right. Suggest urgent vestibular review.

Best,
Lisa Park (audiologist)`,
  },
  {
    expected: "Referral",
    category: "GP letter — workcover",
    subject: "Workcover referral: Mr Damien Foster",
    body: `Dear team,

Please see Mr Damien Foster — workplace ladder fall 4/12 ago. Persistent dizziness affecting return to work. WorkCover claim approved (claim # WC2026-1145). Approval letter attached.

Dr A. Ngata`,
  },
  {
    expected: "Referral",
    category: "GP letter — DVA",
    subject: "DVA referral: Mr Jack O'Halloran (D-742221)",
    body: `Dear sir/madam,

Veterans' Affairs referral for Mr Jack O'Halloran (D-742221). Service-related vestibular symptoms post jet engine exposure. Eligibility confirmed (LMO).

Yours sincerely,
Dr A. Patel`,
  },

  // ============================================================
  // Other — patient queries / rebookings
  // ============================================================
  {
    expected: "Other",
    category: "Patient query — referral request",
    subject: "Can I get a referral letter to physio?",
    body: `Hi, after my last appointment Dr Patel mentioned I could go to physio. Could you please send me a referral letter? Thanks. — Mary T`,
  },
  {
    expected: "Other",
    category: "Patient query",
    subject: "When is my next appointment?",
    body: `Hi reception, I forgot when my next appt is. Can you let me know? Cheers, Brian D.`,
  },
  {
    expected: "Other",
    category: "Patient query",
    subject: "Should I take the medication before exercises?",
    body: `Hi, Dr said to do the head exercises. Do I take the betahistine before or after? Thanks, Lin`,
  },
  {
    expected: "Other",
    category: "Patient query",
    subject: "Driving question",
    body: `Hi, am I OK to drive while having vestibular rehab? Just back to running errands. Thanks, Phil`,
  },
  {
    expected: "Other",
    category: "Patient rebooking",
    subject: "Need to move my Friday appt",
    body: `Hi, can we move my Friday 10am to next week? Got a clash. Thanks!`,
  },
  {
    expected: "Other",
    category: "Patient rebooking",
    subject: "Cancel and rebook",
    body: `Hi please cancel my Tuesday — feeling worse, need to see GP first. Will call to rebook. — N. Singh`,
  },
  {
    expected: "Other",
    category: "Patient rebooking",
    subject: "Running late tomorrow",
    body: `I'll be 15 minutes late tomorrow because of school drop-off. Sorry. — K. Wilson`,
  },
  {
    expected: "Other",
    category: "Patient rebooking",
    subject: "earlier slot?",
    body: `Hi, any earlier appointments next week? Currently booked for Thurs but kids are home that day. Thanks!`,
  },
  {
    expected: "Other",
    category: "New patient enquiry",
    subject: "Do you take new patients?",
    body: `Hello, my GP suggested I see a vestibular physio for my dizziness. Do you take new patients and what's the wait? — Carla`,
  },
  {
    expected: "Other",
    category: "New patient enquiry",
    subject: "Cost question",
    body: `Hi, what does an initial consult cost? Do you bulk bill? Thanks, Jamie M.`,
  },

  // ============================================================
  // Other — billing / Medicare
  // ============================================================
  {
    expected: "Other",
    category: "Billing query",
    subject: "Tax invoice for Apr 22 visit",
    body: `Hi, could you email me a tax invoice for my Apr 22 appointment please? Need it for the health fund. Thanks, S. Patel`,
  },
  {
    expected: "Other",
    category: "Billing query",
    subject: "Medicare rebate hasn't come through",
    body: `Hi reception, Medicare rebate from my last visit hasn't shown up yet. Was bulk-billed component but haven't received the rebate for the gap. Could you check? Thanks, R. Bell`,
  },
  {
    expected: "Other",
    category: "Billing — DVA query",
    subject: "DVA invoice — claim rejected?",
    body: `Hi, I got a letter saying the DVA claim for my visit was rejected. I'm a Gold Card holder so it should have gone through. Could you have a look? — A. Stewart`,
  },
  {
    expected: "Other",
    category: "Insurance",
    subject: "Health fund claim form",
    body: `Hi, my health fund (Bupa) needs a stamped claim form. Can you sign and return please? PDF attached. — Mike L.`,
  },

  // ============================================================
  // Other — clinical results / system mail
  // ============================================================
  {
    expected: "Other",
    category: "Pathology result",
    subject: "Results: Smith, John (DOB 14/03/1962)",
    body: `Capital Pathology — automated result delivery.
Patient: Smith, John
DOB: 14/03/1962
Test: Lipid panel
Status: All within reference range.
View full report at: https://capitalpath.com.au/results/...`,
  },
  {
    expected: "Other",
    category: "Imaging report",
    subject: "MRI Brain report — Park, Helen",
    body: `Spectrum Radiology
Patient: Park, Helen DOB 18/06/1958
Study: MRI Brain w/ contrast
Findings: No focal lesion. No restricted diffusion. Mild small-vessel ischaemia.
Conclusion: Normal study for age.`,
  },
  {
    expected: "Other",
    category: "Hospital discharge summary",
    subject: "Discharge summary — Davies, Walter",
    body: `Royal Metro Hospital — Geriatrics ward
Discharge summary for Walter Davies, admitted 2026-04-22, discharged 2026-04-29.
Diagnoses: Mechanical fall, no fracture. Multifactorial gait disturbance.
Plan: Allied health follow-up. Vestibular review (referred separately).`,
  },
  {
    expected: "Other",
    category: "OOO auto-reply",
    subject: "Out of office: Dr Sharma",
    body: `Thank you for your email. I am out of the office until Monday 19th. For urgent matters please contact reception on 02 6123 4567. I will respond on my return. — Dr Anita Sharma`,
  },
  {
    expected: "Other",
    category: "Read receipt",
    subject: "Read: Patient referral — Mr Aaron Foster",
    body: `Your message
Subject: Patient referral — Mr Aaron Foster
Was read on 2026-05-02 at 9:14 AM.`,
  },
  {
    expected: "Other",
    category: "NDR / bounce",
    subject: "Undeliverable: Patient query reply",
    body: `Your message did not reach some or all of the intended recipients.
Subject: Patient query reply
The following recipient(s) cannot be reached:
old.address@bigpond.com.au — recipient address rejected: User unknown`,
  },
  {
    expected: "Other",
    category: "Calendar invite",
    subject: "Accepted: Vestibular MDT — May 22",
    body: `Dr Anita Sharma has accepted your meeting invitation.
Subject: Vestibular MDT — May 22
When: Thu 22 May 2026 14:00 - 15:00 (UTC+10)`,
  },
  {
    expected: "Other",
    category: "Internal admin",
    subject: "FYI — printer cartridge",
    body: `Hi all, Brother HL printer is low on toner. Reception, can someone reorder? Reception number TN-2450X. Cheers — Sue`,
  },
  {
    expected: "Other",
    category: "Internal admin",
    subject: "Roster change next week",
    body: `Team — Dr Patel on leave Wed-Fri next week. Please redirect any urgent referrals to Dr Lin. Receptionists please reschedule his bookings. Thanks, Practice Manager.`,
  },
  {
    expected: "Other",
    category: "Patient feedback",
    subject: "Just wanted to say thanks",
    body: `Hi team — just a quick note to say thanks for last Tuesday. The exercises are working and I've barely had any spins this week. Tell Dr Patel I really appreciated his patience. — Margaret O.`,
  },
  {
    expected: "Other",
    category: "Patient feedback",
    subject: "Complaint about wait time",
    body: `I waited 40 minutes past my appointment time on Friday. I appreciate you're busy but a heads-up would be courteous. Please pass on. — Tom F.`,
  },

  // ============================================================
  // Other — marketing / spam / phishing
  // ============================================================
  {
    expected: "Other",
    category: "Marketing",
    subject: "Boost referrals 3x with our directory listing",
    body: `Hi clinic owner, our medical directory drives 3x more referrals on average. 14-day free trial. Click below to sign up.`,
  },
  {
    expected: "Other",
    category: "Marketing",
    subject: "Conference: Vestibular 2026 (early bird)",
    body: `Early bird registration is now open for Vestibular 2026, 18-20 September, Sydney. Save 20% if you register before May 31. Programme attached.`,
  },
  {
    expected: "Other",
    category: "Marketing — pharma",
    subject: "Sponsored CME: Managing chronic vertigo",
    body: `Sponsored by VertigoPharma. Free 1-hour CME webinar with Prof J. McKinley on managing chronic vertigo. CPD points awarded. Register at the link.`,
  },
  {
    expected: "Other",
    category: "Marketing — IT",
    subject: "Upgrade your clinical software — 50% off",
    body: `Limited time: 50% off our cloud-based EMR for the first 6 months. Designed for allied health and small practices. Book a 15-min demo.`,
  },
  {
    expected: "Other",
    category: "Spam — phishing",
    subject: "Action required: Microsoft 365 password expiring",
    body: `Your Microsoft 365 password for reception@clinic.example will expire in 24 hours. Click here to keep your current password.

(do NOT click — phishing pattern)`,
  },
  {
    expected: "Other",
    category: "Spam — phishing",
    subject: "Invoice #44218 overdue — final notice",
    body: `Final notice for unpaid invoice #44218 of $4,892. Failure to action within 48hrs will result in legal proceedings. Click here to view invoice.`,
  },
  {
    expected: "Other",
    category: "Spam — newsletter",
    subject: "This week in healthcare: AI scribes, Medicare reforms, ...",
    body: `Welcome to your weekly healthcare digest. This issue: AI scribe rollout, Medicare reforms, and an interview with the new RACGP president. Read online.`,
  },
  {
    expected: "Other",
    category: "Spam — generic",
    subject: "Congratulations! You've been pre-approved",
    body: `Dr Practitioner, you've been pre-approved for a $50,000 business loan with our medical-practice partner finance. No paperwork. Click to claim.`,
  },
];

const TO = config.watchedMailbox;
const FROM_MAILBOX = "sean@smecai.au";

console.log(`[seed-2] sending ${samples.length} emails as ${FROM_MAILBOX} -> ${TO}`);

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
  await new Promise((resolve) => setTimeout(resolve, 250));
}

console.log(`\n[seed-2] sent=${sent} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
