<div align="center">

# 🛡️ SignalVault

**Secure realtime notes & private messages — one backend, three clients.**

Android · iOS · Web, backed by a Spring Boot API.

[![backend](https://github.com/OWNER/signal-vault/actions/workflows/backend.yml/badge.svg)](.github/workflows/backend.yml)
[![web](https://github.com/OWNER/signal-vault/actions/workflows/web.yml/badge.svg)](.github/workflows/web.yml)
[![android](https://github.com/OWNER/signal-vault/actions/workflows/android.yml/badge.svg)](.github/workflows/android.yml)
[![ios](https://github.com/OWNER/signal-vault/actions/workflows/ios.yml/badge.svg)](.github/workflows/ios.yml)

</div>

> Replace `OWNER` in the badge URLs once the repo is pushed to GitHub.

## What it is

SignalVault lets users protect sensitive notes behind a biometric/passphrase **vault** and
exchange **realtime** private messages in secure rooms. Note and message content is
**encrypted on the client** — the server only ever stores ciphertext (zero-knowledge).

It is intentionally small, but every feature demonstrates a skill that shows up in strong
engineering roles: native security, realtime resiliency, JWT auth, an enterprise backend,
client-side cryptography, and CI across four targets.

## Why a monorepo

One clone shows the whole product. A single API contract drives every client, changes stay
atomic, and CI uses path filters so each app only builds when it changes. See
[ADR-001](docs/adr/ADR-001-monorepo.md) and [ADR-002](docs/adr/ADR-002-shared-backend.md).

## Repository layout

```text
signal-vault/
├── signal-vault-backend/   # Spring Boot API (shared by all clients)
├── signal-vault-web/       # Next.js (React + TS) web client
├── signal-vault-android/   # Kotlin + Jetpack Compose  (skeleton + roadmap)
├── signal-vault-ios/       # SwiftUI                    (skeleton + roadmap)
├── docs/                   # architecture, API contract, security, ADRs
├── docker-compose.yml      # postgres + signalvault-api
└── .github/workflows/      # path-filtered CI per app
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for diagrams. In short: every client
authenticates with a short-lived JWT (+ rotating refresh token), reads/writes
client-encrypted notes over REST, and joins realtime rooms over STOMP/WebSocket. The
backend never sees plaintext note or message content.

## Quick start (backend + web)

Prerequisites: Docker + Docker Compose, Node ≥ 20 with `pnpm`.

```bash
# 1) Backend + database
docker compose up -d --build
#    API     → http://localhost:8080
#    Swagger → http://localhost:8080/swagger-ui.html
#    Health  → http://localhost:8080/actuator/health

# 2) Web client
cd signal-vault-web
pnpm install
pnpm dev          # → http://localhost:3000
```

Smoke-test the API:

```bash
curl -i -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@signalvault.dev","password":"S3curePass!"}'
```

## Security

Threat model and controls are documented in [`docs/security.md`](docs/security.md):
BCrypt password hashing, JWT + rotating refresh tokens, HttpOnly refresh cookie on web,
strict ownership checks, authenticated WebSocket handshakes, and **client-side AES-GCM
encryption** so a database dump never reveals note/message plaintext.

## Testing & CI

- **Backend**: JUnit + Spring Security tests + Testcontainers (PostgreSQL).
- **Web**: Vitest + Testing Library unit tests, Playwright e2e.
- **CI**: GitHub Actions per app with path filters (see `.github/workflows`).

## Per-app docs

| App | Stack | Docs |
|-----|-------|------|
| Backend | Spring Boot, Spring Security, JPA, STOMP | [`signal-vault-backend/README.md`](signal-vault-backend/README.md) |
| Web | Next.js, TanStack Query, Web Crypto | [`signal-vault-web/README.md`](signal-vault-web/README.md) |
| Android | Kotlin, Compose, Clean Arch | [`signal-vault-android/README.md`](signal-vault-android/README.md) |
| iOS | SwiftUI, Clean Arch | [`signal-vault-ios/README.md`](signal-vault-ios/README.md) |

## Roadmap

- [x] Monorepo scaffold, shared API contract, CI, docs
- [ ] Backend: auth → notes → rooms/realtime
- [ ] Web: auth → vault (Web Crypto) → realtime rooms
- [ ] Android & iOS clients (skeleton → full)
- [ ] WebAuthn/passkey vault unlock on web; certificate pinning on mobile
- [ ] Demo video, screenshots, deploy (VPS / Railway / Fly / Render)

## License

MIT (add a `LICENSE` file before publishing).
