"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  apiGetMessages,
  apiGetRoomInvites,
  apiGetRoomMembers,
  apiInviteToRoom,
  apiLeaveRoom,
  apiTouchRoomPresence,
  apiUpdateRoomSecurity,
  apiCreatePasswordProposal,
  apiGetPendingProposal,
  apiCastVote,
  apiGetPasswordHistory,
} from "@/lib/api/client";
import { useVaultStore } from "@/lib/vault/vaultStore";
import { useRoomPasswordStore } from "@/lib/vault/roomPasswordStore";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRoomConnection } from "@/lib/realtime/useRoomConnection";
import {
  decryptWithKey,
  encryptWithKey,
  importRoomKey,
  createRoomPasswordVerifier,
} from "@/lib/crypto/vault";
import type { PasswordHistoryEntry, PasswordProposal, Room, WsEvent } from "@/lib/api/contract";
import { formatDistanceToNow } from "@/lib/utils/date";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectionBadge } from "@/components/rooms/ConnectionBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MESSAGE_DECRYPTION_ERROR =
  "Could not decrypt: this message was encrypted with another key, passphrase, or origin.";

interface DisplayMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

interface RoomViewProps {
  room: Room;
}

export function RoomView({ room }: RoomViewProps) {
  const { vaultKey, saltHex, locked } = useVaultStore();
  const { isUnlocked: isRoomUnlocked, unlockRoom } = useRoomPasswordStore();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  const [roomKeyMaterial, setRoomKeyMaterial] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isOwner = room.role === "OWNER";

  // Security modals state
  const [showProposalCreate, setShowProposalCreate] = useState(false);
  const [showProposalReview, setShowProposalReview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const roomUnlocked = !room.highSecurity || !room.passwordVerifier || isRoomUnlocked(room.id);

  useEffect(() => {
    let cancelled = false;

    async function loadRoomKey() {
      if (!vaultKey) return;
      try {
        if (!room.encryptedRoomKey) {
          setRoomKey(vaultKey);
          setRoomKeyMaterial(null);
          setKeyError("This legacy room uses your vault key. Create a new room to invite members.");
          return;
        }
        const material = await decryptWithKey(room.encryptedRoomKey, vaultKey);
        const imported = await importRoomKey(material);
        if (!cancelled) {
          setRoomKey(imported);
          setRoomKeyMaterial(material);
          setKeyError(null);
        }
      } catch {
        if (!cancelled) {
          setRoomKey(null);
          setRoomKeyMaterial(null);
          setKeyError("Could not unlock this room key with the current vault passphrase.");
        }
      }
    }

    loadRoomKey();

    return () => {
      cancelled = true;
    };
  }, [room.encryptedRoomKey, vaultKey]);

  const { data: rawMessages, isLoading } = useQuery({
    queryKey: ["messages", room.id],
    queryFn: () => apiGetMessages(room.id),
    enabled: !!room.id && roomUnlocked,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: members } = useQuery({
    queryKey: ["room-members", room.id],
    queryFn: () => apiGetRoomMembers(room.id),
    refetchInterval: 10_000,
  });
  const liveMemberCount = members?.length ?? room.memberCount;
  const liveOnlineCount =
    members?.filter((member) => member.online).length ?? room.onlineCount;

  const { data: invites } = useQuery({
    queryKey: ["room-invites", room.id],
    queryFn: () => apiGetRoomInvites(room.id),
    enabled: isOwner,
  });

  const { data: pendingProposal } = useQuery({
    queryKey: ["room-pending-proposal", room.id],
    queryFn: () => apiGetPendingProposal(room.id),
    refetchInterval: 30_000,
    enabled: roomUnlocked,
  });

  const { data: passwordHistory } = useQuery({
    queryKey: ["room-password-history", room.id],
    queryFn: () => apiGetPasswordHistory(room.id),
    enabled: showHistory,
  });

  useEffect(() => {
    if (!rawMessages || !roomKey) return;
    const decryptAll = async () => {
      const decrypted: DisplayMessage[] = [];
      for (const msg of rawMessages.slice().reverse()) {
        try {
          const body = await decryptWithKey(msg.encryptedBody, roomKey);
          decrypted.push({ id: msg.id, senderId: msg.senderId, body, createdAt: msg.createdAt });
        } catch {
          decrypted.push({
            id: msg.id,
            senderId: msg.senderId,
            body: MESSAGE_DECRYPTION_ERROR,
            createdAt: msg.createdAt,
          });
        }
      }
      setMessages(decrypted);
    };
    decryptAll();
  }, [rawMessages, roomKey]);

  useEffect(() => {
    if (locked) return;
    const markPresent = () => {
      apiTouchRoomPresence(room.id)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["room-members", room.id] });
          qc.invalidateQueries({ queryKey: ["rooms"] });
        })
        .catch(() => undefined);
    };

    markPresent();
    const id = window.setInterval(markPresent, 25_000);
    return () => window.clearInterval(id);
  }, [locked, qc, room.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleWsMessage = useCallback(
    async (event: WsEvent) => {
      if (event.type !== "MESSAGE_CREATED" || event.roomId !== room.id) return;
      let body = event.encryptedBody;
      if (roomKey) {
        try {
          body = await decryptWithKey(event.encryptedBody, roomKey);
        } catch {
          body = MESSAGE_DECRYPTION_ERROR;
        }
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === event.messageId)) return prev;
        return [
          ...prev,
          { id: event.messageId, senderId: event.senderId, body, createdAt: event.createdAt },
        ];
      });
    },
    [room.id, roomKey]
  );

  const { status, sendMessage } = useRoomConnection({
    roomId: room.id,
    onMessage: handleWsMessage,
    enabled: !locked && !!roomKey && roomUnlocked,
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => apiInviteToRoom(room.id, email),
    onSuccess: async (invite) => {
      qc.invalidateQueries({ queryKey: ["room-invites", room.id] });
      if (!roomKeyMaterial) {
        toast.error("This room cannot create key-sharing links");
        return;
      }
      const url = `${window.location.origin}/rooms/${room.id}?invite=${invite.id}#roomKey=${encodeURIComponent(roomKeyMaterial)}`;
      setInviteLink(url);
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      toast.success("Invite link copied");
      setInviteEmail("");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to invite user"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiLeaveRoom(room.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Left room");
      router.push("/rooms");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to leave room"),
  });

  const toggleSecurityMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiUpdateRoomSecurity(room.id, { highSecurity: enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Security settings updated");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update security"),
  });

  const pendingInvites = useMemo(
    () => invites?.filter((invite) => invite.status === "PENDING") ?? [],
    [invites]
  );

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || !roomKey || !saltHex) return;
    setIsSending(true);
    try {
      const encryptedBody = await encryptWithKey(
        inputValue.trim(),
        roomKey,
        room.encryptedRoomKey ? JSON.parse(room.encryptedRoomKey).salt : saltHex
      );
      sendMessage({ encryptedBody });
      setInputValue("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate(inviteEmail.trim());
  }

  if (locked) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Unlock your vault to join this room.
      </div>
    );
  }

  // Room password gate
  if (!roomUnlocked) {
    return (
      <RoomPasswordGate
        roomId={room.id}
        roomName={room.name}
        verifier={room.passwordVerifier!}
        onUnlocked={() => qc.invalidateQueries({ queryKey: ["messages", room.id] })}
        unlockRoom={unlockRoom}
      />
    );
  }

  const proposalNeedsMyVote = pendingProposal && !pendingProposal.myVote;

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[1fr_280px]">
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-sm">{room.name}</h2>
              {room.highSecurity && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <ShieldIcon className="h-3 w-3" />
                  Protected
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {liveMemberCount} member{liveMemberCount === 1 ? "" : "s"} · {liveOnlineCount} online
            </p>
          </div>
          <ConnectionBadge status={status} />
        </div>

        {keyError && (
          <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-muted-foreground">
            {keyError}
          </div>
        )}

        {/* Pending proposal notification banner (shown to all members who haven't voted) */}
        {proposalNeedsMyVote && (
          <div className="flex items-center justify-between border-b border-primary/30 bg-primary/10 px-4 py-2">
            <p className="text-xs text-primary">
              <strong>{pendingProposal.proposedByEmail}</strong> proposed a room password change.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => setShowProposalReview(true)}
            >
              Review
            </Button>
          </div>
        )}

        {/* High security warning if no password is set */}
        {room.highSecurity && !room.passwordVerifier && isOwner && (
          <div className="flex items-center justify-between border-b border-warning/30 bg-warning/10 px-4 py-2">
            <p className="text-xs text-muted-foreground">
              High security is enabled but no password is set yet.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => setShowProposalCreate(true)}
            >
              Set password
            </Button>
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          role="log"
          aria-live="polite"
          aria-label="Room messages"
        >
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
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {!isOwn && (
                    <p className="mb-0.5 max-w-[160px] truncate text-xs font-medium opacity-60">
                      {members?.find((m) => m.userId === msg.senderId)?.email ??
                        `${msg.senderId.slice(0, 8)}...`}
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

        <form
          onSubmit={handleSend}
          className="border-t border-border/40 px-4 py-3 flex items-center gap-2"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              status === "connected"
                ? "Type a message... (encrypted)"
                : "Waiting for connection..."
            }
            disabled={status !== "connected" || isSending || !roomKey}
            className="flex-1"
            aria-label="Message input"
          />
          <Button
            type="submit"
            size="sm"
            disabled={status !== "connected" || isSending || !inputValue.trim() || !roomKey}
            aria-label="Send message"
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <aside className="border-t border-border/40 bg-card/30 p-4 md:border-l md:border-t-0">
        <div className="space-y-6">
          <section>
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Members
            </h3>
            <ul className="mt-3 space-y-2">
              {members?.map((member) => (
                <li key={member.userId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{member.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.role.toLowerCase()} · {member.online ? "Online" : "Offline"}
                    </p>
                  </div>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${member.online ? "bg-success" : "bg-muted-foreground/40"}`}
                    title={member.online ? "Online" : "Offline"}
                  />
                </li>
              ))}
            </ul>
          </section>

          {isOwner && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Invite
              </h3>
              <form onSubmit={handleInvite} className="mt-3 flex gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@email.com"
                  type="email"
                  disabled={!roomKeyMaterial || inviteMutation.isPending}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!roomKeyMaterial || inviteMutation.isPending || !inviteEmail.trim()}
                >
                  Invite
                </Button>
              </form>
              {inviteLink && (
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  Copied invite link: {inviteLink}
                </p>
              )}
              {pendingInvites.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {pendingInvites.map((invite) => (
                      <li key={invite.id}>{invite.inviteeEmail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Owner-only security section */}
          {isOwner && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Security
              </h3>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">High security</p>
                    <p className="text-[10px] text-muted-foreground">
                      {room.highSecurity ? "Password required to enter" : "Disabled"}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={room.highSecurity}
                    onClick={() => toggleSecurityMutation.mutate(!room.highSecurity)}
                    disabled={toggleSecurityMutation.isPending || (!room.highSecurity && !room.passwordVerifier)}
                    title={
                      !room.highSecurity && !room.passwordVerifier
                        ? "Set a room password first"
                        : undefined
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                      room.highSecurity ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        room.highSecurity ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() =>
                    pendingProposal ? setShowProposalReview(true) : setShowProposalCreate(true)
                  }
                >
                  {pendingProposal ? "View pending proposal" : "Propose room password"}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setShowHistory(true)}
                >
                  Password history
                </Button>
              </div>
            </section>
          )}

          {/* Non-owner: propose password change */}
          {!isOwner && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Security
              </h3>
              <div className="mt-3 space-y-2">
                {pendingProposal ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowProposalReview(true)}
                  >
                    View pending proposal
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setShowProposalCreate(true)}
                  >
                    Propose password change
                  </Button>
                )}
              </div>
            </section>
          )}

          {!isOwner && (
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
            >
              Leave room
            </Button>
          )}
        </div>
      </aside>

      {/* Password proposal creation dialog */}
      <ProposalCreateDialog
        open={showProposalCreate}
        roomId={room.id}
        onClose={() => setShowProposalCreate(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["room-pending-proposal", room.id] });
          qc.invalidateQueries({ queryKey: ["rooms"] });
        }}
      />

      {/* Proposal review / vote dialog */}
      {pendingProposal && (
        <ProposalReviewDialog
          open={showProposalReview}
          proposal={pendingProposal}
          roomId={room.id}
          onClose={() => setShowProposalReview(false)}
          onVoted={() => {
            qc.invalidateQueries({ queryKey: ["room-pending-proposal", room.id] });
            qc.invalidateQueries({ queryKey: ["rooms"] });
          }}
        />
      )}

      {/* Password history dialog (owner only) */}
      {isOwner && (
        <PasswordHistoryDialog
          open={showHistory}
          history={passwordHistory ?? []}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

// ── Room password gate ────────────────────────────────────────────────────────

function RoomPasswordGate({
  roomId,
  roomName,
  verifier,
  onUnlocked,
  unlockRoom,
}: {
  roomId: string;
  roomName: string;
  verifier: string;
  onUnlocked: () => void;
  unlockRoom: (roomId: string, password: string, verifier: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setChecking(true);
    setError(null);
    const ok = await unlockRoom(roomId, password, verifier);
    setChecking(false);
    if (ok) {
      onUnlocked();
    } else {
      setError("Wrong room password. Please try again.");
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="w-full max-w-sm space-y-4 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{roomName}</h2>
            <p className="text-sm text-muted-foreground">
              This room requires a password to enter.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Room password"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={checking || !password}
          >
            {checking ? "Verifying…" : "Enter room"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Proposal creation dialog ──────────────────────────────────────────────────

function ProposalCreateDialog({
  open,
  roomId,
  onClose,
  onCreated,
}: {
  open: boolean;
  roomId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [proposedPassword, setProposedPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProposedPassword("");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmPassword("");
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const passwordVerifier = await createRoomPasswordVerifier(proposedPassword);
      return apiCreatePasswordProposal(roomId, { proposedPassword, passwordVerifier });
    },
    onSuccess: () => {
      toast.success("Password proposal submitted. All members must accept for it to take effect.");
      onCreated();
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to create proposal"),
  });

  const passwordMismatch =
    proposedPassword && confirmPassword && proposedPassword !== confirmPassword;
  const canSubmit =
    proposedPassword.length >= 8 && proposedPassword === confirmPassword;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-primary" />
            Propose room password
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            All members will see this password and must vote to accept before it takes effect.
            A single rejection cancels the proposal.
          </p>
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <strong>Remember:</strong> Once accepted, all members must know this password to enter
            the room. Changing it again requires a new proposal with unanimous agreement.
          </div>
          <Input
            type="text"
            value={proposedPassword}
            onChange={(e) => setProposedPassword(e.target.value)}
            placeholder="New room password (min. 8 chars)"
            autoFocus
          />
          <Input
            type="text"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
          />
          {passwordMismatch && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !canSubmit}
          >
            {createMutation.isPending ? "Submitting…" : "Submit proposal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Proposal review / vote dialog ─────────────────────────────────────────────

function ProposalReviewDialog({
  open,
  proposal,
  roomId,
  onClose,
  onVoted,
}: {
  open: boolean;
  proposal: PasswordProposal;
  roomId: string;
  onClose: () => void;
  onVoted: () => void;
}) {
  const voteMutation = useMutation({
    mutationFn: (vote: "ACCEPT" | "REJECT") =>
      apiCastVote(roomId, proposal.id, { vote }),
    onSuccess: (updated) => {
      if (updated.status === "ACCEPTED") {
        toast.success("Password accepted! The room password has been updated.");
      } else if (updated.status === "REJECTED") {
        toast.info("Password proposal rejected.");
      } else {
        toast.success("Vote recorded. Waiting for remaining members.");
      }
      onVoted();
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to cast vote"),
  });

  const acceptedCount = proposal.votes.filter((v) => v.vote === "ACCEPT").length;
  const pendingCount = proposal.totalMembers - proposal.votes.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-primary" />
            Password change proposal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs text-muted-foreground">Proposed by</p>
            <p className="text-sm font-medium">{proposal.proposedByEmail}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Proposed password</p>
            <p className="mt-0.5 rounded-md border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
              {proposal.proposedPassword}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              This will become the new room password if all members accept.
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Status: {acceptedCount}/{proposal.totalMembers} accepted · {pendingCount} pending
            </p>
            {proposal.votes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {proposal.votes.map((v) => (
                  <li key={v.userId} className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">{v.email}</span>
                    <span
                      className={v.vote === "ACCEPT" ? "text-success" : "text-destructive"}
                    >
                      {v.vote === "ACCEPT" ? "Accepted" : "Rejected"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={voteMutation.isPending}>
            Close
          </Button>
          {!proposal.myVote && proposal.status === "PENDING" && (
            <>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => voteMutation.mutate("REJECT")}
                disabled={voteMutation.isPending}
              >
                Reject
              </Button>
              <Button
                onClick={() => voteMutation.mutate("ACCEPT")}
                disabled={voteMutation.isPending}
              >
                {voteMutation.isPending ? "Voting…" : "Accept"}
              </Button>
            </>
          )}
          {proposal.myVote && (
            <p className="text-xs text-muted-foreground self-center">
              You voted: {proposal.myVote}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Password history dialog ───────────────────────────────────────────────────

function PasswordHistoryDialog({
  open,
  history,
  onClose,
}: {
  open: boolean;
  history: PasswordHistoryEntry[];
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Password change history</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-3 overflow-y-auto py-2">
          {history.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No history yet.</p>
          )}
          {history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    entry.outcome === "ACCEPTED"
                      ? "text-success"
                      : entry.outcome === "REJECTED"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {entry.outcome}
                </span>
                <time className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(entry.completedAt)}
                </time>
              </div>
              <p className="text-xs text-muted-foreground">
                Proposed by <span className="font-medium">{entry.initiatedByEmail}</span>
              </p>
              <p className="text-xs">
                Password: <span className="font-mono">{entry.proposedPassword}</span>
              </p>
              {entry.acceptedBy.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Accepted: {entry.acceptedBy.map((v) => v.email).join(", ")}
                </p>
              )}
              {entry.rejectedBy.length > 0 && (
                <p className="text-[10px] text-destructive">
                  Rejected: {entry.rejectedBy.map((v) => v.email).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
