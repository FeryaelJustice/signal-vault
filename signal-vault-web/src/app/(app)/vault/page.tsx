"use client";

import { useVaultStore } from "@/lib/vault/vaultStore";
import { useAuth } from "@/lib/auth/AuthProvider";
import { VaultUnlock } from "@/components/vault/VaultUnlock";
import { NotesList } from "@/components/vault/NotesList";

export default function VaultPage() {
  const { locked } = useVaultStore();
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Page header */}
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your vault</h1>
        {user && (
          <p className="text-sm text-muted-foreground">{user.email}</p>
        )}
      </div>

      {locked ? <VaultUnlock /> : <NotesList />}
    </div>
  );
}
