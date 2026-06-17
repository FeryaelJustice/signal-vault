# SignalVault Web

A Next.js frontend for SignalVault — secure encrypted notes and shared private realtime
rooms. Encryption happens entirely in the browser; the backend only ever stores and
transmits ciphertext or per-member encrypted room keys.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| Forms | React Hook Form + Zod |
| Encryption | Web Crypto (SubtleCrypto) — AES-GCM-256, PBKDF2 |
| Realtime | STOMP over SockJS (@stomp/stompjs + sockjs-client) |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright |

## Getting started

```bash
pnpm install
pnpm dev
```

The app starts at http://localhost:3000. The backend must be running at http://localhost:8080 for API calls to succeed.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | Backend base URL |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:8080/ws` | WebSocket (SockJS) endpoint |

Create a `.env.local` file to override:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.myapp.com
NEXT_PUBLIC_WS_URL=https://api.myapp.com/ws
```

## Scripts

```bash
pnpm dev          # Start dev server (localhost:3000)
pnpm build        # Production build + TypeScript check
pnpm start        # Start production server
pnpm lint         # ESLint check on src/
pnpm test         # Vitest unit tests
pnpm e2e          # Playwright e2e tests (requires backend + browsers)
pnpm gen:api      # Regenerate TypeScript types from OpenAPI spec
```

## Regenerating the API client

Once the backend is running:

```bash
pnpm gen:api
# Writes: src/lib/api/schema.d.ts
```

Then update `src/lib/api/contract.ts` and `src/lib/api/client.ts` as needed.

## Running tests

### Unit tests (Vitest)

```bash
pnpm test
```

Covers:
- Crypto roundtrip (encrypt -> decrypt -> original)
- Wrong passphrase throws
- AuthProvider login/logout state transitions
- LoginForm validation and submission

### E2E tests (Playwright)

```bash
# First install browsers (one-time)
pnpm dlx playwright install chromium

# Run (backend must be running)
pnpm e2e
```

## Security model

- **Access token** — stored in JavaScript memory only (never `localStorage` or `sessionStorage`). Clears on page reload.
- **Refresh token** — managed by the backend as an HttpOnly cookie. Not accessible from JavaScript.
- **Vault passphrase** — never sent to the server. Used only to derive an AES-GCM-256 key via PBKDF2 (250,000 iterations).
- **Encrypted content** — all note text and room messages are encrypted before transmission. Shared rooms use a random room key; each member stores that room key encrypted with their vault key. The backend stores ciphertext only.
- **Invites** — owners invite by email and copy an invite link. The room key is placed in the URL fragment (`#roomKey=...`), so it is not sent to the backend; the invitee encrypts it with their vault key when accepting.

## Architecture

```
src/
  app/
    (auth)/           # /login, /register -- unauthenticated routes
    (app)/            # /vault, /rooms/** -- protected, redirects to /login
  components/
    auth/             # LoginForm, RegisterForm
    vault/            # VaultUnlock, NotesList
    rooms/            # RoomView, ConnectionBadge
    layout/           # AppNav
    ui/               # shadcn components
  lib/
    api/
      contract.ts     # TypeScript types from backend contract
      client.ts       # Fetch wrapper (auth header, 401 refresh, redirect)
    auth/
      AuthProvider.tsx # React context: session, login, register, logout
    crypto/
      vault.ts        # AES-GCM-256 + PBKDF2 encryption
    realtime/
      useRoomConnection.ts  # STOMP/SockJS hook with reconnect backoff
    vault/
      vaultStore.ts   # Zustand: vault unlock state (key in memory only)
    utils/
      date.ts         # Human-readable relative dates
  test/               # Vitest unit tests
e2e/                  # Playwright specs
```
