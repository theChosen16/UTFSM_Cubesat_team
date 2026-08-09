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

## Security Measures

This project implements the following security practices:

- **Dependency scanning**: Automated via Dependabot
- **Code scanning**: Automated via CodeQL
- **Secrets protection**: Firebase credentials stored as GitHub Secrets for CI/CD. Local development uses `.env.local` (git-ignored). Production builds never embed secrets directly. The Gemini API key lives only in Apps Script Script Properties, never in the client bundle.
- **Authenticated AI proxy**: The Apps Script chat endpoint requires a verified Firebase ID token issued for this project to an institutional (`@usm.cl` / `@sansano.usm.cl`) account. The Drive shared secret alone does not grant access to the server-side Gemini key, since that secret is distributed to every signed-in member.
- **AI proxy abuse limits**: Because the shared secret is fetched into every member's browser, a verified token proves *who* the caller is but not that their usage is bounded. The chat endpoint therefore rate-limits per verified email (fixed window), rejects oversized `contents` payloads, and clamps `maxOutputTokens` server-side, so a single member cannot weaponize the team's paid Gemini quota as an unmetered LLM proxy (financial DoS / cost amplification).
- **Spoof-resistant file ownership**: Upload and delete through the Drive bridge require a verified Firebase ID token (`REQUIRE_ID_TOKEN`), and the trusted uploader/owner email is derived from that token rather than the client-supplied `userEmail`. This prevents a holder of the shared secret from passing a victim's email to delete files they do not own.
- **Prompt-injection hardening**: Attached-document content is treated as untrusted data. Beyond instructing the assistant never to act on instructions embedded in documents (an instruction is not a control), a turn that carries an attachment can only invoke **read-only** tools — an allowlist, so any tool added later is blocked by default. This covers `auditarActaDrive` in particular, whose whole input *is* the document text and which mass-creates tasks and calendar events: a doctored meeting minute could otherwise inject arbitrary records into Firestore simply by being handed to an admin to summarize.
- **Drive bridge containment**: The Apps Script web app runs with the Drive owner's permissions, so `DriveApp.getFileById()` can resolve any file that account can reach. Deletes therefore require the target to live under the managed root folder **and** carry an `uploader:` tag matching the verified caller; untagged files fail closed. Uploads authenticate before writing anything to Drive, and upload/delete are rate-limited per verified email alongside chat.
- **Firestore rules as the authorization boundary**: All privileged operations are enforced server-side by `firestore.rules`, not by the client. Notable hardening:
  - **`affectedKeys()`, never `changedKeys()`, for field allowlists**: `MapDiff.changedKeys()` only reports keys present in **both** the before and after documents with a different value; a key that did not exist before is reported by `addedKeys()` and is therefore invisible to it. Every allowlist built on `changedKeys()` was a no-op for absent fields — a plain member could write `{ rol: 'maestro' }` or `{ equipos: ['manager'] }` onto their own profile and the diff came back empty, satisfying `hasOnly()` trivially and handing them full control of the workspace. The same flaw let a task assignee add any field the task did not already carry, and let a non-author add fields to somebody else's post while "liking" it. All three allowlists now use `affectedKeys()` (added ∪ removed ∪ changed) and are covered by emulator tests that specifically exercise the *added-key* case.
  - **Content authorship is immutable**: `posts.authorId`, `comments.authorId`, `project_messages.senderId` and the notification recipient/sender cannot be rewritten on update. The author branch of each rule authorizes against the *stored* id, so without pinning it an author could re-attribute arbitrary content to a teammate; comment/message threading (`postId`, `projectId`) is pinned for the same reason.
  - **`/mail` is a send-as-us primitive**: documents there are delivered by the team's authenticated sender via the Trigger Email extension. Recipients are confined to the institutional domain (same anchored pattern used elsewhere) and subject/body are size-capped, so a hijacked manager session cannot mail arbitrary HTML to arbitrary external addresses under the team's identity.
  - **Profile identity and size**: a profile can only be created under the email the verified token asserts, and `email` is self-writable only to re-state that same address (it is otherwise the key the members directory and the weekly-digest recipient list use). Avatars and portfolio images are stored as base64 data URLs inside the user document, so those fields are size-capped — otherwise a member could push documents toward the 1 MiB limit and inflate the read cost of every page that lists members.
  - **Directory reads are member-wide, writes are not**: `users` is readable by any institutional member because the team tree, member metrics, feed authorship, task assignees and notification sender names all resolve through `UserService.getAll()`. Restricting reads to self/maestro/admin protected nothing a member could not already infer from the collaborative documents they can read, while denying the collection query the whole UI is built on — a rule that fails closed into a broken app is a rule that gets deleted.
  - **Institutional-membership boundary**: the private workspace collections (`projects`, `tasks`, `files`, `events`, `activity_log`, `mail_digests`, `posts`, `comments`, `project_messages`) are readable/writable only by accounts whose token email matches the institutional domain (fully **anchored** regex, so `eve@usm.cl.evil.com` is rejected). The `@usm.cl` restriction in the registration form is only UX — an attacker can register any address straight against the Firebase Auth REST API — so the boundary is enforced in the rules via a shared `isInstitutional()` helper (token-claim only, no extra document reads). *Residual risk / recommended next step:* the helper checks the domain but not `email_verified`, to avoid locking out existing unverified email/password members; requiring verified institutional emails end-to-end (as the Apps Script bridge already does) is the recommended hardening once an in-app verification flow exists.
  - The institutional-email gate on `system_config` (which holds the Drive shared secret) uses the same anchored helper, so look-alike attacker-controlled domains such as `eve@usm.cl.evil.com` cannot read the secret.
  - Social `posts` likes can only be toggled for the caller's **own** uid (validated via a symmetric-difference check on `likedBy` plus a `likesCount` integrity check), preventing tampering with other users' likes or counts.
  - `notifications` are constrained to the known `NotificationType` set with size-capped `title`/`message`. The `system` type — which renders as an official platform alert — is reserved for workspace managers (`canManageWorkspace()`); a regular member can no longer forge `system`-style in-app phishing alerts.
  - User-authored content (`posts`, `comments`, `project_messages`, `notifications`) is size-capped on **both create and update**, closing an author-only bypass that previously allowed unbounded growth on edit, to limit storage/egress abuse.
  - **Leaderboard integrity**: an assigned member completing their own task can only set `scoreAwarded` equal to the manager-defined `puntajeImportancia` (defaulting to `0` when absent, closing a legacy-task bypass that allowed arbitrary self-scoring), and can only credit the completion (`completedBy`) to **themselves**, not to an arbitrary third party.
  - **Audit-log integrity**: `activity_log` is the platform's append-only audit trail. Its `type` is now allowlisted to exactly the `ActivityLogType` values the app emits (mirroring the `notifications` allowlist), so a member can no longer forge audit entries of arbitrary types for themselves to pollute the shared performance feed; entries stay attributable to the caller (`userId == uid`), size-capped, and have no update/delete rule (append-only).
  - **Bounded file metadata**: `files` documents (Drive-backed repository metadata) require the uploader to be the caller and now size-cap the `name`/`viewURL`/`downloadURL`/`driveFileId` fields, so a member cannot write oversized metadata documents as a storage/egress-abuse vector. Rendered file URLs are additionally passed through `sanitizeUrl()` client-side.
- **Branch protection**: Main branch requires pull request reviews before merging

## Response Time

We aim to respond to security reports within 48 hours and will keep you updated on the progress of the fix.
