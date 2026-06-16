"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiGetRooms } from "@/lib/api/client";
import { RoomView } from "@/components/rooms/RoomView";
import { useVaultStore } from "@/lib/vault/vaultStore";
import { VaultUnlock } from "@/components/vault/VaultUnlock";

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id } = use(params);
  const { locked } = useVaultStore();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: apiGetRooms,
  });

  const room = rooms?.find((r) => r.id === id);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!room) {
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
        <RoomView roomId={id} roomName={room.name} />
      </div>
    </div>
  );
}
