import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// Lazy getters so each script only validates the env it actually uses.
export const config = {
  get tenantId() {
    return required("M365_TENANT_ID");
  },
  get clientId() {
    return required("M365_CLIENT_ID");
  },
  get watchedMailbox() {
    return required("WATCHED_MAILBOX");
  },
  sp: {
    get hostname() {
      return required("SP_HOSTNAME");
    },
    get sitePath() {
      return required("SP_SITE_PATH");
    },
    get listName() {
      return required("SP_LIST_NAME");
    },
  },
  openai: {
    get endpoint() {
      return required("AZURE_OPENAI_ENDPOINT");
    },
    get apiKey() {
      return required("AZURE_OPENAI_API_KEY");
    },
    get deployment() {
      return required("AZURE_OPENAI_DEPLOYMENT");
    },
    get apiVersion() {
      return process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview";
    },
  },
} as const;
