# CLAUDE.md — signal-vault-android

Android client for SignalVault. **Status: skeleton + roadmap** (see `ROADMAP.md`).

## Before you start

This machine has an Android-first policy. **Use `android-cli` and the `android-*` skills**
(`android-module-structure`, `android-presentation-mvi`, `android-data-layer`,
`android-di-koin`, `android-testing`, `android-compose-ui`) rather than improvising Gradle
or module setup. Shared skills live in `C:\Users\nano9\.agents\skills`; policy in
`C:\Users\nano9\.agents\AGENTS.md`.

## Design

- Kotlin, Jetpack Compose, Material 3; Clean Architecture (`ui`/`domain`/`data`) with
  per-feature modules: `feature/auth`, `feature/vault`, `feature/room`, plus
  `core/security`, `core/network`, `core/realtime`.
- Security: Android Keystore + BiometricPrompt gate + encrypted DataStore for tokens; notes
  encrypted on-device with a Keystore-backed AES-GCM key.
- Realtime: STOMP over OkHttp WebSocket with a connection state machine
  (`connecting/connected/reconnecting/disconnected`) and backoff reconnection.

## Contract

The API contract is shared and authoritative: [`../docs/api.md`](../docs/api.md). Tokens go
in encrypted DataStore; emulator reaches the local API at `http://10.0.2.2:8080`.

## Conventions

- MVI presentation (State/Action/Event), unidirectional data flow.
- Tests with JUnit + Turbine for ViewModels; Compose UI tests for screens.
- Keep `domain` pure (no Android imports); map DTOs in `data`.
