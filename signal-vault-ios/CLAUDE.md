# CLAUDE.md — signal-vault-ios

iOS client for SignalVault. **Status: skeleton + roadmap** (see `ROADMAP.md`).

## Design

- Swift + SwiftUI, Swift Concurrency; Clean Architecture (`Presentation`/`Domain`/`Data`)
  with per-feature folders: `Features/Auth`, `Features/Vault`, `Features/Room`, plus
  `Core/Security`, `Core/Network`, `Core/Realtime`.
- Security: Keychain for tokens, LocalAuthentication (Face/Touch ID) unlock gate, CryptoKit
  AES-GCM for on-device note/message encryption.
- Realtime: `URLSessionWebSocketTask` with a connection state machine
  (`connecting/connected/reconnecting/disconnected`) and backoff reconnection.

## Contract

The API contract is shared and authoritative: [`../docs/api.md`](../docs/api.md). Access
token in memory; refresh token in Keychain. Simulator reaches the local API at
`http://localhost:8080` (add a DEBUG-only ATS exception for cleartext localhost).

## Conventions

- MVVM with `@Observable`/`ObservableObject` view models; unidirectional state.
- Keep `Domain` free of UIKit/SwiftUI; map DTOs in `Data`.
- Tests with XCTest; prefer dependency injection for fakes.
