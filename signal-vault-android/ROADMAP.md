# Android client — roadmap

Mirrors the product milestones, scoped to Android. The shared backend already defines the
contract ([`../docs/api.md`](../docs/api.md)).

## M1 — Auth vertical slice
- [ ] Bootstrap project with `android-cli` + `android-module-structure` (convention plugins,
      version catalog)
- [ ] `feature/auth`: login/register (MVI), form validation
- [ ] `core/network`: Retrofit/Ktor client, auth interceptor, refresh-on-401
- [ ] `core/security`: encrypted DataStore token storage
- [ ] Authenticated screen reading `GET /api/me`

## M2 — Secure vault
- [ ] BiometricPrompt unlock gate
- [ ] Keystore-backed AES-GCM key; encrypt/decrypt note content on-device
- [ ] Notes list + editor backed by `GET/POST/PUT/DELETE /api/notes`

## M3 — Realtime room
- [ ] `core/realtime`: STOMP over OkHttp WebSocket, authenticated CONNECT
- [ ] Connection-state UI + reconnection with backoff
- [ ] Room screen: send/receive encrypted messages

## M4 — Tests & CI
- [ ] ViewModel unit tests (JUnit + Turbine), use-case tests
- [ ] Compose UI tests for auth + vault
- [ ] Activate `.github/workflows/android.yml` (already path-filtered)

## M5 — Polish
- [ ] Screenshots, architecture notes, release-signing docs, Crashlytics
