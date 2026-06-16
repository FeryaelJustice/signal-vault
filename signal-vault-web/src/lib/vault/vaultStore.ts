// Vault unlock state — kept in memory only, never persisted to storage.
// The passphrase and derived key vanish on page reload / tab close.

import { create } from "zustand";
import { deriveVaultKey, generateSalt } from "@/lib/crypto/vault";

// Each user gets a unique salt stored in localStorage under a user-scoped key.
// The salt is NOT secret — only the passphrase is.
const SALT_STORAGE_KEY = (userId: string) => `sv:vault:salt:${userId}`;

interface VaultState {
  locked: boolean;
  vaultKey: CryptoKey | null;
  saltHex: string | null;
  unlocking: boolean;
  error: string | null;
  unlock: (passphrase: string, userId: string) => Promise<void>;
  lock: () => void;
  getSalt: (userId: string) => string;
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

  async unlock(passphrase: string, userId: string) {
    set({ unlocking: true, error: null });
    try {
      const saltHex = get().getSalt(userId);
      const key = await deriveVaultKey(passphrase, saltHex);
      set({ locked: false, vaultKey: key, saltHex, unlocking: false });
    } catch (err) {
      set({
        unlocking: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  lock() {
    set({ locked: true, vaultKey: null, saltHex: null, error: null });
  },
}));
