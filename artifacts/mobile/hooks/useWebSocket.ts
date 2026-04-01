import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `wss://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "ws://localhost:8080";

export type WsEvent =
  | { type: "pairing_code_generated"; pairingCode: string; expiresAt: string }
  | { type: "session_connected"; phoneNumber?: string; timestamp: string }
  | { type: "session_disconnected"; reason: string; timestamp: string }
  | { type: "session_reconnecting"; attempt: number; maxAttempts: number }
  | { type: "status_change"; contactId: number; contactName: string; status: "online" | "offline"; timestamp: string }
  | { type: "new_message"; chatJid: string; messageId: string; preview: string; isViewOnce: boolean; timestamp: string }
  | { type: "alert_triggered"; alertId: number; alertType: string; contactName: string; details: string; eventId?: number; timestamp: string }
  | { type: "connected"; userId: number; timestamp: string }
  | { type: "pong" };

type EventListener = (event: WsEvent) => void;

interface UseWebSocketOptions {
  onEvent?: EventListener;
  enabled?: boolean;
}

const MAX_BACKOFF_MS = 32_000;
const INITIAL_BACKOFF_MS = 1_000;

export function useWebSocket({ onEvent, enabled = true }: UseWebSocketOptions = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!userId || !mountedRef.current || !enabled) return;

    const url = `${BASE_URL}/ws?userId=${userId}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = INITIAL_BACKOFF_MS;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as WsEvent;
        onEventRef.current?.(data);
        handleCacheInvalidation(data, queryClient);
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!mountedRef.current || !enabled) return;
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [userId, enabled, queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled && userId) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled, userId]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const ping = useCallback(() => send({ type: "ping" }), [send]);

  return { send, ping };
}

function handleCacheInvalidation(event: WsEvent, queryClient: ReturnType<typeof useQueryClient>) {
  switch (event.type) {
    case "session_connected":
    case "session_disconnected":
    case "session_reconnecting":
    case "pairing_code_generated":
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      break;
    case "status_change":
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact", event.contactId] });
      queryClient.invalidateQueries({ queryKey: ["family-summary"] });
      break;
    case "new_message":
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", event.chatJid] });
      if (event.isViewOnce) {
        queryClient.invalidateQueries({ queryKey: ["view-once"] });
      }
      break;
    case "alert_triggered":
      queryClient.invalidateQueries({ queryKey: ["alert-events"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      break;
  }
}
