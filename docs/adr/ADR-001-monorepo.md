# ADR-001 — Monorepo over polyrepo

- **Status**: Accepted
- **Date**: 2026-06-16

## Context

SignalVault ships a shared backend plus three clients (web, Android, iOS). The code can
live in one repository or several. This is a solo portfolio project intended to be read by
recruiters and reused as a reference.

## Decision

Use a **single monorepo** containing `signal-vault-backend`, `signal-vault-web`,
`signal-vault-android`, `signal-vault-ios`, shared `docs/`, and CI.

## Rationale

- One clone shows the whole product cohesively — strong portfolio storytelling.
- Atomic changes to the API contract and all its consumers in a single PR.
- A shared OpenAPI contract generates the web's typed client (and, later, Kotlin/Swift
  clients) from one source of truth.
- CI stays efficient via **path filters** (each app builds only when its folder changes).

## Consequences

- Heterogeneous toolchains (Gradle, pnpm, Xcode) coexist; mitigated by per-app READMEs,
  CLAUDE.md files, and path-filtered workflows.
- Larger clone; acceptable for the project's scale.
- If any client ever needs independent release cadence, it can be extracted later with
  `git filter-repo`.
