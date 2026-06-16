# SignalVault — Android client

Native Android client for SignalVault: Kotlin + Jetpack Compose, MVVM/MVI + Clean
Architecture, biometric vault, JWT auth, and a resilient realtime room.

> **Status: skeleton + roadmap.** The first delivery pass implements the backend and the
> web client end-to-end; this module documents the target design and how to bootstrap it.
> See [`ROADMAP.md`](ROADMAP.md).

## Stack

- **Kotlin**, **Jetpack Compose**, Material 3
- **Clean Architecture**: `ui` → `domain` → `data`
- DI: Hilt or Koin · Networking: Retrofit/OkHttp (or Ktor) · Realtime: STOMP over OkHttp
  WebSocket
- Security: **Android Keystore**, **BiometricPrompt**, **encrypted DataStore**
- Tests: JUnit, Turbine, Compose UI tests

## Target module layout (from the product spec)

```text
app/
core/security      # Keystore, BiometricPrompt, encrypted DataStore, crypto
core/network       # HTTP client, auth interceptor, token refresh
core/realtime      # STOMP client, connection state machine, reconnection
feature/auth       # login / register
feature/vault      # biometric unlock + encrypted notes
feature/room       # realtime messaging
data               # repositories, DTOs, mappers, local/remote sources
domain             # use cases, models
```

## API

Consumes the shared backend — see [`../docs/api.md`](../docs/api.md). Notes/messages are
encrypted on-device (AES-GCM via a Keystore-backed key gated by BiometricPrompt); only
ciphertext is sent.

## Bootstrapping (when starting implementation)

Prefer the repo's `android-cli` and the `android-*` skills (see the root `CLAUDE.md` and
`C:\Users\nano9\.agents\AGENTS.md`) over ad-hoc Gradle setup:

- `android-module-structure` for the module/convention-plugin layout
- `android-presentation-mvi`, `android-data-layer`, `android-di-koin`, `android-testing`

## Build & run

Once the Gradle project exists:

```bash
./gradlew assembleDebug          # build
./gradlew testDebugUnitTest      # unit tests
```

Point the app at the local API (`http://10.0.2.2:8080` from the emulator) started with
`docker compose up -d` at the repo root.
