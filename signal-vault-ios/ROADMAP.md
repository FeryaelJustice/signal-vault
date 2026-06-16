# iOS client — roadmap

Mirrors the product milestones, scoped to iOS. The shared backend already defines the
contract ([`../docs/api.md`](../docs/api.md)).

## M1 — Auth vertical slice
- [ ] Xcode project / SwiftPM package, DI composition root
- [ ] `Features/Auth`: login/register (MVVM), validation
- [ ] `Core/Network`: URLSession client, auth header, refresh-on-401
- [ ] `Core/Security`: Keychain token storage
- [ ] Authenticated screen reading `GET /api/me`

## M2 — Secure vault
- [ ] LocalAuthentication (Face/Touch ID) unlock gate
- [ ] CryptoKit AES-GCM with Keychain-stored key; encrypt/decrypt notes on-device
- [ ] Notes list + editor backed by `/api/notes`

## M3 — Realtime room
- [ ] `Core/Realtime`: WebSocket/STOMP client, authenticated CONNECT
- [ ] Connection-state UI + reconnection with backoff
- [ ] Room screen: send/receive encrypted messages

## M4 — Tests & CI
- [ ] XCTest unit tests for view models + use cases
- [ ] UI tests for auth + vault
- [ ] Activate `.github/workflows/ios.yml` (already path-filtered)

## M5 — Polish
- [ ] Screenshots, architecture notes, TestFlight/distribution docs, crash reporting
