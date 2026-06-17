// Vault unlock state — kept in memory only, never persisted to storage.
// The passphrase and derived key vanish on page reload / tab close.

import { create } from "zustand";
import {
  decryptWithKey,
  deriveVaultKey,
  encryptWithKey,
  generateSalt,
} from "@/lib/crypto/vault";
import { validateVaultPassphrase } from "@/lib/vault/passphrasePolicy";

// Each user gets a unique salt stored in localStorage under a user-scoped key.
// The salt is NOT secret — only the passphrase is.
const SALT_STORAGE_KEY = (userId: string) => `sv:vault:salt:${userId}`;
const VERIFIER_STORAGE_KEY = (userId: string) => `sv:vault:verifier:${userId}`;
const VERIFIER_PLAINTEXT = "signalvault:vault-verifier:v1";

interface VaultState {
  locked: boolean;
  vaultKey: CryptoKey | null;
  saltHex: string | null;
  unlocking: boolean;
  error: string | null;
  unlock: (passphrase: string, userId: string) => Promise<void>;
  lock: () => void;
  getSalt: (userId: string) => string;
  hasVerifier: (userId: string) => boolean;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  locked: true,
  vaultKey: null,
  saltHex: null,
  unlocking: false,
  error: null,

  getSalt(userId: string): string {
    const existing = localStorage.getItem(SALT_STORAGE_KEY(userId));
    if (existing) return existing;
    const fresh = generateSalt();
    localStorage.setItem(SALT_STORAGE_KEY(userId), fresh);
    return fresh;
  },

  hasVerifier(userId: string): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(VERIFIER_STORAGE_KEY(userId)) !== null;
  },

  async unlock(passphrase: string, userId: string) {
    set({ unlocking: true, error: null });
    try {
      const saltHex = get().getSalt(userId);
      const verifierKey = VERIFIER_STORAGE_KEY(userId);
      const verifier = localStorage.getItem(verifierKey);

      if (!verifier) {
        const failures = validateVaultPassphrase(passphrase);
        if (failures.length > 0) {
          throw new Error(
            `Vault passphrase is too weak: ${failures.join(", ")}`
          );
        }
      }

      const key = await deriveVaultKey(passphrase, saltHex);

      if (verifier) {
        const plaintext = await decryptWithKey(verifier, key);
        if (plaintext !== VERIFIER_PLAINTEXT) {
          throw new Error("Invalid vault passphrase");
        }
      } else {
        const newVerifier = await encryptWithKey(
          VERIFIER_PLAINTEXT,
          key,
          saltHex
        );
        localStorage.setItem(verifierKey, newVerifier);
      }

      set({ locked: false, vaultKey: key, saltHex, unlocking: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      set({
        unlocking: false,
        error: message.startsWith("Vault passphrase")
          ? message
          : "Invalid vault passphrase",
      });
    }
  },

  lock() {
    set({ locked: true, vaultKey: null, saltHex: null, error: null });
  },
}));
