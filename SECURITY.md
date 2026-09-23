# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by:

1. **Email**: Send details to the project maintainers privately
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature

Please do not create public issues for security vulnerabilities.

## Provisioning the first maestro

Registration never grants a role. On a **new** deployment, promote the founding account once,
out-of-band:

1. The person registers normally through the app (this creates `users/{uid}` with no `rol`).
2. In the [Firebase console](https://console.firebase.google.com) → Firestore Database → `users`
   → their document, add the field `rol` (string) with the value `maestro`.

Console and Admin SDK writes bypass `firestore.rules`, which is exactly why this is safe: there
is no client-reachable path to a role, so the promotion cannot be replayed or raced by anyone
else. From then on the maestro assigns `admin` from **Miembros** inside the app.

The previous self-service bootstrap is documented under *Role bootstrap* below and was removed.

## Security Measures

This project implements the following security practices:

- **Dependency scanning**: Automated via Dependabot
- **Code scanning**: Automated via CodeQL
- **Automated bot review resolution gate in CI/CD**: Pull requests cannot pass CI or be merged if there are open/unresolved review comments left by reviewer bots (Seer/Sentry, CodeRabbit, Copilot, Codecov, SonarCloud, GitHub Actions, etc.). Enforced automatically via the `check-unresolved-bot-reviews` job in `.github/workflows/ci.yml` and the `scripts/check-unresolved-reviews.mjs` verification utility.
- **Secrets protection**: Firebase credentials stored as GitHub Secrets for CI/CD. Local development uses `.env.local` (git-ignored). Production builds never embed secrets directly. The Gemini API key lives only in Apps Script Script Properties, never in the client bundle.
- **Authenticated AI proxy**: The Apps Script chat endpoint requires a verified Firebase ID token issued for this project to an institutional (`@usm.cl` / `@sansano.usm.cl`) account. The Drive shared secret alone does not grant access to the server-side Gemini key, since that secret is distributed to every signed-in member.
- **AI proxy abuse limits**: Because the shared secret is fetched into every member's browser, a verified token proves *who* the caller is but not that their usage is bounded. The chat endpoint therefore rate-limits per verified email (fixed window), rejects oversized `contents` payloads, and clamps `maxOutputTokens` server-side, so a single member cannot weaponize the team's paid Gemini quota as an unmetered LLM proxy (financial DoS / cost amplification).
- **Spoof-resistant file ownership**: Upload and delete through the Drive bridge require a verified Firebase ID token (`REQUIRE_ID_TOKEN`), and the trusted uploader/owner email is derived from that token rather than the client-supplied `userEmail`. This prevents a holder of the shared secret from passing a victim's email to delete files they do not own.
- **Authenticate before side effects**: The bridge resolves the trusted identity *before* performing any Drive I/O. Previously `handleUpload` created the file and published it as anyone-with-the-link **before** calling the token check, so a caller holding only the shared secret (which is distributed to every signed-in member and therefore reaches the browser) could write arbitrary files into the team Drive with no valid Firebase session — the authorization error was raised after the write. The aborted upload also left a file with no `uploader:` tag, and the delete handler's backward-compatibility branch treated "no ownership metadata" as "anyone may delete this". Untagged files now fail closed.
- **Authoritative Firebase token verification**: ID tokens are validated via Identity Toolkit `accounts:lookup`, which is authoritative for *Firebase* ID tokens (the Web API key pins the audience to this project) and returns the account's verified email. `oauth2.googleapis.com/tokeninfo` validates Google **OAuth** ID tokens (issuer `accounts.google.com`), not the `securetoken.google.com` JWTs Firebase issues, so it is kept only as a fallback for deployments that have not yet set `FIREBASE_WEB_API_KEY`; when the key *is* configured, a rejected token is final and never downgrades to the weaker check. The fallback also now requires the `iss` claim to be present and to match, instead of accepting a missing issuer.
- **Server-side AI policy**: The chat proxy composes the final `systemInstruction` as *client instruction + immutable server policy*. The client builds that instruction (it injects live project context), so without a server-side suffix the "solo CubeSat" scope was a string any caller could simply omit, turning the team's paid Gemini key into a general-purpose LLM. Caller-supplied `systemInstruction` and `tools` payloads are size-bounded, and upload/delete are rate-limited per verified caller alongside chat.
- **Prompt-injection hardening**: Attached-document content is treated as untrusted data; the assistant is instructed never to execute tool calls based on instructions embedded in documents, and irreversible mass-broadcast actions (weekly digest dispatch) cannot be triggered in a turn that carries a file attachment.
- **Field-allowlist correctness (`affectedKeys` vs `changedKeys`)**: Every rule that constrains *which fields* a write may touch now diffs with `affectedKeys()`. `changedKeys()` only reports keys present in **both** the before and after documents whose value differs — keys a write *adds* are reported by `addedKeys()` and are invisible to it. Because a regular account carries no `rol` field at all, `changedKeys().hasOnly(allowedFields)` was trivially satisfied by a write that **added** `rol: 'admin'`, so any authenticated member could grant themselves the admin role on their own profile (and, under the previous blanket admin rule, continue to `maestro`). The same flaw applied to the task-update allowlist (an assignee could add any field the task did not already carry, including `puntajeImportancia`, the value the anti-fraud score check compares against) and to the post like-toggle. Verified against the Firestore emulator before and after the fix; covered by regression tests in `src/test/e2e/security-rules.e2e.test.ts`.
- **Rule helpers must not dereference missing fields**: `hasRole()` and `hasTeam()` now read through `data.get(field, default)`. Dereferencing an absent field (`userData.rol`, `userData.equipos`) raises an *evaluation error* in Firestore rules rather than yielding false, and an erroring sub-expression poisons the whole condition. Since registration writes neither `roles` nor `equipos`, that was the default state of every new account — and because `canManageWorkspace()` evaluates `hasTeam('manager')` first, a legitimate maestro/admin without an `equipos` array was denied every manager-gated write (creating tasks, projects and events, enqueuing mail). The authorization boundary was failing on well-formed data instead of on actual privileges.
- **Admin/maestro vertical boundary**: `admin` may manage regular members but can no longer grant or revoke roles, nor modify a user who already holds an elevated role. Previously the rules gave admins a blanket update on any user document, so any admin could write `rol: 'maestro'` onto their own profile to take over the workspace, or demote/deactivate the real maestro — contradicting both the documented policy and the client-side guard in `AuthContext.updateUserRole` (which is UX, not a boundary).
- **Firestore rules as the authorization boundary**: All privileged operations are enforced server-side by `firestore.rules`, not by the client. Notable hardening:
  - **Institutional-membership boundary**: the private workspace collections (`projects`, `tasks`, `files`, `events`, `activity_log`, `mail_digests`, `posts`, `comments`, `project_messages`) are readable/writable only by accounts whose token email matches the institutional domain (fully **anchored** regex, so `eve@usm.cl.evil.com` is rejected). The `@usm.cl` restriction in the registration form is only UX — an attacker can register any address straight against the Firebase Auth REST API — so the boundary is enforced in the rules via a shared `isInstitutional()` helper (token-claim only, no extra document reads).
  - **Verified institutional membership** *(closes the residual risk previously noted here)*: `isInstitutional()` now requires `request.auth.token.email_verified == true`, not just the domain. Firebase's email/password sign-up never checks that the person registering can receive mail at the address they typed, so the domain check alone was a claim anyone could make: registering `rector@usm.cl`, or a colleague's `nombre.apellido@sansano.usm.cl`, was enough to read every task, project, file record, post, event and member profile of a workspace whose entire premise is that it is private — and to write in the feed and project chats under that person's name, since the display name is derived from the email local part. It was the cheapest path past every other rule in the file. Enforcement is now paired with the in-app flow that makes it safe for members who registered before it existed: `AuthContext.signUp` sends the verification mail, and `ProtectedRoute` blocks the app behind a self-service gate (resend + re-check, which forces `getIdToken(true)` because the rules read the claim off the **token**, not off the Auth record). The one deliberate exception is creating and reading your **own** role-less profile, which sign-up must do before the mail can possibly have been opened; it carries no privilege, and every other operation on `/users` still requires a verified address. This also realigns Firestore with the Apps Script bridge, which has required a verified token all along.
  - The institutional-email gate on `system_config` (which holds the Drive shared secret) uses the same anchored helper, so look-alike attacker-controlled domains such as `eve@usm.cl.evil.com` cannot read the secret.
  - Social `posts` likes can only be toggled for the caller's **own** uid (validated via a symmetric-difference check on `likedBy` plus a `likesCount` integrity check), preventing tampering with other users' likes or counts.
  - `notifications` are constrained to the known `NotificationType` set with size-capped `title`/`message`. The `system` type — which renders as an official platform alert — is reserved for workspace managers (`canManageWorkspace()`); a regular member can no longer forge `system`-style in-app phishing alerts.
  - **Notification sender identity**: `senderId` was pinned to the caller's uid, but the name the Notifications page actually renders as the sender ("De: {senderName}", and the header of every inbox message) was free text, so a member could sign a message as the maestro or as any teammate — the same in-app phishing effect the `system` gate was added to prevent, reached by a different field. `senderName` must now be absent or match the caller's own profile, in exactly the shapes the shipped clients build (`nombre apellido`, a bare `nombre`, or the email/uid fallbacks `TaskManagement.tsx` uses when the profile has no name). There is deliberately **no** "profile has no name stored, allow anything" exemption: `nombre` is self-writable and `Profile.tsx` saves it verbatim from a free-text input, so such an exemption is re-entered at will by blanking your own name — an identity check must never be satisfiable by a value its own subject controls. Legacy documents are healed at the source instead: `AuthContext` backfills a missing `nombre`/`apellido` onto the profile on sign-in (the display name the UI already derived from the email is now actually persisted), so what the client shows and what the rules verify agree. A nameless profile can still sign with its own email or uid, which impersonates nobody. `nombre`/`apellido` are also size-capped — they were the last unbounded self-writable strings on the profile.
  - User-authored content (`posts`, `comments`, `project_messages`, `notifications`) is size-capped on **both create and update**, closing an author-only bypass that previously allowed unbounded growth on edit, to limit storage/egress abuse.
  - **Leaderboard integrity**: an assigned member completing their own task can only set `scoreAwarded` equal to the manager-defined `puntajeImportancia` (defaulting to `0` when absent, closing a legacy-task bypass that allowed arbitrary self-scoring), and can only credit the completion (`completedBy`) to **themselves**, not to an arbitrary third party.
  - **Audit-log integrity**: `activity_log` is the platform's append-only audit trail. Its `type` is now allowlisted to exactly the `ActivityLogType` values the app emits (mirroring the `notifications` allowlist), so a member can no longer forge audit entries of arbitrary types for themselves to pollute the shared performance feed; entries stay attributable to the caller (`userId == uid`), size-capped, and have no update/delete rule (append-only).
  - **Bounded file metadata**: `files` documents (Drive-backed repository metadata) require the uploader to be the caller and now size-cap the `name`/`viewURL`/`downloadURL`/`driveFileId` fields, so a member cannot write oversized metadata documents as a storage/egress-abuse vector. Rendered file URLs are additionally passed through `sanitizeUrl()` client-side.
  - **Authorship immutability**: `authorId` on `posts`/`comments` and `senderId` on `project_messages` are pinned on update, so an author can no longer re-attribute their own content to a colleague after the fact.
  - **Self-editable profile fields**: the self-update allowlist covers exactly what the app writes (`bio`, `title`, `socialLinks`, `portfolioImages`, `fechaCumpleanos`, `hasSeenOnboarding` were missing, so every profile save from a regular member was being denied) and caps their size — `portfolioImages` holds base64 data URLs and is a storage/egress-abuse vector.
  - **Roster confidentiality**: `mail_digests` embeds the full `recipients` list (every active member's email address) and is now readable only by workspace managers, matching where it is actually consumed in the UI.
  - **Bounded assistant-authored events**: `events` free-text fields are size-capped, since events are also created programmatically from model output.
- **AI blast-radius control**: in a chat turn that carries a file attachment, only read-only assistant tools may run. The previous policy blocked just the mass-broadcast action, leaving the rest of the write surface reachable by an injected document — including `auditarActaDrive` (mass task/event creation driven by the document's own text) and `registrarCumpleanos`/`gestionarCubeDesign`, which write to *other* users' documents. `auditarActaDrive` is additionally bounded in input length and in the number of documents a single turn may create, so a poisoned or oversized minute cannot amplify into unbounded Firestore writes.
- **The untrusted-attachment taint is session-scoped, not turn-scoped**: the read-only restriction
  above keyed off *this turn carrying a file*, but the document's extracted text is appended to the
  conversation history (`chatHistory` in proxy mode, the `ChatSession` history in direct mode) and
  keeps influencing every later turn. The guard was therefore bypassable with a single follow-up
  message: attach the poisoned minute, let the model answer, then send any plain text — the hidden
  instructions were still in context while `Boolean(fileData)` was already `false`, so the full
  write surface (`crearTarea`, `crearEvento`, `auditarActaDrive`, `registrarCumpleanos`,
  `gestionarCubeDesign`, `forzarEnvioNoticiario`) became reachable again. Once a session has
  ingested file content it stays tainted until `resetSession()`; the requester must start a clean
  chat to run a mutating action. Covered by regression tests in `src/sdk/BotService.test.ts`.
- **The assistant session is bound to the signed-in account**: `BotService` keeps its chat state in
  **static** fields that live as long as the tab, and `startSession` only reset them when the
  *role* changed. Signing out and signing in as someone else with the same role — two members with
  no role, two admins — therefore inherited the previous person's entire history: their private
  prompts, the live project/task context, the full text of any document they had attached, and
  that session's untrusted-content taint. On the shared lab machines the team actually uses, that
  is a cross-account data leak. The chat is now cleared on every Firebase auth-state change that
  alters the uid, the same lifecycle binding `SecretsService` already applies to the Drive secret.
- **The Drive bridge endpoint is maestro-only and host-pinned**: `system_config/keys` does not just
  hold a secret — it holds `driveUploadUrl`, the endpoint to which every client posts the signed-in
  user's **Firebase ID token** along with file bytes and the full chat history (`FileService`
  and `BotService` attach `idToken` on every call). Write access was granted to `admin`, so an
  admin could repoint it at an Apps Script deployment of their own — which the CSP accepts, since
  it lives on the very same `script.google.com` host — and harvest ID tokens for the whole team,
  the maestro included; those tokens impersonate their holder against Firestore until they expire.
  That was a back door around the admin→maestro boundary the `/users` rules exist to enforce, so
  writes are now maestro-only. As defence in depth the client validates the endpoint before
  sending anything (`SecretsService.isTrustedBridgeUrl`): only `https://script.google.com` and
  `https://script.googleusercontent.com` are accepted (plus `localhost` in dev), and anything else
  makes the bridge report itself unconfigured rather than receive the token. Read access is
  unchanged — every member needs the endpoint to upload at all.
- **Role bootstrap is not client-reachable**: registration writes a role-less profile, and no rule
  authorizes a client write that carries `rol`/`roles` on create. The removed mechanism worked the
  other way round: `AuthContext.signUp` claimed a one-time `users/_bootstrap_lock` document inside
  a transaction, and the create rule then honoured `rol: 'maestro'` *because the lock named that
  uid* — a lock the same client had written milliseconds earlier. The lock was therefore not
  evidence of being first, only evidence of having gone first in that request. On any workspace
  where the document was absent — every project provisioned before the lock was introduced, and
  any workspace where a maestro deleted it (`delete` on `/users/{userId}` is maestro-allowed and
  matches `_bootstrap_lock` too) — the **next person to register silently became maestro of the
  entire workspace**, with an `@usm.cl` / `@sansano.usm.cl` address as the only prerequisite.
  Verified against the Firestore emulator: with the previous ruleset the self-claimed lock write
  succeeds; it is now denied, and covered by a regression test in
  `src/test/e2e/security-rules.e2e.test.ts`. See *Provisioning the first maestro* above.
- **CI/CD provenance — no deploy from unreviewed pull requests**: `deploy.yml` runs on
  `workflow_run` after CI, which executes in *this* repository's context with its secrets and
  `pages: write`. The `branches:` filter matches the **triggering run's head branch**, and CI runs
  on `pull_request`, so a fork whose default branch is named `main` produced a completed CI run
  with `head_branch == 'main'` — satisfying the old condition. The deploy job then checked out
  `workflow_run.head_sha` (the fork's commit) and ran `npm ci` + `npm run build` on it: arbitrary
  code execution from an unreviewed pull request, able to exfiltrate every configured secret and
  publish attacker-controlled content to the live GitHub Pages site (the classic "pwn request").
  The job now additionally requires the triggering run to be a `push`, on `main`, from this
  repository. Publishing scopes (`pages`, `id-token`) were also moved from the workflow level down
  to the single job that deploys.
- **Clickjacking**: `X-Frame-Options` and CSP `frame-ancestors` are both ignored in a `<meta>` tag
  and GitHub Pages does not let us set response headers, so the app could be framed by any origin
  and used for UI redress against a signed-in maestro (role changes, member deletion, digest
  dispatch are all one click). `index.html` now blanks the document when it detects it is framed.
- **Mail is not an open relay**: documents in `/mail` are dispatched by the Firebase *Trigger
  Email* extension from the team's own SMTP identity. Gating creation on `canManageWorkspace()`
  stopped members from spamming but still left arbitrary HTML to arbitrary recipients available to
  anyone holding that privilege — and `manager` is a self-service *team*, granted by any admin, not
  a vetted role. Recipients are now constrained to the same anchored institutional pattern used
  everywhere else (the legitimate digest only ever mails registered members) and the payload is
  size-capped.
- **Bounds are enforced where the data actually is**: several caps guarded the wrong field or the
  wrong operation. Profile size limits ran only on `update`, so a member could simply write the
  oversized document at registration and never touch it again. `posts.imageUrls` and
  `project_messages.fileUrls` hold **base64 data URLs** (there is no Storage bucket — the picture
  lives in the document), so capping only the text left the real storage/egress vector open; both
  arrays are now length-bounded, as is `photoURL`, the largest self-writable field. On the
  assignee path of `tasks`, the field allowlist said *which* fields could be written but nothing
  said *how much*: `progressUpdates`, `deliverables` and `attachmentIds` are append-only arrays a
  member could grow to Firestore's 1 MiB ceiling on every task assigned to them. `estado` was
  likewise an allowlisted field with an unconstrained value and is now pinned to the `TaskStatus`
  enum.
- **Drive bridge input validation**: `taskId` / `projectId` are used verbatim as Drive **folder
  names**, so an unvalidated value let any authenticated member mint arbitrarily-named folders in
  the team Drive, one per request (folder spam / quota exhaustion, and folders whose names
  impersonate real ones). Both are now matched against a document-id pattern and fall back to
  `general/` otherwise. Oversized uploads are also rejected on the *encoded* length, before the
  blob is decoded into the script's memory and before any Drive I/O.
- **Notification integrity after creation**: the `notifications` create rule pins `senderId`,
  forces a truthful `senderName` and reserves `type: 'system'` for workspace managers — but all
  three ran **only on create**, and the recipient could update any field, `recipientId` included.
  A member could therefore address a perfectly legitimate `message` notification to themselves and
  then *update* it (the rule was satisfied: they were still the recipient at the time of the
  write), re-pointing it at a colleague as an official-looking `system` alert signed "Maestro USM
  CubeSat" — every impersonation guarantee bypassed, and the size caps with them. The recipient
  may now change only the `read` flag, which is the single update any shipped client performs
  (`NotificationService.markAsRead`); dismissal remains a delete.
- **`/mail` is not an open relay**: constraining `to` closed exactly one of the recipient fields
  the Firebase *Trigger Email* extension honours. It also resolves `cc`, `bcc`, `toUids`, `ccUids`
  and `bccUids`, and acts on `from`, `replyTo`, `headers`, `template` and `message.attachments` —
  whose `path` / `href` form makes the extension **fetch an arbitrary URL** and attach it. A
  `manager` (a self-service *team* any admin can grant, not a vetted role) could therefore enqueue
  an institutional `to` alongside `bcc: ['victima@example.com']` and deliver their own HTML to any
  address on earth from the team's SMTP identity, with its SPF/DKIM and a spoofable `from`.
  Blocking field names one at a time loses against an extension whose schema can grow, so the rule
  now pins the **document shape** to exactly what the only legitimate producer writes
  (`EmailNotificationService.sendWeeklyDigest`: `to`, `message.{subject,html,text}`, `createdAt`).
- **Avatars cannot become tracking beacons**: `img-src` was `'self' data: https:`, while
  `photoURL`, `posts.imageUrls`, `portfolioImages` and `project_messages.fileUrls` are
  self-writable free-text fields that the clients only ever fill with `data:` URLs. Any member
  could point their own avatar at a URL they control and turn Members, Feed, Dashboard and the
  project chat into a beacon logging every teammate's IP, user-agent and visit time — passively,
  just by being listed. `img-src` is now `'self' data:`, which covers every image the app actually
  renders (bundled assets and client-built data URLs).
- **Content cannot be relocated after the fact**: `comments.postId` and
  `project_messages.projectId` are pinned on update, the mirror image of the existing `authorId` /
  `senderId` pins. Without them an author could move an existing comment or message onto a
  different post or project chat after it had been written and read.
- **Bounded assistant-written documents**: `tasks` (create and the manager update path) and
  `projects` now carry the same size/shape caps `events` already had, and for the same reason —
  `AdminActionsService.crearTarea` and `.auditarActaDrive` write these fields straight from model
  output, often derived from an uploaded document, so the rules bound what one manipulated
  assistant turn can persist. The busier of the two write paths was the uncapped one.
- **Bounded audit entries**: `activity_log` capped `description` and `relatedId` while `metadata`
  stayed a free-form map with no ceiling, which made the other caps decorative. Entries are now
  bounded by total key count, by `metadata` key count (rules cannot measure a nested map's bytes)
  and on the `taskId` / `projectId` / `deliverableId` fields. The log is append-only, permanent
  and read by every member's Dashboard/Members query, so an oversized entry cannot be pruned by
  anyone but the operator.
- **Fully bounded profiles**: `socialLinks` and `questionnaire` are free-text **maps** in the
  self-update allowlist and had no ceiling at all — the profile was bounded everywhere someone had
  thought to look, and unbounded here. Both are now key-allowlisted and per-field size-capped,
  alongside `career`, `year` and `fechaCumpleanos`. *Known limitation:* rules cannot iterate a
  list, so the per-element size of `portfolioImages` stays bounded only by the array length (8)
  and Firestore's own 1 MiB document ceiling.
- **AI proxy cost controls cannot be bypassed by the caller's config**: the chat proxy used to
  forward `params.generationConfig` verbatim and then clamp a single field. `maxOutputTokens`
  bounds one *candidate*, not the request: a caller who kept it at the cap and asked for
  `candidateCount: 8` got eight times the tokens the clamp exists to prevent, per call, within the
  rate limit — and since the shared secret reaches every member's browser, "the caller" is anyone
  who can read it. The config is now **rebuilt from an allowlist** (clamped `maxOutputTokens` and
  `temperature`, `candidateCount` pinned to 1, everything else dropped), and `contents` must be a
  non-empty array within a turn cap instead of merely being truthy.
- **Validated assistant tool arguments**: tool arguments are written by the *model*, not the
  person, and may have been influenced by an attached document. `registrarCumpleanos` and
  `gestionarCubeDesign` are the only actions that write to **another** user's document, so
  `miembroId` is matched against a document-id pattern (the Firestore SDK joins path segments with
  `/`, so a value containing slashes addresses a different path than intended) and `fecha` against
  the `MM-DD` / `YYYY-MM-DD` formats the tool declares — both before any Firestore call. The
  proxy-mode declaration of `auditarActaDrive` was also realigned with the parameters the action
  actually consumes, so undefined arguments no longer reach a bulk-write action.
- **Escaped digest output**: every untrusted field interpolated into the weekly digest is escaped;
  the event-date helper returned its input **raw** when it could not be formatted, which was an
  unescaped injection point in HTML mailed to every active member.
- **Stored prompt injection through the assistant's live context**: `BotService.getDomainContext()`
  interpolates project names, project descriptions and task titles straight into
  `systemInstruction` — the part of the prompt the model treats as the operator's own voice, not
  as data. Those strings are workspace-writable (`manager` is a self-service *team* any admin can
  grant) and, crucially, are also written by the assistant itself: `auditarActaDrive` turns the
  text of an uploaded minute into a batch of tasks. That closed a loop around the
  attachment-taint control documented above. The taint is session-scoped, so it ends at
  `resetSession()` — but the *documents* the tainted turn created do not. Text smuggled into a
  task title was laundered into permanent, untainted state and then re-entered the system
  instruction of **every later session of every administrator**, with the full write surface
  available (`forzarEnvioNoticiario` mails every active member; `registrarCumpleanos` and
  `gestionarCubeDesign` write to other people's profiles). No attachment had to be present, so
  no guard fired. The context is now fenced in an explicitly-marked untrusted block that the
  security rule names, and every interpolated value is neutralised before it gets there:
  newlines and control characters are flattened, `<`/`>` (the fence delimiters) and `[`/`]`
  (the shape of the prompt's real headers, e.g. `[MODO ADMINISTRADOR ACTIVO]`) are stripped, and
  each field, list and the block as a whole are length-bounded, so no stored document can close
  the fence, forge a header or crowd out the rest of the prompt. Covered by regression tests in
  `src/sdk/BotService.test.ts`.
- **Document *shape* is bounded, not just the fields someone remembered**: every size cap in the
  rules so far named a specific field — `content`, `imageUrls`, `description`, `photoURL`. None of
  the member-writable collections (`posts`, `comments`, `project_messages`, `notifications`,
  `files`, `events`, `mail_digests`) pinned the document's shape, so the same megabyte simply went
  into a field nobody had enumerated: `addDoc('comments', { postId, authorId, content: 'hola',
  relleno: 'A'.repeat(900000) })` satisfied every check and produced a ~1 MiB document, repeatable
  at will. These are exactly the collections the Feed, the project chat and the file repository
  download **in full** for every member, so it is a storage *and* billed-egress vector that every
  existing cap missed by construction. Each collection now declares `keys().hasOnly(...)` matching
  what its service actually writes (plus per-field caps on the ones that had none — `mimeType`,
  `postId`, `projectId`, `relatedId`, the event date fields), and the manager-only `tasks` /
  `projects` carry a total key-count cap for the same reason `activity_log` already did.
- **`createdAt` is a claim, and was never checked**: no rule validated it. The Feed orders by
  `orderBy('createdAt', 'desc')`, so writing a year-3000 timestamp pinned a post at the top of the
  whole team's wall permanently; in `activity_log` — which the platform presents as an immutable
  audit trail, with no update or delete rule — it let a member falsify *when* an action happened,
  irreversibly. `createdAt` must now be a timestamp no further ahead than `request.time` plus five
  minutes of clock skew (the clients that use `Timestamp.now()` rather than `serverTimestamp()`
  are well inside that), and updates can no longer rewrite it after the fact.
- **The password policy was written but never enforced**: `userRegistrationSchema` in
  `src/lib/schemas.ts` has required a mixed-case password with a digit since it was added, and
  `Register.tsx` — the only registration path in the app — never called it. It hand-rolled a bare
  `password.length < 8` check, and Firebase Auth imposes no complexity of its own, so `12345678`
  or `contrasena` created a real account. These are not low-value accounts: every institutional
  account reads every task, project, file record, post, event and profile in a workspace whose
  premise is that it is private, and any of them can be promoted to `admin` or `maestro`. The form
  now validates against the schema instead of maintaining a weaker parallel check.
- **Deleting a file no longer hides it while leaving it published**: every upload is published to
  Drive as *anyone with the link can view*, and the bridge only authorises deletion by the
  original uploader (the trusted email comes from the verified ID token). `firestore.rules`,
  however, lets any workspace manager delete the metadata document. Those two boundaries do not
  line up, so on the ordinary path — a manager tidying the repository — the bridge call failed
  with `unauthorized: you can only delete files you uploaded`… and `FileService.delete` swallowed
  it with a warning and deleted the metadata anyway. The file stayed alive in the team Drive,
  reachable forever by its public URL, with no record left in Firestore pointing at it: nobody
  could find it from the app again, let alone retry the deletion. "Delete" removed the pointer
  and kept the access — the inverse of what the user was told happened, and the worst possible
  failure mode for a deletion. It now fails closed: if the binary is still in Drive the metadata
  is kept and the caller is told who can remove it.
- **Dependency hygiene**: the production dependency tree is clean (`npm audit --omit=dev`) after
  raising the `fast-uri` override past the host-confusion / SSRF advisories. The remaining
  moderate advisories are dev-only and live inside `firebase-tools`' transitive tree, where the
  available fixes are breaking; they never reach the shipped bundle. One of those overrides had
  gone further than "breaking": forcing `stream-json` to `^3.5.0` workspace-wide (for
  GHSA-528h-pc64-c93x) replaced a CommonJS package with a pure-ESM rewrite whose subpaths were
  renamed, so `firebase-tools` — which requires `stream-json/filters/Filter` — could no longer
  load **at all**. Every `firebase` CLI invocation died with `Cannot find module`, which silently
  took out `npm run emulators`, `npm run test:e2e` and the CLI path used to deploy
  `firestore.rules`. CI only runs `lint`/`test`/`build`, so nothing reported it: the entire
  regression suite guarding the project's authorization boundary had stopped being runnable. The
  override is now scoped so `firebase-tools` keeps the `1.x` line it is written against while the
  rest of the tree stays on the patched major. The residual advisory is dev-only, moderate, and
  reachable only by running `firebase database:import` over hostile JSON on your own machine —
  a far smaller risk than being unable to test or deploy the security rules.
- **Membership revocation (`isActive`)**: the workspace boundary used to be identity only — a
  verified `@usm.cl` / `@sansano.usm.cl` address — so there was no way to remove someone from
  the team. A former member (or a compromised account) kept reading every task, project, file,
  event and post, and writing to the feed, chats and notifications, for as long as the address
  resolved. Deleting the profile did not help because `create` on `/users` lets the owner
  recreate it. `isInstitutional()` now also requires the caller's profile not to carry
  `isActive: false`; the member cannot flip it back (not self-editable, forced to `true` on
  create, and they cannot delete their own profile). A missing profile or a profile without the
  field counts as active, like the client does. **To offboard someone**, set `isActive` to
  `false` on `users/{uid}` (Firebase console, or as maestro/admin within the role boundary); the
  app shows them a "Cuenta desactivada" screen. The Drive/Gemini bridge still authenticates by ID
  token only, so for a complete cut also **disable the account** in Firebase Authentication,
  which the bridge's `accounts:lookup` check honours.
- **Drive bridge — no API key in URLs or error bodies**: the Gemini proxy put `GOOGLE_AI_KEY` in
  the request query string, and `doPost` returned any exception's `message` to the browser.
  `UrlFetchApp` network failures ("Address unavailable", timeouts) quote the full request URL, so
  a failed call handed the team's paid key to any verified member. The key now travels in the
  `x-goog-api-key` header, only errors the script raises on purpose (`clientError_`) are echoed,
  anything else returns a generic `server error` (details stay in the owner's execution logs),
  and Gemini's raw error body is logged instead of forwarded.
- **Drive bridge — deletes confined to the repository folder**: `handleDelete` resolved any file
  the script owner can reach (`DriveApp.getFileById`) and trusted the `uploader:` tag in its
  description. Anyone with edit access to a file shared with the owner can write that
  description, so the bridge would trash files outside the team repository on their behalf.
  Deletion now requires the file to live under `FOLDER_ID`.
- **Drive bridge — atomic rate limiting**: the per-caller limiter did a non-atomic
  read-compare-write on `CacheService`, so firing requests in parallel bypassed the per-minute
  cap on uploads, deletes and the paid Gemini proxy. The critical section is now serialized with
  `LockService` and fails closed if the lock cannot be acquired.
- **Known residual risk — deliverable self-approval**: an assignee may rewrite the whole
  `deliverables` array of their task (the field is in their allowlist), which includes each
  item's `estado`. Rules cannot iterate a list, so they cannot stop an assignee from marking
  their own deliverable `aprobado`. Closing it needs a data-model change (approval stored in a
  manager-only field, e.g. `approvedDeliverableIds`), tracked for a follow-up.
- **Branch protection**: Main branch requires pull request reviews before merging

## Response Time

We aim to respond to security reports within 48 hours and will keep you updated on the progress of the fix.
