"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useVaultStore } from "@/lib/vault/vaultStore";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  passphrase: z.string().min(1, "Enter your vault passphrase"),
});

type FormValues = z.infer<typeof schema>;

export function VaultUnlock() {
  const { unlock, unlocking, error } = useVaultStore();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    if (!user) return;
    await unlock(values.passphrase, user.id);
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Icon */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
            <svg
              className="h-7 w-7 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight">
              Unlock your vault
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your vault passphrase to decrypt your notes.
              <br />
              This stays in memory only.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="passphrase" className="sr-only">
              Vault passphrase
            </Label>
            <Input
              id="passphrase"
              type="password"
              autoComplete="off"
              autoFocus
              placeholder="Vault passphrase"
              aria-invalid={!!errors.passphrase || !!error}
              aria-describedby={
                errors.passphrase
                  ? "pp-error"
                  : error
                    ? "unlock-error"
                    : undefined
              }
              className="text-center tracking-widest placeholder:tracking-normal"
              {...register("passphrase")}
            />
            {errors.passphrase && (
              <p
                id="pp-error"
                className="text-xs text-destructive text-center"
                role="alert"
              >
                {errors.passphrase.message}
              </p>
            )}
            {error && !errors.passphrase && (
              <p
                id="unlock-error"
                className="text-xs text-destructive text-center"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={unlocking}>
            {unlocking ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Deriving key…
              </span>
            ) : (
              "Unlock"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          The passphrase is never sent to the server.
        </p>
      </div>
    </div>
  );
}
