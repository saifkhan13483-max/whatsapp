import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "../../lib/logger.js";

interface WsClient {
  ws: WebSocket;
  userId: number;
  connectedAt: Date;
}

const clients = new Map<string, WsClient>();
let wss: WebSocketServer | null = null;

export function initWsServer(httpServer: Server): void {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const userIdStr = url.searchParams.get("userId");
    const userId = parseInt(userIdStr ?? "", 10);

    if (!userId || isNaN(userId)) {
      ws.close(1008, "Missing or invalid userId query param");
      return;
    }

    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    clients.set(clientId, { ws, userId, connectedAt: new Date() });

    logger.info({ userId, clientId }, "WebSocket client connected");

    ws.send(JSON.stringify({ type: "connected", userId, timestamp: new Date().toISOString() }));

    ws.on("message", (data: RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {}
    });

    ws.on("close", () => {
      clients.delete(clientId);
      logger.info({ userId, clientId }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.warn({ err, clientId }, "WebSocket error");
      clients.delete(clientId);
    });
  });

  logger.info("WebSocket server initialized at /ws");
}

export function broadcast(userId: number, payload: unknown): void {
  const message = JSON.stringify(payload);
  let sent = 0;

  for (const [clientId, client] of clients) {
    if (client.userId !== userId) continue;
    if (client.ws.readyState !== WebSocket.OPEN) {
      clients.delete(clientId);
      continue;
    }
    try {
      client.ws.send(message);
      sent++;
    } catch (err) {
      logger.warn({ err, clientId }, "Failed to send WS message");
    }
  }

  if (sent > 0) {
    logger.debug({ userId, sent }, "Broadcast sent");
  }
}

export function broadcastAll(payload: unknown): void {
  const message = JSON.stringify(payload);
  for (const [clientId, client] of clients) {
    if (client.ws.readyState !== WebSocket.OPEN) {
      clients.delete(clientId);
      continue;
    }
    try {
      client.ws.send(message);
    } catch {}
  }
}

export function getConnectedCount(): number {
  return clients.size;
}
