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

End-to-end cryptography *between users*, file attachments, push notifications, multi-device
conflict resolution. (Listed as roadmap items, not implemented.)

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
- Ownership checks on every note/room/message resource (no IDOR; cross-user ⇒ 404).
- WebSocket CONNECT frames are authenticated by a `ChannelInterceptor`.

### Data-at-rest (zero-knowledge notes/messages)
- Note content and message bodies are **encrypted client-side** with **AES-GCM**; the
  server persists only ciphertext envelopes `{v, salt, iv, ciphertext}` (base64).
- Web derives the AES key from a passphrase via **PBKDF2** (random salt, ≥200k iterations);
  the key stays in memory for the unlocked session only.
- Native clients back the key with the platform secure element (Android Keystore / iOS
  Keychain) gated by biometrics.

### Transport & platform
- CORS restricted to the configured web origin with credentials enabled only for that origin.
- Input validation (`jakarta.validation`) on all request bodies.
- Secrets (JWT secret, DB credentials) injected via environment, never committed.

## Roadmap hardening
Token rotation telemetry, certificate pinning (mobile), rate limiting (bucket4j),
WebAuthn/passkey PRF key-wrapping on web, Argon2id for password hashing, audit logging.
