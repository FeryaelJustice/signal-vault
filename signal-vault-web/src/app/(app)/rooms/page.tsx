"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import {
  apiGetPendingInvites,
  apiGetRooms,
  apiCreateRoom,
  apiCreatePasswordProposal,
} from "@/lib/api/client";
import type { Room } from "@/lib/api/contract";
import { formatDistanceToNow } from "@/lib/utils/date";
import { useVaultStore } from "@/lib/vault/vaultStore";
import {
  encryptWithKey,
  generateRoomKeyMaterial,
  createRoomPasswordVerifier,
} from "@/lib/crypto/vault";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function RoomsPage() {
  const qc = useQueryClient();
  const { locked, vaultKey, saltHex } = useVaultStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHighSecurity, setNewHighSecurity] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [confirmRoomPassword, setConfirmRoomPassword] = useState("");

  const { data: rooms, isLoading, error } = useQuery({
    queryKey: ["rooms"],
    queryFn: apiGetRooms,
  });

  const { data: pendingInvites } = useQuery({
    queryKey: ["room-invites", "pending"],
    queryFn: apiGetPendingInvites,
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, highSecurity, password }: {
      name: string;
      highSecurity: boolean;
      password?: string;
    }) => {
      if (!vaultKey || !saltHex) throw new Error("Unlock your vault before creating a room");
      const roomKeyMaterial = generateRoomKeyMaterial();
      const encryptedRoomKey = await encryptWithKey(roomKeyMaterial, vaultKey, saltHex);
      const room = await apiCreateRoom({ name, encryptedRoomKey, highSecurity });

      // If high security with a password, immediately submit a proposal (auto-resolves since sole member).
      if (highSecurity && password) {
        const passwordVerifier = await createRoomPasswordVerifier(password);
        await apiCreatePasswordProposal(room.id, {
          proposedPassword: password,
          passwordVerifier,
        });
      }

      return room;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room created");
      setCreating(false);
      setNewName("");
      setNewHighSecurity(false);
      setRoomPassword("");
      setConfirmRoomPassword("");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to create room"),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    if (locked) {
      toast.error("Unlock your vault before creating a room");
      return;
    }
    if (newHighSecurity) {
      if (roomPassword.length < 8) {
        toast.error("Room password must be at least 8 characters");
        return;
      }
      if (roomPassword !== confirmRoomPassword) {
        toast.error("Room passwords do not match");
        return;
      }
    }
    createMutation.mutate({
      name: newName.trim(),
      highSecurity: newHighSecurity,
      password: newHighSecurity ? roomPassword : undefined,
    });
  }

  function handleDialogClose() {
    setCreating(false);
    setNewName("");
    setNewHighSecurity(false);
    setRoomPassword("");
    setConfirmRoomPassword("");
  }

  const passwordMismatch =
    newHighSecurity && roomPassword && confirmRoomPassword && roomPassword !== confirmRoomPassword;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Encrypted realtime messaging channels
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreating(true)}
          disabled={locked}
          title={locked ? "Unlock your vault first" : undefined}
        >
          <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
          New room
        </Button>
      </div>

      {locked && (
        <div className="mb-4 rounded-lg border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
          Unlock your vault before creating rooms, accepting invites, or reading messages.
        </div>
      )}

      {pendingInvites && pendingInvites.length > 0 && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
          <h2 className="text-sm font-medium">Pending invites</h2>
          <ul className="mt-3 space-y-2">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p>{invite.roomName}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {invite.inviterEmail}
                  </p>
                </div>
                <span className="text-right text-xs text-muted-foreground">
                  Use the invite link
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
          ))}
          <p className="sr-only">Loading rooms…</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load rooms: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {!isLoading && rooms?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <HashIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No rooms yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Create a private encrypted room
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            Create room
          </Button>
        </div>
      )}

      {rooms && rooms.length > 0 && (
        <ul className="space-y-2" role="list">
          {rooms.map((room: Room) => (
            <li key={room.id}>
              <Link
                href={`/rooms/${room.id}`}
                className="group flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-4 py-3.5 transition-colors hover:border-border hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HashIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{room.name}</p>
                      {room.highSecurity && (
                        <ShieldIcon className="h-3.5 w-3.5 text-primary" title="High security" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {room.memberCount} member{room.memberCount === 1 ? "" : "s"} ·{" "}
                      {room.onlineCount} online · Created {formatDistanceToNow(room.createdAt)}
                    </p>
                  </div>
                </div>
                <ChevronIcon className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Create room dialog */}
      <Dialog open={creating} onOpenChange={(v) => !v && handleDialogClose()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create room</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Room name"
              autoFocus
              maxLength={64}
            />

            {/* High security toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-medium">Maximum security</p>
                  <p className="text-[10px] text-muted-foreground">
                    Requires a shared room password
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={newHighSecurity}
                onClick={() => {
                  setNewHighSecurity(!newHighSecurity);
                  setRoomPassword("");
                  setConfirmRoomPassword("");
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  newHighSecurity ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    newHighSecurity ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {newHighSecurity && (
              <>
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <strong>Remember this password.</strong> All members must enter it to access the room.
                  Changing it requires unanimous agreement from all members.
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    placeholder="Room password (min. 8 chars)"
                    autoComplete="new-password"
                  />
                  <Input
                    type="password"
                    value={confirmRoomPassword}
                    onChange={(e) => setConfirmRoomPassword(e.target.value)}
                    placeholder="Confirm room password"
                    autoComplete="new-password"
                  />
                  {passwordMismatch && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={handleDialogClose}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  !newName.trim() ||
                  (newHighSecurity && (roomPassword.length < 8 || roomPassword !== confirmRoomPassword))
                }
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ShieldIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {title && <title>{title}</title>}
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
