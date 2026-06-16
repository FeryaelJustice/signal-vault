# CLAUDE.md — SignalVault monorepo

Agent context for the whole repo. Each app has its own `CLAUDE.md` with deeper detail;
read the relevant one before working inside an app.

## What this is

A multi-platform, security-focused product: a shared **Spring Boot** backend plus **web**
(Next.js), **Android** (Kotlin/Compose) and **iOS** (SwiftUI) clients. Product spec:
[`signalvault-readme.md`](signalvault-readme.md). Architecture: [`docs/`](docs).

## Golden rules

- **API contract is the source of truth**: [`docs/api.md`](docs/api.md). The backend
  implements it and publishes OpenAPI at `/v3/api-docs`; the web client regenerates its
  typed client from there. Change the contract deliberately and update all consumers.
- **Zero-knowledge**: note `encryptedContent` and message `encryptedBody` are ciphertext
  produced on the client. The backend must never see or log plaintext.
- **Secrets via env only.** Never commit JWT secrets or DB credentials.
- **Stay in your app folder.** Cross-app changes go through the contract, not by editing
  another app's internals.

## Where things live

| Path | What | Build / run |
|------|------|-------------|
| `signal-vault-backend/` | Spring Boot API | `docker compose up -d --build` (host has only JDK 26 → build via Docker/JDK 21) |
| `signal-vault-web/`     | Next.js client  | `pnpm install && pnpm dev` |
| `signal-vault-android/` | Kotlin/Compose  | skeleton (see its README) |
| `signal-vault-ios/`     | SwiftUI         | skeleton (see its README) |
| `docs/`                 | architecture, contract, security, ADRs | — |
| `docker-compose.yml`    | postgres + signalvault-api | — |

## Environment notes

- Windows host. Shells: Bash (POSIX) and PowerShell.
- Only **JDK 26** is installed and there is no system Gradle. Gradle may not run on JDK 26,
  so the backend is built and verified through its **Docker** image (pinned JDK 21), which
  is also the deploy artifact. CI (Linux + JDK 21) is the authoritative build.
- Node 24 + **pnpm** available for web. Docker + Docker Compose available.

## Conventions

- Conventional-commit-style messages; keep changes scoped to one app where possible.
- Mirror existing patterns in each app; match its comment density and naming.
- Tests accompany features (backend: JUnit/Testcontainers; web: Vitest/Playwright).

## Shared-agent policy (this machine)

Follow the user's global policy in `C:\Users\nano9\.agents\AGENTS.md`. For **Android** work
prefer the `android-cli` and the `android-*` skills before ad-hoc commands; shared skills
are authored in `C:\Users\nano9\.agents\skills`. For **web** UI work use the
`frontend-design` skill. Use the Context7 MCP for up-to-date library docs (Spring Boot,
Spring Security, Next.js, TanStack Query, stomp).
