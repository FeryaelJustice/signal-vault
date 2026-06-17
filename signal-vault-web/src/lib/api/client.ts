// API client for SignalVault
// - All calls use credentials:'include' for the HttpOnly refresh cookie
// - Access token is stored in memory (never localStorage/sessionStorage)
// - On 401, attempts a single refresh then retries; on failure clears session

import type {
  AuthResponse,
  CastVoteRequest,
  CreateProposalRequest,
  RefreshResponse,
  Note,
  CreateNoteRequest,
  UpdateNoteRequest,
  PasswordHistoryEntry,
  PasswordProposal,
  Room,
  CreateRoomRequest,
  UpdateRoomSecurityRequest,
  RoomInvite,
  RoomMember,
  Message,
  SendMessageRequest,
  User,
} from "./contract";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

// In-memory token store — intentionally module-scoped (not React state)
let _accessToken: string | null = null;
let _onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setOnSessionExpired(cb: () => void): void {
  _onSessionExpired = cb;
}

// Core fetch wrapper
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauth = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (res.status === 401 && retryOnUnauth) {
    // Try refresh once
    try {
      const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (refreshRes.ok) {
        const data: RefreshResponse = await refreshRes.json();
        _accessToken = data.accessToken;
        // Retry original request with new token
        return apiFetch<T>(path, options, false);
      }
    } catch {
      // refresh network error
    }

    // Refresh failed — clear session
    _accessToken = null;
    _onSessionExpired?.();
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiRegister(
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiLogin(
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRefresh(): Promise<RefreshResponse> {
  // Do NOT use apiFetch here — would loop; call directly
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new ApiError(res.status, "Refresh failed");
  return res.json();
}

export async function apiLogout(): Promise<void> {
  await apiFetch<void>("/api/auth/logout", { method: "POST" }, false);
  _accessToken = null;
}

export async function apiMe(): Promise<User> {
  return apiFetch<User>("/api/me");
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function apiGetNotes(): Promise<Note[]> {
  return apiFetch<Note[]>("/api/notes");
}

export async function apiCreateNote(body: CreateNoteRequest): Promise<Note> {
  return apiFetch<Note>("/api/notes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiUpdateNote(
  id: string,
  body: UpdateNoteRequest
): Promise<Note> {
  return apiFetch<Note>(`/api/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function apiDeleteNote(id: string): Promise<void> {
  return apiFetch<void>(`/api/notes/${id}`, { method: "DELETE" });
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export async function apiGetRooms(): Promise<Room[]> {
  return apiFetch<Room[]>("/api/rooms");
}

export async function apiCreateRoom(body: CreateRoomRequest): Promise<Room> {
  return apiFetch<Room>("/api/rooms", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiGetRoomMembers(roomId: string): Promise<RoomMember[]> {
  return apiFetch<RoomMember[]>(`/api/rooms/${roomId}/members`);
}

export async function apiInviteToRoom(
  roomId: string,
  email: string
): Promise<RoomInvite> {
  return apiFetch<RoomInvite>(`/api/rooms/${roomId}/invites`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function apiGetRoomInvites(roomId: string): Promise<RoomInvite[]> {
  return apiFetch<RoomInvite[]>(`/api/rooms/${roomId}/invites`);
}

export async function apiGetPendingInvites(): Promise<RoomInvite[]> {
  return apiFetch<RoomInvite[]>("/api/rooms/invites");
}

export async function apiAcceptInvite(
  inviteId: string,
  encryptedRoomKey: string
): Promise<Room> {
  return apiFetch<Room>(`/api/rooms/invites/${inviteId}/accept`, {
    method: "POST",
    body: JSON.stringify({ encryptedRoomKey }),
  });
}

export async function apiRejectInvite(inviteId: string): Promise<void> {
  return apiFetch<void>(`/api/rooms/invites/${inviteId}/reject`, {
    method: "POST",
  });
}

export async function apiTouchRoomPresence(roomId: string): Promise<void> {
  return apiFetch<void>(`/api/rooms/${roomId}/presence`, { method: "POST" });
}

export async function apiLeaveRoom(roomId: string): Promise<void> {
  return apiFetch<void>(`/api/rooms/${roomId}/membership`, {
    method: "DELETE",
  });
}

export async function apiGetMessages(roomId: string): Promise<Message[]> {
  return apiFetch<Message[]>(`/api/rooms/${roomId}/messages`);
}

export async function apiSendMessage(
  roomId: string,
  body: SendMessageRequest
): Promise<void> {
  return apiFetch<void>(`/api/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Room security ─────────────────────────────────────────────────────────────

export async function apiUpdateRoomSecurity(
  roomId: string,
  body: UpdateRoomSecurityRequest
): Promise<Room> {
  return apiFetch<Room>(`/api/rooms/${roomId}/security`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function apiCreatePasswordProposal(
  roomId: string,
  body: CreateProposalRequest
): Promise<PasswordProposal> {
  return apiFetch<PasswordProposal>(`/api/rooms/${roomId}/password-proposals`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiGetPendingProposal(
  roomId: string
): Promise<PasswordProposal | null> {
  const result = await apiFetch<PasswordProposal | undefined>(
    `/api/rooms/${roomId}/password-proposals/pending`
  );
  return result ?? null;
}

export async function apiCastVote(
  roomId: string,
  proposalId: string,
  body: CastVoteRequest
): Promise<PasswordProposal> {
  return apiFetch<PasswordProposal>(
    `/api/rooms/${roomId}/password-proposals/${proposalId}/vote`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function apiGetPasswordHistory(
  roomId: string
): Promise<PasswordHistoryEntry[]> {
  return apiFetch<PasswordHistoryEntry[]>(`/api/rooms/${roomId}/password-history`);
}
