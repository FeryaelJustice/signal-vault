# ADR-003 — Web vault: Web Crypto now, WebAuthn/passkeys next

- **Status**: Accepted
- **Date**: 2026-06-16

## Context

The product's signature feature is a biometric-unlocked vault. The web has no
`BiometricPrompt`/Keychain equivalent, so the "unlock + encrypt locally" concept must be
translated to browser primitives.

## Decision

For the MVP, derive the vault's AES-GCM key from a **passphrase** using **PBKDF2** (Web
Crypto `SubtleCrypto`), keeping the key in memory for the unlocked session only. Encrypt
note/message content client-side; send only ciphertext.

Roadmap: wrap the vault key with a **passkey** via **WebAuthn PRF extension**
(`@simplewebauthn`), giving a true biometric-backed unlock on supported devices.

## Rationale

- PBKDF2 + AES-GCM is universally supported, dependency-free, and demonstrates the
  zero-knowledge model immediately.
- WebAuthn PRF is the correct long-term analog to native biometrics but has narrower
  browser support, so it is a progressive enhancement, not a blocker.

## Consequences

- A "lock screen" gates decrypted content; losing the passphrase means losing access
  (by design — the server cannot recover it).
- The envelope format `{v, salt, iv, ciphertext}` is versioned (`v`) to allow migrating to
  passkey-wrapped keys without breaking existing notes.
