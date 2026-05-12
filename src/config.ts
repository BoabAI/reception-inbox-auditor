import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

type AuthMode = "cli" | "app";
type CursorBackend = "file" | "table";

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
    get deployment() {
      return required("AZURE_OPENAI_DEPLOYMENT");
    },
    get apiVersion() {
      return optional("AZURE_OPENAI_API_VERSION") ?? "2024-08-01-preview";
    },
  },
  graph: {
    get authMode(): AuthMode {
      const v = (optional("GRAPH_AUTH_MODE") ?? "cli").toLowerCase();
      if (v !== "cli" && v !== "app") {
        throw new Error(`GRAPH_AUTH_MODE must be "cli" or "app", got: ${v}`);
      }
      return v;
    },
    get clientId() {
      return required("GRAPH_CLIENT_ID");
    },
    get clientSecret() {
      return required("GRAPH_CLIENT_SECRET");
    },
  },
  cursor: {
    get backend(): CursorBackend {
      const v = (optional("CURSOR_STORE") ?? "file").toLowerCase();
      if (v !== "file" && v !== "table") {
        throw new Error(`CURSOR_STORE must be "file" or "table", got: ${v}`);
      }
      return v;
    },
    get storageAccount() {
      return required("AZURE_STORAGE_ACCOUNT");
    },
    get tableName() {
      return optional("AZURE_STORAGE_TABLE") ?? "cursors";
    },
    get filePath() {
      return optional("CURSOR_FILE_PATH") ?? ".state/cursor.json";
    },
  },
} as const;
