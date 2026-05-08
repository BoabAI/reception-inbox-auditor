/**
 * Microsoft Graph wrapper.
 *
 * Auth: piggybacks on the locally-authenticated `m365` CLI by shelling out to
 * `m365 util accesstoken get --resource graph`. That avoids a dedicated app
 * registration for the POC. Tokens are cached in-process until 60s before
 * expiry.
 */
import { $ } from "bun";
import { Client } from "@microsoft/microsoft-graph-client";

type Cached = { token: string; expiresAt: number };
let cached: Cached | null = null;

async function fetchToken(): Promise<string> {
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

export async function getGraphToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;
  const token = await fetchToken();
  cached = { token, expiresAt: decodeJwtExp(token) };
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
