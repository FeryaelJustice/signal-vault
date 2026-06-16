"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Client, type IMessage, type StompHeaders } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getAccessToken } from "@/lib/api/client";
import type { WsEvent } from "@/lib/api/contract";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

interface UseRoomConnectionOptions {
  roomId: string | null;
  onMessage: (event: WsEvent) => void;
  enabled?: boolean;
}

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080/ws";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

export function useRoomConnection({
  roomId,
  onMessage,
  enabled = true,
}: UseRoomConnectionOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const clientRef = useRef<Client | null>(null);
  const reconnectCountRef = useRef(0);
  const onMessageRef = useRef(onMessage);

  // Keep callback ref up-to-date without triggering re-subscription
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    // When not enabled or no room, deactivate and mark disconnected
    if (!enabled || !roomId) {
      const existing = clientRef.current;
      if (existing?.active) {
        existing.deactivate();
      }
      clientRef.current = null;
      // Schedule status update outside the synchronous effect body
      const id = setTimeout(() => setStatus("disconnected"), 0);
      return () => clearTimeout(id);
    }

    const connectHeaders: StompHeaders = {};
    const token = getAccessToken();
    if (token) {
      connectHeaders["Authorization"] = `Bearer ${token}`;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL) as WebSocket,
      connectHeaders,
      reconnectDelay: Math.min(
        RECONNECT_DELAY_MS * Math.pow(2, reconnectCountRef.current),
        MAX_RECONNECT_DELAY_MS
      ),

      onConnect: () => {
        reconnectCountRef.current = 0;
        setStatus("connected");

        client.subscribe(`/topic/rooms/${roomId}`, (msg: IMessage) => {
          try {
            const event = JSON.parse(msg.body) as WsEvent;
            onMessageRef.current(event);
          } catch {
            console.error("[WS] Failed to parse message", msg.body);
          }
        });
      },

      onDisconnect: () => {
        setStatus("disconnected");
      },

      onStompError: (frame) => {
        console.error("[WS] STOMP error", frame);
        setStatus("reconnecting");
        reconnectCountRef.current += 1;
      },

      onWebSocketError: () => {
        setStatus("reconnecting");
        reconnectCountRef.current += 1;
      },

      onWebSocketClose: () => {
        if (clientRef.current?.active) {
          setStatus("reconnecting");
        }
      },
    });

    clientRef.current = client;
    client.activate();
    // Status transitions happen in STOMP callbacks (onConnect, onDisconnect, etc.)
    // We set "connecting" after activate() — this is intentional for WS integration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("connecting");

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [roomId, enabled]);

  const sendMessage = useCallback(
    (payload: Record<string, unknown>) => {
      if (!clientRef.current?.connected || !roomId) return;
      clientRef.current.publish({
        destination: `/app/rooms/${roomId}`,
        body: JSON.stringify(payload),
      });
    },
    [roomId]
  );

  const disconnect = useCallback(() => {
    if (clientRef.current?.active) {
      clientRef.current.deactivate();
    }
    clientRef.current = null;
    setStatus("disconnected");
  }, []);

  return { status, sendMessage, disconnect };
}
