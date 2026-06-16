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
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  title: string;
  encryptedContent: string;
}

export interface UpdateNoteRequest {
  title: string;
  encryptedContent: string;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface CreateRoomRequest {
  name: string;
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
