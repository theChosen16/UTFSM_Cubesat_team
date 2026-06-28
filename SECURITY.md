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
- **Prompt-injection hardening**: Attached-document content is treated as untrusted data; the assistant is instructed never to execute tool calls based on instructions embedded in documents, and irreversible mass-broadcast actions (weekly digest dispatch) cannot be triggered in a turn that carries a file attachment.
- **Firestore rules as the authorization boundary**: All privileged operations are enforced server-side by `firestore.rules`, not by the client. Notable hardening:
  - The institutional-email gate on `system_config` (which holds the Drive shared secret) uses a fully **anchored** regular expression, so look-alike attacker-controlled domains such as `eve@usm.cl.evil.com` cannot read the secret.
  - Social `posts` likes can only be toggled for the caller's **own** uid (validated via a symmetric-difference check on `likedBy` plus a `likesCount` integrity check), preventing tampering with other users' likes or counts.
  - `notifications` are constrained to the known `NotificationType` set with size-capped `title`/`message`, preventing forged `system`-style in-app phishing alerts.
  - User-authored content (`posts`, `comments`, `project_messages`, `notifications`) is size-capped to limit storage/egress abuse.
- **Branch protection**: Main branch requires pull request reviews before merging

## Response Time

We aim to respond to security reports within 48 hours and will keep you updated on the progress of the fix.
