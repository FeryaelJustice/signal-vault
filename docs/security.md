# SignalVault — Security Model

SignalVault is a portfolio project whose entire reason for existing is to demonstrate
sound application security. This document states the model explicitly.

## Threat model (in scope)

- **Lost/stolen device**: vault content must not be readable without the user's
  biometric/passphrase, even with the app installed and logged in.
- **Server compromise / DB dump**: an attacker with full read access to PostgreSQL must
  not recover note or message plaintext.
- **Token theft**: short access-token lifetime + rotating refresh tokens limit the blast
  radius of a leaked token.
- **Unauthorized API/WebSocket access**: every protected endpoint and every WebSocket
  connection requires a valid JWT; users cannot read other users' data.

## Out of scope (MVP)

File attachments, push notifications, multi-device conflict resolution, automatic key
rotation after membership changes, and public-key identity verification. Shared rooms do
support client-side room keys, but the current invite flow still depends on the inviter
sharing the generated invite link over a trusted channel.

## Controls

### Authentication
- Passwords hashed with **BCrypt** (work factor ≥ 10).
- **JWT** access tokens (~15 min) signed with an HMAC secret from the environment.
- **Rotating refresh tokens** (~7 days): each refresh invalidates the prior token; reuse
  is detectable.
- Web stores the refresh token in an **HttpOnly + Secure + SameSite** cookie (not readable
  by JS → mitigates XSS token theft); the access token lives only in memory.

### Authorization
- Spring Security **stateless** filter chain; all `/api/**` except auth endpoints require a
  valid Bearer token.
- Ownership checks on notes and membership checks on rooms/messages (no IDOR; cross-user ⇒ 404).
- Room owners can invite members. Invited users can accept only invites addressed to their
  account email. Non-owner members can leave rooms.
- WebSocket CONNECT frames are authenticated by a `ChannelInterceptor`.

### Data-at-rest (zero-knowledge notes/messages)
- Note content and message bodies are **encrypted client-side** with **AES-GCM**; the
  server persists only ciphertext envelopes `{v, salt, iv, ciphertext}` (base64).
- Web derives the AES key from a passphrase via **PBKDF2** (random salt, ≥200k iterations);
  the key stays in memory for the unlocked session only.
- Each shared room has a random client-generated room key. The server stores only
  per-member encrypted copies of that room key (`encryptedRoomKey`) plus encrypted
  messages. Invite links place the raw room key in the URL fragment (`#roomKey=...`),
  which is not sent to the backend.
- Native clients back the key with the platform secure element (Android Keystore / iOS
  Keychain) gated by biometrics.

### Transport & platform
- CORS restricted to the configured web origin with credentials enabled only for that origin.
- Input validation (`jakarta.validation`) on all request bodies.
- SQL injection protection: backend data access uses Spring Data JPA repositories and JPQL
  with named parameters. Do not build SQL/JPQL by concatenating user input.
- Secrets (JWT secret, DB credentials) injected via environment, never committed.

## Roadmap hardening
Token rotation telemetry, certificate pinning (mobile), rate limiting (bucket4j),
WebAuthn/passkey PRF key-wrapping on web, Argon2id for password hashing, audit logging.
