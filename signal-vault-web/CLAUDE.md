# CLAUDE.md — SignalVault Web

## Overview

Next.js 16 (App Router) frontend for SignalVault. Dark security-focused UI. Client-side encryption is the defining constraint: **the backend only sees ciphertext — encryption and decryption happen in the browser**.

## Stack

- **Framework**: Next.js 16, React 19, TypeScript 5
- **Styling**: Tailwind CSS v4, shadcn/ui (dark theme by default — see `globals.css`)
- **Server state**: TanStack Query v5 (`useQuery`, `useMutation`)
- **Auth state**: React Context (`AuthProvider`) — access token in memory, refresh via HttpOnly cookie
- **Vault state**: Zustand (`useVaultStore`) — derived `CryptoKey` in memory only
- **Encryption**: Web Crypto API — AES-GCM-256 + PBKDF2 in `src/lib/crypto/vault.ts`
- **Realtime**: STOMP over SockJS — `src/lib/realtime/useRoomConnection.ts`
- **Forms**: React Hook Form + Zod
- **Tests**: Vitest (unit), Playwright (e2e)

## Directory structure

```
src/
  app/
    (auth)/login/       # /login page
    (auth)/register/    # /register page
    (app)/vault/        # /vault page — unlock + notes CRUD
    (app)/rooms/        # /rooms list page
    (app)/rooms/[id]/   # room page with realtime chat
  components/
    auth/               # LoginForm, RegisterForm
    vault/              # VaultUnlock, NotesList
    rooms/              # RoomView, ConnectionBadge
    layout/             # AppNav (sticky header, nav links, vault status)
    providers.tsx       # QueryClientProvider + AuthProvider + Toaster
    ui/                 # shadcn: button, input, card, dialog, label, badge, sonner
  lib/
    api/
      contract.ts       # Backend TS types (keep in sync with OpenAPI)
      client.ts         # apiFetch() wrapper: Bearer header, 401 auto-refresh
    auth/
      AuthProvider.tsx  # Context: status, user, login, register, logout
    crypto/
      vault.ts          # encryptString, decryptString, encryptWithKey, decryptWithKey
    realtime/
      useRoomConnection.ts  # STOMP/SockJS hook, reconnect backoff
    vault/
      vaultStore.ts     # Zustand: locked, vaultKey, saltHex, unlock(), lock()
    utils/
      date.ts           # formatDistanceToNow()
  test/                 # Vitest unit tests
e2e/                    # Playwright e2e specs
```

## Key conventions

### Authentication
- `AuthProvider` attempts `POST /api/auth/refresh` on mount to rehidrate session.
- Access token is stored only in module-level variable `_accessToken` in `client.ts`.
- On 401: auto-refresh once; if refresh fails, calls `_onSessionExpired` (set by `AuthProvider`).
- ALL fetch calls use `credentials: 'include'` for the HttpOnly refresh cookie.

### Vault encryption
- Passphrase is never sent to the server.
- Salt is stored in `localStorage` under `sv:vault:salt:<userId>` — it is NOT secret.
- Derived `CryptoKey` lives in Zustand (`useVaultStore`) — cleared on `lock()` or page reload.
- Envelope format: `{ v: 1, salt: "<hex>", iv: "<hex>", ciphertext: "<base64>" }`
- Use `encryptWithKey` / `decryptWithKey` when the key is already derived (avoids re-running PBKDF2).

### Realtime
- `useRoomConnection` manages STOMP over SockJS with exponential backoff.
- Status: `connecting | connected | reconnecting | disconnected` — shown in `ConnectionBadge`.
- Messages are encrypted before sending and decrypted on receipt using the vault key.
- Auth header is sent in STOMP CONNECT frame: `Authorization: Bearer <token>`.

### Routing
- `(auth)` group: public, no layout guard.
- `(app)` group layout: checks `AuthStatus` from `AuthProvider`; redirects to `/login` if unauthenticated.
- Root `/` redirects to `/vault`.

## API contract summary

Base: `http://localhost:8080` (configurable via `NEXT_PUBLIC_API_BASE_URL`)

```
POST /api/auth/register  {email, password}         -> 201 AuthResponse
POST /api/auth/login     {email, password}         -> 200 AuthResponse
POST /api/auth/refresh   (cookie)                  -> 200 {accessToken, expiresIn}
POST /api/auth/logout                              -> 204
GET  /api/me                                       -> 200 User
GET  /api/notes                                    -> 200 Note[]
POST /api/notes          {title, encryptedContent} -> 201 Note
PUT  /api/notes/:id      {title, encryptedContent} -> 200 Note
DEL  /api/notes/:id                                -> 204
GET  /api/rooms                                    -> 200 Room[]
POST /api/rooms          {name}                    -> 201 Room
GET  /api/rooms/:id/messages                       -> 200 Message[]
WS   /ws (SockJS/STOMP)
  Subscribe: /topic/rooms/:roomId
  Publish:   /app/rooms/:roomId {encryptedBody}
  Event:     {type:"MESSAGE_CREATED", roomId, messageId, senderId, encryptedBody, createdAt}
```

## Commands

```bash
pnpm dev           # Dev server
pnpm build         # Production build (must pass before committing)
pnpm test          # Vitest unit tests
pnpm lint          # ESLint
pnpm e2e           # Playwright (needs backend + pnpm dlx playwright install chromium)
pnpm gen:api       # openapi-typescript -> src/lib/api/schema.d.ts
```

## Design system

Dark theme defined in `src/app/globals.css` using OKLCH color space:
- Background: `oklch(0.10 0.008 264)` (near-black with blue undertone)
- Primary: `oklch(0.65 0.18 264)` (indigo — "secure" accent)
- Success green, warning yellow, destructive red for status states
- Geist Sans + Geist Mono fonts

## Notes

- The `react-hooks/set-state-in-effect` ESLint rule from the React Compiler config is strict. Use inline `// eslint-disable-next-line` when setState is legitimately needed inside an effect (e.g., async decryption callbacks, resetting form state).
- Do not move the vault key or access token to localStorage — this is intentional for security.
- PBKDF2 uses 250,000 iterations minimum. Do not reduce this.
