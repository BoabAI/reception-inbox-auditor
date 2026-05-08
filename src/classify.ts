/**
 * Single-call email classifier — labels each email as "Referral" or "Other".
 *
 * Provider: Azure OpenAI (Australia East), AAD auth via DefaultAzureCredential.
 * Model: deployment from AZURE_OPENAI_DEPLOYMENT (gpt-4.1-nano in POC; the plan
 * named gpt-4o-mini, swapped for the cheaper, already-deployed equivalent).
 */
import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { config } from "./config.ts";

export type Classification = {
  type: "Referral" | "Other";
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

const SYSTEM_PROMPT = `You classify emails received at a vestibular clinic's reception inbox as either "Referral" or "Other".

A "Referral" is an email where a doctor or healthcare professional refers a patient to the clinic. Indicators: the word "referral" in subject/body, a PDF attachment from a GP practice, HealthLink/Argus/Medical Objects formatting, sender domain matching a known GP practice, body introducing a patient with vestibular symptoms.

"Other" covers everything else: existing patients writing in, appointment changes, results queries, billing, marketing, spam.

Reply with strict JSON: {"type": "Referral" | "Other", "reason": "<one short sentence>"}`;

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
    max_tokens: 100,
  });

  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("Empty completion from Azure OpenAI");

  const parsed = JSON.parse(content) as Partial<Classification>;
  if (parsed.type !== "Referral" && parsed.type !== "Other") {
    throw new Error(`Bad type from classifier: ${JSON.stringify(parsed)}`);
  }
  return {
    type: parsed.type,
    reason: typeof parsed.reason === "string" ? parsed.reason : "(no reason)",
  };
}
