// API client for SignalVault
// - All calls use credentials:'include' for the HttpOnly refresh cookie
// - Access token is stored in memory (never localStorage/sessionStorage)
// - On 401, attempts a single refresh then retries; on failure clears session

import type {
  AuthResponse,
  RefreshResponse,
  Note,
  CreateNoteRequest,
  UpdateNoteRequest,
  Room,
  CreateRoomRequest,
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
