"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiAcceptInvite, apiGetRooms, apiRejectInvite } from "@/lib/api/client";
import { RoomView } from "@/components/rooms/RoomView";
import { useVaultStore } from "@/lib/vault/vaultStore";
import { VaultUnlock } from "@/components/vault/VaultUnlock";
import { encryptWithKey } from "@/lib/crypto/vault";
import { Button } from "@/components/ui/button";

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { locked, vaultKey, saltHex } = useVaultStore();
  const inviteId = searchParams.get("invite");

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: apiGetRooms,
  });

  const room = rooms?.find((r) => r.id === id);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!inviteId) throw new Error("Invite missing");
      if (!vaultKey || !saltHex) throw new Error("Unlock your vault first");
      const roomKeyMaterial = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      ).get("roomKey");
      if (!roomKeyMaterial) {
        throw new Error("This invite link is missing its room key");
      }
      const encryptedRoomKey = await encryptWithKey(
        roomKeyMaterial,
        vaultKey,
        saltHex
      );
      return apiAcceptInvite(inviteId, encryptedRoomKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["room-invites", "pending"] });
      toast.success("Invite accepted");
      router.replace(`/rooms/${id}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to accept invite");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!inviteId) throw new Error("Invite missing");
      return apiRejectInvite(inviteId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room-invites", "pending"] });
      toast.info("Invite declined");
      router.replace("/rooms");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to decline invite");
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!room) {
    if (inviteId) {
      return (
        <div className="mx-auto max-w-xl px-4 py-24">
          <Link href="/rooms" className="text-sm text-muted-foreground hover:text-foreground">
            ← Rooms
          </Link>
          <div className="mt-8 rounded-lg border border-border/60 bg-card/60 p-5">
            <h1 className="text-lg font-semibold">Accept room invite</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Unlock your vault, then accept this invite to store your encrypted copy of the room key.
            </p>
            {locked ? (
              <div className="mt-6">
                <VaultUnlock />
              </div>
            ) : (
              <div className="mt-5 flex gap-3">
                <Button
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                >
                  {acceptMutation.isPending ? "Accepting…" : "Accept invite"}
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => rejectMutation.mutate()}
                  disabled={acceptMutation.isPending || rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? "Declining…" : "Decline"}
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-muted-foreground">Room not found.</p>
        <Link href="/rooms" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Back to rooms
        </Link>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-6">
          <Link href="/rooms" className="text-sm text-muted-foreground hover:text-foreground">
            ← Rooms
          </Link>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Unlock your vault to decrypt messages in <strong>{room.name}</strong>.
        </p>
        <VaultUnlock />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Breadcrumb */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/20">
        <Link href="/rooms" className="hover:text-foreground">
          Rooms
        </Link>{" "}
        / {room.name}
      </div>

      {/* Room view fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <RoomView room={room} />
      </div>
    </div>
  );
}
