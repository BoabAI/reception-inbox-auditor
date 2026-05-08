/**
 * Single-call email classifier — labels each email with:
 *  - type: "Referral" or "Other"
 *  - category: one of the SP list's Category choice values
 *
 * Provider: Azure OpenAI (Australia East), AAD auth via DefaultAzureCredential.
 * Model: deployment from AZURE_OPENAI_DEPLOYMENT (gpt-4.1-nano in POC).
 */
import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { config } from "./config.ts";

export const CATEGORIES = [
  "Referral - HealthLink/Argus/MedObjects",
  "Referral - GP letter",
  "Referral - Plain text / informal",
  "Referral - WorkCover/DVA",
  "Referral - Specialist handoff",
  "Patient enquiry",
  "Rebooking / cancellation",
  "Billing / Medicare",
  "Clinical result",
  "Marketing / CME",
  "Phishing / spam",
  "System (NDR, OOO, receipt)",
  "Internal admin",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Classification = {
  type: "Referral" | "Other";
  category: Category;
  reason: string;
};

const credential = new DefaultAzureCredential();
const azureADTokenProvider = getBearerTokenProvider(
  credential,
  "https://cognitiveservices.azure.com/.default",
);

const client = new AzureOpenAI({
  endpoint: config.openai.endpoint,
  apiVersion: config.openai.apiVersion,
  azureADTokenProvider,
  deployment: config.openai.deployment,
});

const SYSTEM_PROMPT = `You classify emails received at a vestibular clinic's reception inbox.

Output two labels:
1. type: "Referral" if a healthcare professional is referring a patient TO this clinic; otherwise "Other"
2. category: one of these exact strings:
   - "Referral - HealthLink/Argus/MedObjects" — electronic referral via secure messaging
   - "Referral - GP letter" — formatted referral letter from a GP, often with PDF
   - "Referral - Plain text / informal" — referral by email without formal letter
   - "Referral - WorkCover/DVA" — referrals tied to WorkCover, DVA, insurance schemes
   - "Referral - Specialist handoff" — internal referral from another specialist (audiology, ENT, neuro)
   - "Patient enquiry" — patient asking a question (clinical, admin, fees, eligibility)
   - "Rebooking / cancellation" — patient changing or cancelling an appointment
   - "Billing / Medicare" — invoice, rebate, claim, health-fund query
   - "Clinical result" — pathology / imaging / discharge summary delivery
   - "Marketing / CME" — marketing, sponsored CME, conference, sales
   - "Phishing / spam" — phishing patterns, scam, generic spam
   - "System (NDR, OOO, receipt)" — out-of-office, non-delivery report, read receipt, calendar
   - "Internal admin" — staff/practice admin email (rosters, supplies, ops)
   - "Other" — anything that doesn't fit above

If type is "Referral", the category MUST start with "Referral - ".
If type is "Other", the category MUST NOT start with "Referral - ".

Reply with strict JSON: {"type": "Referral" | "Other", "category": "<one of the strings above>", "reason": "<one short sentence>"}`;

export async function classifyEmail(input: {
  subject: string;
  from: string;
  body: string;
}): Promise<Classification> {
  const userMessage = `Subject: ${input.subject}\nFrom: ${input.from}\nBody (first 500 chars): ${input.body.slice(0, 500)}`;

  const completion = await client.chat.completions.create({
    model: config.openai.deployment,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
    max_tokens: 200,
  });

  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("Empty completion from Azure OpenAI");

  const parsed = JSON.parse(content) as Partial<Classification>;
  if (parsed.type !== "Referral" && parsed.type !== "Other") {
    throw new Error(`Bad type from classifier: ${JSON.stringify(parsed)}`);
  }
  const category = (CATEGORIES as readonly string[]).includes(parsed.category as string)
    ? (parsed.category as Category)
    : "Other";
  return {
    type: parsed.type,
    category,
    reason: typeof parsed.reason === "string" ? parsed.reason : "(no reason)",
  };
}
