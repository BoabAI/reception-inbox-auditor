/**
 * Microsoft Graph wrapper.
 *
 * Two auth modes (switched via GRAPH_AUTH_MODE):
 *  - "cli" (default, dev): piggybacks on the locally-authenticated m365 CLI by
 *     shelling out to `m365 util accesstoken get --resource graph`. Avoids a
 *     dedicated app registration for local development. Requires Bun runtime.
 *  - "app" (prod): uses @azure/identity ClientSecretCredential against an app
 *     registration in the customer's tenant. Required for unattended runs
 *     (Azure Function). Works on Node.
 *
 * Tokens are cached in-process until 60s before expiry.
 */
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential, type AccessToken } from "@azure/identity";
import { config } from "./config.js";

type Cached = { token: string; expiresAt: number };
const tokenCache = new Map<string, Cached>();

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

// ─── CLI mode (dev) ───────────────────────────────────────────────
async function fetchTokenViaCli(): Promise<string> {
  // Lazy-import "bun" so this file is also importable under Node (Function App).
  const { $ } = await import("bun");
  const res = await $`m365 util accesstoken get --resource graph --output text`.quiet();
  const token = res.stdout.toString().trim();
  if (!token.startsWith("ey")) {
    throw new Error(`Unexpected m365 token output: ${token.slice(0, 60)}`);
  }
  return token;
}

function decodeJwtExp(token: string): number {
  const [, payload] = token.split(".");
  if (!payload) throw new Error("malformed jwt");
  const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as { exp?: number };
  if (!json.exp) throw new Error("jwt missing exp");
  return json.exp * 1000;
}

// ─── App mode (prod) ──────────────────────────────────────────────
let appCredential: ClientSecretCredential | null = null;

function getAppCredential(): ClientSecretCredential {
  if (!appCredential) {
    appCredential = new ClientSecretCredential(
      config.tenantId,
      config.graph.clientId,
      config.graph.clientSecret,
    );
  }
  return appCredential;
}

async function fetchTokenViaApp(scope: string): Promise<AccessToken> {
  const cred = getAppCredential();
  const t = await cred.getToken(scope);
  if (!t) throw new Error(`Failed to acquire token for ${scope}`);
  return t;
}

// ─── Public API ───────────────────────────────────────────────────
export async function getGraphToken(): Promise<string> {
  const key = "graph";
  const now = Date.now();
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  if (config.graph.authMode === "app") {
    const t = await fetchTokenViaApp(GRAPH_SCOPE);
    tokenCache.set(key, { token: t.token, expiresAt: t.expiresOnTimestamp });
    return t.token;
  }

  const token = await fetchTokenViaCli();
  tokenCache.set(key, { token, expiresAt: decodeJwtExp(token) });
  return token;
}

/**
 * Acquire a token for SharePoint REST API. In app mode the scope is the
 * tenant-specific SharePoint host (e.g. https://contoso.sharepoint.com/.default).
 * In cli mode we piggyback on the m365 CLI's sharepoint resource token.
 */
export async function getSharePointToken(): Promise<string> {
  const key = "sharepoint";
  const now = Date.now();
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  if (config.graph.authMode === "app") {
    const scope = `https://${config.sp.hostname}/.default`;
    const t = await fetchTokenViaApp(scope);
    tokenCache.set(key, { token: t.token, expiresAt: t.expiresOnTimestamp });
    return t.token;
  }

  const { $ } = await import("bun");
  const res = await $`m365 util accesstoken get --resource https://${config.sp.hostname} --output text`.quiet();
  const token = res.stdout.toString().trim();
  if (!token.startsWith("ey")) {
    throw new Error(`Unexpected m365 sharepoint token output: ${token.slice(0, 60)}`);
  }
  tokenCache.set(key, { token, expiresAt: decodeJwtExp(token) });
  return token;
}

export async function graphClient(): Promise<Client> {
  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await getGraphToken();
        done(null, token);
      } catch (e) {
        done(e as Error, null);
      }
    },
  });
}

// --- Mail helpers ---

export type MailMessage = {
  id: string;
  internetMessageId: string;
  subject: string;
  from: string;
  fromAddress: string;
  receivedDateTime: string;
  bodyPreview: string;
  webLink: string;
};

type GraphMessage = {
  id: string;
  internetMessageId: string;
  subject: string | null;
  from: { emailAddress: { name: string; address: string } } | null;
  receivedDateTime: string;
  bodyPreview: string | null;
  webLink: string;
};

const MAIL_SELECT = ["id", "internetMessageId", "subject", "from", "receivedDateTime", "bodyPreview", "webLink"].join(",");

export async function listInboxMessages(mailbox: string, opts: { since?: string; top?: number } = {}): Promise<MailMessage[]> {
  const { since, top = 25 } = opts;
  const client = await graphClient();
  let req = client.api(`/users/${mailbox}/mailFolders/Inbox/messages`).select(MAIL_SELECT).top(top).orderby("receivedDateTime desc");
  if (since) {
    req = req.filter(`receivedDateTime ge ${since}`);
  }
  const data = (await req.get()) as { value: GraphMessage[] };
  return data.value.map(toMailMessage);
}

function toMailMessage(m: GraphMessage): MailMessage {
  const from = m.from?.emailAddress;
  return {
    id: m.id,
    internetMessageId: m.internetMessageId,
    subject: m.subject ?? "(no subject)",
    from: from ? `${from.name} <${from.address}>` : "(unknown)",
    fromAddress: from?.address ?? "",
    receivedDateTime: m.receivedDateTime,
    bodyPreview: m.bodyPreview ?? "",
    webLink: m.webLink,
  };
}

// --- Send mail (used by seeder) ---

export async function sendMail(opts: {
  fromMailbox: string;
  to: string;
  subject: string;
  body: string;
  contentType?: "Text" | "HTML";
}): Promise<void> {
  const client = await graphClient();
  await client.api(`/users/${opts.fromMailbox}/sendMail`).post({
    message: {
      subject: opts.subject,
      body: { contentType: opts.contentType ?? "Text", content: opts.body },
      toRecipients: [{ emailAddress: { address: opts.to } }],
    },
    saveToSentItems: true,
  });
}
