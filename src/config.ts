import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  tenantId: required("M365_TENANT_ID"),
  clientId: required("M365_CLIENT_ID"),
  watchedMailbox: required("WATCHED_MAILBOX"),
  sp: {
    hostname: required("SP_HOSTNAME"),
    sitePath: required("SP_SITE_PATH"),
    listName: required("SP_LIST_NAME"),
  },
  openai: {
    endpoint: required("AZURE_OPENAI_ENDPOINT"),
    apiKey: required("AZURE_OPENAI_API_KEY"),
    deployment: required("AZURE_OPENAI_DEPLOYMENT"),
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview",
  },
} as const;
