import { beforeEach, describe, expect, it } from "vitest";
import { useVaultStore } from "@/lib/vault/vaultStore";

describe("vault store", () => {
  beforeEach(() => {
    localStorage.clear();
    useVaultStore.setState({
      locked: true,
      vaultKey: null,
      saltHex: null,
      unlocking: false,
      error: null,
    });
  });

  it("creates a verifier on first unlock and accepts the same passphrase later", async () => {
    await useVaultStore.getState().unlock("Correct-passphrase-1!", "user-1");

    expect(useVaultStore.getState().locked).toBe(false);
    expect(localStorage.getItem("sv:vault:verifier:user-1")).toBeTruthy();

    useVaultStore.getState().lock();
    await useVaultStore.getState().unlock("Correct-passphrase-1!", "user-1");

    expect(useVaultStore.getState().locked).toBe(false);
    expect(useVaultStore.getState().error).toBeNull();
  });

  it("rejects a wrong passphrase after the verifier exists", async () => {
    await useVaultStore.getState().unlock("Correct-passphrase-1!", "user-1");
    useVaultStore.getState().lock();

    await useVaultStore.getState().unlock("wrong-passphrase", "user-1");

    expect(useVaultStore.getState().locked).toBe(true);
    expect(useVaultStore.getState().vaultKey).toBeNull();
    expect(useVaultStore.getState().error).toBe("Invalid vault passphrase");
  });

  it("rejects weak passphrases when the verifier does not exist yet", async () => {
    await useVaultStore.getState().unlock("a", "user-1");

    expect(useVaultStore.getState().locked).toBe(true);
    expect(localStorage.getItem("sv:vault:verifier:user-1")).toBeNull();
    expect(useVaultStore.getState().error).toContain(
      "Vault passphrase is too weak"
    );
  });
});
