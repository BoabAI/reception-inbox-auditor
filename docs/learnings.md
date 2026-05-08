# Learnings — Reception Inbox POC build

What I'd want to know if I were starting this again. Stuff that cost real time
during the May 7-8 build session, plus shape-of-the-problem notes that didn't
come from any doc.

---

## M365 / Graph

### Graph `Mail.Read.Shared` only honours **SharedMailbox** delegation

Biggest single time-sink. Even with `FullAccess` delegated via
`Add-MailboxPermission` on a regular `UserMailbox`, a delegated token will 404
on `/users/{upn}/messages` with `ErrorItemNotFound, Default folder Inbox not
found`. Symptom looks identical to "mailbox not provisioned".

Diagnosis: hit `/me/mailFolders/inbox` (sanity — works on the caller's own
mailbox) and `/users/{target}/mailFolders/inbox` (fails). If `/me` works and
`/users/{target}` doesn't, it's a delegation/scope issue, not provisioning.

**Fix:** convert target to Shared with `Set-Mailbox -Identity x -Type Shared`.
Reasonably 30-300s to propagate to Graph after that.

This is also the right shape for the production deployment — clinic reception
inboxes are shared mailboxes anyway, with multiple receptionists delegated.

### Mailbox provisioning lag after license assignment

Assigning an Exchange license to a brand-new user does **not** auto-provision a
mailbox. The user must sign into OWA at least once (or an admin runs a
provisioning cmdlet) to trigger Exchange to materialise the folder structure.
Until then `/users/{upn}/mailFolders` 404s with `Default folder Root not found`
even though the user's `assignedPlans` shows Exchange Enabled.

If a user has a license but Graph reports root-not-found, ask them to sign in
to outlook.office.com once.

### `m365 util accesstoken get --resource graph` is a free app registration

Works for any Graph scope the m365 CLI app already has consent for, which in
practice covers Mail.*, Sites.*, User.*, Group.*. Saves the entire app-reg +
admin-consent dance for POCs. **Caveat:** browser-flow tokens are personal to
the user; not appropriate for production code that needs to run unattended.

### Graph rejects Hyperlink column writes on classic SP lists

Tried every shape — `{Url, Description}`, `{url, description}`, string
`"https://x, label"`, etc. All return `invalidRequest` or `generalException`.
The column exists, Graph can read it back, but POST/PATCH on a Hyperlink (URL)
column will not work.

m365 CLI does work — it uses SharePoint REST under the hood with the legacy
`SP.FieldUrlValue` `__metadata` shape.

**Pattern:** read via Graph (fast, typed), write via m365 CLI shell-out for
anything Graph can't handle. Don't fight Graph; just escape hatch.

### Graph `$filter` on `/sites/{id}/lists` collection 400s

Filtering the lists *collection* by `displayName` returns
`itemNotFound: The specified list was not found`. Graph appears not to honour
$filter on this endpoint at all. Fetch all and match client-side.

Filtering on `/lists/{id}/items` *with* `$expand=fields&$filter=fields/MyCol eq 'x'`
**does** work, provided `MyCol` is indexed (and Prefer header is harmless if it
isn't).

## SharePoint via m365 CLI

### SharePoint text webpart accepts HTML only, not markdown

`m365 spo page text add --text "# Heading"` will render the literal `#`, `**`,
and bullet `-` characters with newlines collapsed to spaces. SP's text webpart
is HTML-rendering, not markdown-rendering — pass HTML directly instead:

```html
<h3>Heading</h3>
<ul><li><strong>bold</strong> ...</li></ul>
```

Tables, blockquotes, code spans, inline styles all work. `<br />` for line
breaks within a paragraph.

### List webpart needs `selectedListId` (GUID)

The List standard web part renders nothing if you pass only
`selectedListUrl + listTitle`. Required is `selectedListId` (the list's GUID).
Look it up with `m365 spo list get --title X --output json` and read `.Id`.

### QuickChart webpart crashes regardless of data shape

In a SP/M365 tenant in 2026, the QuickChart standard web part throws
`TypeError: Cannot read properties of undefined (reading 'filter')` on render
no matter how its `webPartData` is shaped — tried both:

- `chartCategories: string[]` + `chartSeries: [{name, data: number[]}]`
- `dataItems: [{title, value}]` + `isManual: true`

Both crash. Workaround: render the pie as **inline SVG** in a text webpart.
Full control over slices, colors, legend; no JS dependency. SP's text webpart
preserves SVG markup verbatim.

### `m365 spo page section add` rotates collapsibleTitle by 1

When you add three collapsible sections in sequence, the `--collapsibleTitle`
ends up on the *next* section in zone order — not the section being created.
Pattern observed (m365 v11.7.0):

| Add order | Title given | Final position (zone) |
|---|---|---|
| 1 | `Inbox` | zone 3 |
| 2 | `Stats` | zone 1 |
| 3 | `Compliance & Privacy` | zone 2 |

Workaround: feed titles in **reverse** of intended display order. Want zones
[Inbox, Stats, Compliance]? Add titles in the order [Compliance, Inbox, Stats].

There is no `spo page section set` to retrofit titles. Other things that
*don't* fix the rotation: explicit `--order N`, batching all section adds
before any content adds.

### Emojis in `--collapsibleTitle` serialise as escape literals

`--collapsibleTitle "📊 Stats"` renders in the SP UI as `\u{1f4ca} Stats`
verbatim. The CLI runs the title through a JSON encoder that emits ASCII
escape sequences. Use plain text section titles.

### `m365 spo field get` flags

There is no `--fieldTitle`. Options are `--id`, `--title` (display), or
`--internalName` (case-sensitive). Passing an unrecognised flag silently
returns nonzero — we duplicated every column in the list before noticing.
Always check exit code via `--query` or by parsing JSON output.

### CAML `Name` attribute does **not** override InternalName

If you create a column with
`<Field DisplayName="From" Name="FromAddress" ...>`, SharePoint will use
`InternalName=From` (derived from DisplayName), not `FromAddress`.
StaticName respects what you set; InternalName ignores it.

To get a pretty display name *and* a stable internal name:

1. Create the field with `DisplayName == Name`, e.g. `FromAddress` for both.
2. Rename the *display* with `m365 spo field set --internalName FromAddress --Title From`.

That decouples the wire-stable identifier (InternalName) from the UI label.

### Date format for `m365 spo listitem add`

`--Received "2026-05-08T10:00:00Z"` (ISO 8601) returns `You must specify a
valid date within the range of 1/1/1900 and 12/31/8900`. The CLI wants
`M/D/YYYY h:mm AM/PM`, e.g. `5/8/2026 10:00 AM`. Convert at the boundary —
internally everything else can stay ISO.

### Versioning has to be set at creation time via `--enableVersioning true`

Setting it later via `m365 spo list set` works but adds a separate command.
Specify on `m365 spo list add` to keep the script idempotent and one-shot.

## Azure OpenAI

### AAD auth via `DefaultAzureCredential` is cleaner than API keys

```ts
const azureADTokenProvider = getBearerTokenProvider(
  new DefaultAzureCredential(),
  "https://cognitiveservices.azure.com/.default",
);
const client = new AzureOpenAI({ endpoint, apiVersion, azureADTokenProvider, deployment });
```

No secrets in `.env`, automatic rotation, audit trail at the AAD level. The
data-plane role you need is **`Cognitive Services OpenAI User`** scoped to the
account or RG. Subscription-level Contributor does not grant data-plane access.

### `gpt-4.1-nano` is plenty for binary classification

5/5 on hand-tested cases (GP referral, HealthLink, rebooking, spam, billing).
~1s latency, fraction of the cost of gpt-4o-mini. Don't reflexively reach for
the bigger model.

### Permission-system gotchas

Reading API keys (`az cognitiveservices account keys list`) and creating role
assignments (`az role assignment create`) are gated as
"credential exploration" / "permission elevation". Fine — write a wrapper
shell script the user runs once via `bash scripts/x.sh`. Faster than fighting
the prompt.

## Auth model for the POC

Final shape:

| Operation              | Auth                                          | Why                                                      |
|------------------------|-----------------------------------------------|----------------------------------------------------------|
| Read mailbox via Graph | m365 CLI's delegated token (Sean's)           | No app reg needed; broad scopes                          |
| Write SharePoint list  | m365 CLI shell-out                            | Graph can't write Hyperlink columns                      |
| Send synthetic mail    | Graph `sendMail` via m365 CLI token           | `Mail.Send` already in scope                             |
| Classify with OpenAI   | `DefaultAzureCredential` (uses az login)      | No keys in repo; production-safe pattern                 |

For **production** this all changes:
- Power Automate flow inside the clinic's tenant (no script).
- App-only auth for the flow's HTTP calls (managed identity if Azure-side).
- Mailbox stays a SharedMailbox (already correct).

## Process / workflow

### Idempotent everything

Every infra script (`create-list.ts`, `grant-openai-role.sh`, etc.) is safely
re-runnable. Caught the duplicate-columns bug *because* I re-ran the script.
If a script can't be safely re-run, write the existence check first.

### Stage-by-stage commits with clean rollback

8 stages → 6 commits, each independently revertable. Combined with
`bun run list:teardown` for SharePoint side and the `Remove-MailboxPermission`
/ `Set-Mailbox -Type Regular` cmdlets for Exchange side, the entire build can
be torn down in <60s.

If you can't articulate "to undo this stage I do X", you're not done designing
the stage.

### `!` prefix command line wrapping is fragile

Long `az role assignment create --scope ...` commands that the user pastes via
`! cmd` get split by zsh's terminal at the wrong character. Wrap multi-arg
commands in a `scripts/x.sh` and have the user run `! bash scripts/x.sh`.
Faster, and the wrapper is now the rollback artefact too.

### Browser-auth flows from background scripts hang silently

`Connect-ExchangeOnline` from a child process with no TTY waits indefinitely
for browser auth that can't complete. Either run it interactively in the
foreground, or check for a cached session first.

Specifically: my first `grant-mailbox-access.sh` invocation appears to have
hung at the auth step and returned no useful output; `Get-MailboxPermission`
later showed nothing was granted. Always verify after running EXO scripts.

### Permission propagation is genuinely slow

EXO mailbox delegation: 30-300s.
Azure RBAC role assignment: 60-180s for data-plane endpoints.
M365 license → Exchange mailbox provisioning: minutes-to-an-hour.

Don't bake retry-on-403 logic into the runtime; just wait, and tell the user
why you're waiting.

---

*Captured 2026-05-08, build session for May 13 demo.*
