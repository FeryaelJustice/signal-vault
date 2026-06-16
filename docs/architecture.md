# SignalVault — Architecture

SignalVault is a multi-platform, security-focused product: one shared backend and three
native/web clients that all implement the same flows (auth, biometric/passphrase vault,
client-side-encrypted notes, realtime rooms).

## System overview

```mermaid
flowchart TB
    subgraph Clients
        W[signal-vault-web<br/>Next.js + React]
        A[signal-vault-android<br/>Kotlin + Compose]
        I[signal-vault-ios<br/>SwiftUI]
    end

    subgraph Backend[signal-vault-backend · Spring Boot]
        API[REST API<br/>/api/**]
        WS[STOMP WebSocket<br/>/ws]
        SEC[Spring Security<br/>JWT filter]
    end

    DB[(PostgreSQL)]

    W -- HTTPS + Bearer JWT --> API
    A -- HTTPS + Bearer JWT --> API
    I -- HTTPS + Bearer JWT --> API
    W -- STOMP/SockJS --> WS
    A -- STOMP --> WS
    I -- STOMP --> WS
    API --> SEC
    WS --> SEC
    API --> DB
    WS --> DB
```

## Auth & token flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Backend
    C->>API: POST /api/auth/login {email,password}
    API-->>C: 200 {accessToken} + Set-Cookie refreshToken (HttpOnly)
    C->>API: GET /api/me (Authorization: Bearer access)
    API-->>C: 200 {id,email}
    Note over C,API: access token expires (~15 min)
    C->>API: GET /api/notes -> 401
    C->>API: POST /api/auth/refresh (cookie)
    API-->>C: 200 {accessToken} + rotated cookie
    C->>API: retry GET /api/notes -> 200
```

- **Web**: access token in memory (React context), refresh token in an HttpOnly cookie.
- **Android**: tokens in Android Keystore-backed encrypted DataStore.
- **iOS**: tokens in Keychain.

## Client-side encryption (zero-knowledge notes)

The vault key never leaves the client. Plaintext is encrypted locally (AES-GCM) and only
ciphertext is sent to the backend.

- **Web**: Web Crypto (`SubtleCrypto`) AES-GCM; key derived from a passphrase via PBKDF2.
  Passkeys/WebAuthn (PRF extension) is the roadmap upgrade to wrap the key.
- **Android**: Android Keystore + BiometricPrompt gate; AES-GCM via Keystore key.
- **iOS**: Keychain + LocalAuthentication (Face/Touch ID); CryptoKit AES-GCM.

## Module map

| Component               | Stack                                   | Status (this pass)        |
|-------------------------|-----------------------------------------|---------------------------|
| `signal-vault-backend`  | Spring Boot, Spring Security, JPA, STOMP | Auth → notes → rooms      |
| `signal-vault-web`      | Next.js (App Router), TanStack Query     | Auth → vault → realtime   |
| `signal-vault-android`  | Kotlin, Compose, Clean Arch              | Skeleton + roadmap        |
| `signal-vault-ios`      | SwiftUI, Clean Arch                      | Skeleton + roadmap        |

See [`api.md`](./api.md) for the contract and [`security.md`](./security.md) for the
security model. Architecture decisions live under [`adr/`](./adr).
