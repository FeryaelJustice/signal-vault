import { describe, it, expect } from "vitest";
import { encryptString, decryptString } from "@/lib/crypto/vault";

describe("vault crypto", () => {
  it("roundtrip: encrypt then decrypt returns the original plaintext", async () => {
    const passphrase = "test-passphrase-123!";
    const plaintext = "This is a secret note";

    const envelope = await encryptString(plaintext, passphrase);
    const decrypted = await decryptString(envelope, passphrase);

    expect(decrypted).toBe(plaintext);
  });

  it("roundtrip with unicode content", async () => {
    const passphrase = "unicode-pass-🔐";
    const plaintext = "Señal cifrada: 秘密 🛡️ \n多行内容";

    const envelope = await encryptString(plaintext, passphrase);
    const decrypted = await decryptString(envelope, passphrase);

    expect(decrypted).toBe(plaintext);
  });

  it("wrong passphrase throws an error", async () => {
    const plaintext = "sensitive data";
    const envelope = await encryptString(plaintext, "correct-passphrase");

    await expect(decryptString(envelope, "wrong-passphrase")).rejects.toThrow(
      /Decryption failed/
    );
  });

  it("tampered ciphertext throws an error", async () => {
    const envelope = await encryptString("hello", "my-passphrase");
    const parsed = JSON.parse(envelope);
    // Corrupt the ciphertext
    parsed.ciphertext = parsed.ciphertext.replace(/[A-Z]/g, "x");
    const tampered = JSON.stringify(parsed);

    await expect(decryptString(tampered, "my-passphrase")).rejects.toThrow();
  });

  it("invalid JSON envelope throws an error", async () => {
    await expect(decryptString("not-json", "passphrase")).rejects.toThrow(
      /Invalid vault envelope/
    );
  });

  it("each encryption of the same plaintext produces a different ciphertext", async () => {
    const passphrase = "same-passphrase";
    const plaintext = "determinism test";

    const e1 = await encryptString(plaintext, passphrase);
    const e2 = await encryptString(plaintext, passphrase);

    // Different random salt + IV each time
    expect(e1).not.toBe(e2);

    // But both decrypt correctly
    expect(await decryptString(e1, passphrase)).toBe(plaintext);
    expect(await decryptString(e2, passphrase)).toBe(plaintext);
  });
});
