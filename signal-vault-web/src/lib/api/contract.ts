// API contract types for SignalVault backend
// Base URL: http://localhost:8080
// All requests use credentials:'include' for the HttpOnly refresh cookie

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface Note {
  id: string;
  title: string;
  encryptedContent: string;
  highSecurity: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  title: string;
  encryptedContent: string;
  highSecurity: boolean;
}

export interface UpdateNoteRequest {
  title: string;
  encryptedContent: string;
  highSecurity: boolean;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  encryptedRoomKey: string | null;
  role: "OWNER" | "MEMBER";
  memberCount: number;
  onlineCount: number;
  highSecurity: boolean;
  passwordVerifier: string | null;
}

export interface CreateRoomRequest {
  name: string;
  encryptedRoomKey: string;
  highSecurity: boolean;
}

export interface RoomMember {
  userId: string;
  email: string;
  role: "OWNER" | "MEMBER";
  joinedAt: string;
  lastSeenAt: string | null;
  online: boolean;
}

export interface RoomInvite {
  id: string;
  roomId: string;
  roomName: string;
  inviterId: string;
  inviterEmail: string;
  inviteeEmail: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "REVOKED";
  createdAt: string;
  acceptedAt: string | null;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  encryptedBody: string;
  createdAt: string;
}

export interface SendMessageRequest {
  encryptedBody: string;
}

// ── Room security ─────────────────────────────────────────────────────────────

export interface UpdateRoomSecurityRequest {
  highSecurity: boolean;
}

export interface CreateProposalRequest {
  proposedPassword: string;
  passwordVerifier: string;
}

export interface CastVoteRequest {
  vote: "ACCEPT" | "REJECT";
}

export interface PasswordProposalVote {
  userId: string;
  email: string;
  vote: "ACCEPT" | "REJECT";
  votedAt: string;
}

export interface PasswordProposal {
  id: string;
  roomId: string;
  proposedByUserId: string;
  proposedByEmail: string;
  proposedPassword: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  resolvedAt: string | null;
  votes: PasswordProposalVote[];
  totalMembers: number;
  myVote: "ACCEPT" | "REJECT" | null;
}

export interface PasswordHistoryVoterInfo {
  userId: string;
  email: string;
  votedAt: string;
}

export interface PasswordHistoryEntry {
  id: string;
  roomId: string;
  proposalId: string | null;
  initiatedByUserId: string;
  initiatedByEmail: string;
  proposedPassword: string;
  outcome: "ACCEPTED" | "REJECTED" | "CANCELLED";
  completedAt: string;
  acceptedBy: PasswordHistoryVoterInfo[];
  rejectedBy: PasswordHistoryVoterInfo[];
}

// WebSocket STOMP event types
export interface WsMessageCreatedEvent {
  type: "MESSAGE_CREATED";
  roomId: string;
  messageId: string;
  senderId: string;
  encryptedBody: string;
  createdAt: string;
}

export type WsEvent = WsMessageCreatedEvent;
