# SignalVault — iOS client

Native iOS client for SignalVault: Swift + SwiftUI, MVVM + Clean Architecture, Face/Touch ID
vault, JWT auth, and a resilient realtime room.

> **Status: skeleton + roadmap.** The first delivery pass implements the backend and the
> web client end-to-end; this module documents the target design. See [`ROADMAP.md`](ROADMAP.md).

## Stack

- **Swift**, **SwiftUI**, Swift Concurrency (`async/await`)
- **Clean Architecture**: `Presentation` → `Domain` → `Data`
- Networking: `URLSession` · Realtime: `URLSessionWebSocketTask` (STOMP frames) or a STOMP lib
- Security: **Keychain**, **LocalAuthentication** (Face ID / Touch ID), **CryptoKit** (AES-GCM)
- Tests: XCTest, ViewInspector / snapshot tests

## Target layout

```text
SignalVault/
  App/                 # entry point, DI composition root
  Core/Security/       # Keychain, LocalAuthentication, CryptoKit helpers
  Core/Network/        # URLSession client, auth, token refresh
  Core/Realtime/       # WebSocket/STOMP client, connection state machine
  Features/Auth/       # login / register
  Features/Vault/      # biometric unlock + encrypted notes
  Features/Room/       # realtime messaging
  Data/                # repositories, DTOs, mappers
  Domain/              # use cases, models
```

## API

Consumes the shared backend — see [`../docs/api.md`](../docs/api.md). Notes/messages are
encrypted on-device (CryptoKit AES-GCM with a Keychain-stored key gated by Face/Touch ID);
only ciphertext is sent. The access token lives in memory; the refresh token in the Keychain.

## Build & run

Once the Xcode project / SwiftPM package exists:

```bash
xcodebuild -scheme SignalVault -destination 'platform=iOS Simulator,name=iPhone 15' build test
```

Point the app at the local API (`http://localhost:8080`) started with `docker compose up -d`
at the repo root (use an ATS exception for cleartext localhost in DEBUG).
