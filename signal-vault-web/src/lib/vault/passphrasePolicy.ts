export const VAULT_PASSPHRASE_RULES = [
  "At least 12 characters",
  "One uppercase letter",
  "One lowercase letter",
  "One number",
  "One symbol",
] as const;

export function validateVaultPassphrase(passphrase: string): string[] {
  const failures: string[] = [];

  if (passphrase.length < 12) failures.push(VAULT_PASSPHRASE_RULES[0]);
  if (!/[A-Z]/.test(passphrase)) failures.push(VAULT_PASSPHRASE_RULES[1]);
  if (!/[a-z]/.test(passphrase)) failures.push(VAULT_PASSPHRASE_RULES[2]);
  if (!/[0-9]/.test(passphrase)) failures.push(VAULT_PASSPHRASE_RULES[3]);
  if (!/[^A-Za-z0-9]/.test(passphrase)) failures.push(VAULT_PASSPHRASE_RULES[4]);

  return failures;
}
