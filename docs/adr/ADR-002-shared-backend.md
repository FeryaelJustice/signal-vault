# ADR-002 — Single shared backend at the repo root

- **Status**: Accepted
- **Date**: 2026-06-16

## Context

The initial request was to place a backend *inside* `signal-vault-web`. But the repo also
contains `signal-vault-android` and `signal-vault-ios`, which need the same API.

## Decision

Host **one** backend at `signal-vault-backend/` (sibling of the clients), consumed by all
three clients. `signal-vault-web` therefore contains only the Next.js frontend.

## Rationale

- A single product, a single source of identity, notes, rooms, and realtime — duplicating a
  backend per client would fork the data model and double the work.
- Keeps the API contract authoritative and reusable across platforms.

## Consequences

- `signal-vault-web` is the Next.js project root (no nested `backend/`/`frontend/`).
- Deployment is one API service (`docker-compose.yml` → `signalvault-api` + `postgres`).
