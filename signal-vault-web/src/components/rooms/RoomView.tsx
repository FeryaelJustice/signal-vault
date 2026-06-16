"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiGetMessages } from "@/lib/api/client";
import { useVaultStore } from "@/lib/vault/vaultStore";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  useRoomConnection,
} from "@/lib/realtime/useRoomConnection";
import { encryptWithKey, decryptWithKey } from "@/lib/crypto/vault";
import type { WsEvent } from "@/lib/api/contract";
import { formatDistanceToNow } from "@/lib/utils/date";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectionBadge } from "@/components/rooms/ConnectionBadge";

interface DisplayMessage {
  id: string;
  senderId: string;
  body: string; // decrypted
  createdAt: string;
}

interface RoomViewProps {
  roomId: string;
  roomName: string;
}

export function RoomView({ roomId, roomName }: RoomViewProps) {
  const { vaultKey, saltHex, locked } = useVaultStore();
  const { user } = useAuth();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load message history
  const { data: rawMessages, isLoading } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: () => apiGetMessages(roomId),
    enabled: !!roomId,
  });

  // Decrypt historical messages
  useEffect(() => {
    if (!rawMessages || !vaultKey) return;
    const decryptAll = async () => {
      const decrypted: DisplayMessage[] = [];
      for (const msg of rawMessages) {
        try {
          const body = await decryptWithKey(msg.encryptedBody, vaultKey);
          decrypted.push({ id: msg.id, senderId: msg.senderId, body, createdAt: msg.createdAt });
        } catch {
          decrypted.push({
            id: msg.id,
            senderId: msg.senderId,
            body: "[Encrypted — cannot decrypt]",
            createdAt: msg.createdAt,
          });
        }
      }
      setMessages(decrypted);
    };
    decryptAll();
  }, [rawMessages, vaultKey]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle incoming WebSocket events
  const handleWsMessage = useCallback(
    async (event: WsEvent) => {
      if (event.type !== "MESSAGE_CREATED" || event.roomId !== roomId) return;
      let body = event.encryptedBody;
      if (vaultKey) {
        try {
          body = await decryptWithKey(event.encryptedBody, vaultKey);
        } catch {
          body = "[Encrypted — cannot decrypt]";
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          id: event.messageId,
          senderId: event.senderId,
          body,
          createdAt: event.createdAt,
        },
      ]);
    },
    [roomId, vaultKey]
  );

  const { status, sendMessage } = useRoomConnection({
    roomId,
    onMessage: handleWsMessage,
    enabled: !locked,
  });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || !vaultKey || !saltHex) return;
    setIsSending(true);
    try {
      const encryptedBody = await encryptWithKey(inputValue.trim(), vaultKey, saltHex);
      sendMessage({ encryptedBody });
      setInputValue("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  if (locked) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Unlock your vault to join this room.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Room header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <h2 className="font-medium text-sm">{roomName}</h2>
        <ConnectionBadge status={status} />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" role="log" aria-live="polite" aria-label="Room messages">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <ChatIcon className="h-8 w-8 opacity-30" />
            <p className="text-sm">No messages yet. Say something!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.senderId === user?.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  isOwn
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                {!isOwn && (
                  <p className="mb-0.5 text-xs font-medium opacity-60 truncate max-w-[120px]">
                    {msg.senderId.slice(0, 8)}…
                  </p>
                )}
                <p className="break-words leading-relaxed">{msg.body}</p>
                <time className={`mt-1 block text-[10px] opacity-50 ${isOwn ? "text-right" : ""}`}>
                  {formatDistanceToNow(msg.createdAt)}
                </time>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      <form
        onSubmit={handleSend}
        className="border-t border-border/40 px-4 py-3 flex items-center gap-2"
      >
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            status === "connected"
              ? "Type a message… (encrypted)"
              : "Waiting for connection…"
          }
          disabled={status !== "connected" || isSending}
          className="flex-1"
          aria-label="Message input"
        />
        <Button
          type="submit"
          size="sm"
          disabled={status !== "connected" || isSending || !inputValue.trim()}
          aria-label="Send message"
        >
          <SendIcon className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
