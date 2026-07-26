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
- **Prompt-injection hardening**: Attached-document content is treated as untrusted data; the assistant is instructed never to execute tool calls based on instructions embedded in documents, and irreversible mass-broadcast actions (weekly digest dispatch) cannot be triggered in a turn that carries a file attachment.
- **Firestore rules as the authorization boundary**: All privileged operations are enforced server-side by `firestore.rules`, not by the client. Notable hardening:
  - **Institutional-membership boundary**: the private workspace collections (`projects`, `tasks`, `files`, `events`, `activity_log`, `mail_digests`, `posts`, `comments`, `project_messages`) are readable/writable only by accounts whose token email matches the institutional domain (fully **anchored** regex, so `eve@usm.cl.evil.com` is rejected). The `@usm.cl` restriction in the registration form is only UX — an attacker can register any address straight against the Firebase Auth REST API — so the boundary is enforced in the rules via a shared `isInstitutional()` helper (token-claim only, no extra document reads). *Residual risk / recommended next step:* the helper checks the domain but not `email_verified`, to avoid locking out existing unverified email/password members; requiring verified institutional emails end-to-end (as the Apps Script bridge already does) is the recommended hardening once an in-app verification flow exists.
  - The institutional-email gate on `system_config` (which holds the Drive shared secret) uses the same anchored helper, so look-alike attacker-controlled domains such as `eve@usm.cl.evil.com` cannot read the secret.
  - Social `posts` likes can only be toggled for the caller's **own** uid (validated via a symmetric-difference check on `likedBy` plus a `likesCount` integrity check), preventing tampering with other users' likes or counts.
  - `notifications` are constrained to the known `NotificationType` set with size-capped `title`/`message`. The `system` type — which renders as an official platform alert — is reserved for workspace managers (`canManageWorkspace()`); a regular member can no longer forge `system`-style in-app phishing alerts.
  - User-authored content (`posts`, `comments`, `project_messages`, `notifications`) is size-capped on **both create and update**, closing an author-only bypass that previously allowed unbounded growth on edit, to limit storage/egress abuse.
  - **Leaderboard integrity**: an assigned member completing their own task can only set `scoreAwarded` equal to the manager-defined `puntajeImportancia` (defaulting to `0` when absent, closing a legacy-task bypass that allowed arbitrary self-scoring), and can only credit the completion (`completedBy`) to **themselves**, not to an arbitrary third party.
- **Branch protection**: Main branch requires pull request reviews before merging

## Response Time

We aim to respond to security reports within 48 hours and will keep you updated on the progress of the fix.
