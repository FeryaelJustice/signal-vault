// Client-side AES-GCM-256 encryption using the Web Crypto API (SubtleCrypto).
// The backend ONLY sees ciphertext — plaintext never leaves the browser.
//
// Envelope format (JSON string):
//   { v: 1, salt: <hex>, iv: <hex>, ciphertext: <base64> }

const PBKDF2_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface VaultEnvelope {
  v: 1;
  salt: string; // hex
  iv: string; // hex
  ciphertext: string; // base64
}

// ── Key derivation ────────────────────────────────────────────────────────────

/**
 * Derives an AES-GCM-256 CryptoKey from a passphrase and salt using PBKDF2.
 * The key is marked non-extractable for security.
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Ensures a Uint8Array has a plain ArrayBuffer backing (not SharedArrayBuffer) */
function ensureArrayBuffer(u8: Uint8Array): Uint8Array<ArrayBuffer> {
  if (u8.buffer instanceof ArrayBuffer) {
    return u8 as Uint8Array<ArrayBuffer>;
  }
  const copy = new Uint8Array(u8.length);
  copy.set(u8);
  return copy as Uint8Array<ArrayBuffer>;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(buf);
  return buf;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const str = atob(b64);
  const buf = new Uint8Array(new ArrayBuffer(str.length));
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string with the given passphrase.
 * Returns a serialised VaultEnvelope string (what gets stored as `encryptedContent`).
 */
export async function encryptString(
  plaintext: string,
  passphrase: string
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const encoded = ensureArrayBuffer(enc.encode(plaintext));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const envelope: VaultEnvelope = {
    v: 1,
    salt: toHex(salt),
    iv: toHex(iv),
    ciphertext: toBase64(cipherBuf),
  };

  return JSON.stringify(envelope);
}

/**
 * Decrypts an envelope string back to plaintext.
 * Throws if the passphrase is wrong or the data is corrupted.
 */
export async function decryptString(
  envelopeStr: string,
  passphrase: string
): Promise<string> {
  let envelope: VaultEnvelope;
  try {
    envelope = JSON.parse(envelopeStr) as VaultEnvelope;
  } catch {
    throw new Error("Invalid vault envelope: not valid JSON");
  }

  if (envelope.v !== 1) {
    throw new Error(`Unsupported vault envelope version: ${envelope.v}`);
  }

  const salt = fromHex(envelope.salt);
  const iv = fromHex(envelope.iv);
  const cipherBuf = fromBase64(envelope.ciphertext);

  const key = await deriveKey(passphrase, salt);

  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBuf
    );
  } catch {
    throw new Error("Decryption failed: wrong passphrase or corrupted data");
  }

  return new TextDecoder().decode(plainBuf);
}

/**
 * Derives and caches a CryptoKey from a passphrase for use across multiple
 * encrypt/decrypt calls. Returns the key directly for use in useVaultStore.
 */
export async function deriveVaultKey(
  passphrase: string,
  saltHex: string
): Promise<CryptoKey> {
  return deriveKey(passphrase, fromHex(saltHex));
}

/**
 * Encrypts plaintext with a pre-derived CryptoKey (avoids re-running PBKDF2).
 */
export async function encryptWithKey(
  plaintext: string,
  key: CryptoKey,
  saltHex: string
): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const enc = new TextEncoder();
  const encoded = ensureArrayBuffer(enc.encode(plaintext));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  const envelope: VaultEnvelope = {
    v: 1,
    salt: saltHex,
    iv: toHex(iv),
    ciphertext: toBase64(cipherBuf),
  };

  return JSON.stringify(envelope);
}

/**
 * Decrypts with a pre-derived CryptoKey.
 */
export async function decryptWithKey(
  envelopeStr: string,
  key: CryptoKey
): Promise<string> {
  let envelope: VaultEnvelope;
  try {
    envelope = JSON.parse(envelopeStr) as VaultEnvelope;
  } catch {
    throw new Error("Invalid vault envelope");
  }

  const iv = fromHex(envelope.iv);
  const cipherBuf = fromBase64(envelope.ciphertext);

  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBuf
    );
  } catch {
    throw new Error("Decryption failed: wrong key or corrupted data");
  }

  return new TextDecoder().decode(plainBuf);
}

/** Returns a random hex salt for initial vault setup */
export function generateSalt(): string {
  return toHex(randomBytes(SALT_BYTES));
}
