import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { db } from "@workspace/db";
import { whatsappSessionsTable, pairingRateLimitsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { useDbAuthState } from "./dbAuthState.js";
import { broadcast } from "../services/websocket/wsServer.js";
import { attachPresenceTracker, stopPresenceTracker } from "../services/presenceTracker.js";
import { attachMessageHandler } from "../services/messageHandler.js";

export type ConnectionStatus =
  | "not_connected"
  | "pending_pairing"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

interface SocketEntry {
  socket: WASocket;
  pairingCode?: string;
  pairingCodeExpiresAt?: Date;
  connectionAccepted: boolean;
}

const activeSockets = new Map<number, SocketEntry>();
const pairingInProgress = new Set<number>();

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
const PAIRING_REQUEST_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 5;

async function checkRateLimit(userId: number): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const rows = await db
    .select()
    .from(pairingRateLimitsTable)
    .where(eq(pairingRateLimitsTable.userId, userId))
    .limit(1);

  if (!rows.length || rows[0].windowStart < windowStart) {
    if (rows.length) {
      await db
        .update(pairingRateLimitsTable)
        .set({ count: 1, windowStart: now, updatedAt: now })
        .where(eq(pairingRateLimitsTable.userId, userId));
    } else {
      await db
        .insert(pairingRateLimitsTable)
        .values({ userId, count: 1, windowStart: now, updatedAt: now });
    }
    return true;
  }

  if (rows[0].count >= RATE_LIMIT_MAX) return false;

  await db
    .update(pairingRateLimitsTable)
    .set({ count: rows[0].count + 1, updatedAt: now })
    .where(eq(pairingRateLimitsTable.userId, userId));

  return true;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) return phone;
  return digits.slice(0, digits.length - 7) + "***" + digits.slice(-4);
}

function makeApiError(message: string, statusCode: number): Error {
  const err = new Error(message);
  (err as any).statusCode = statusCode;
  return err;
}

async function destroySocket(userId: number): Promise<void> {
  const entry = activeSockets.get(userId);
  if (entry) {
    stopPresenceTracker(userId);
    try { entry.socket.end(undefined); } catch {}
    activeSockets.delete(userId);
  }
}

async function persistError(userId: number, errorMsg: string): Promise<void> {
  try {
    await db
      .update(whatsappSessionsTable)
      .set({ lastError: errorMsg, updatedAt: new Date() })
      .where(eq(whatsappSessionsTable.userId, userId));
  } catch {}
}

async function upsertSession(
  userId: number,
  fields: Partial<typeof whatsappSessionsTable.$inferInsert>
): Promise<void> {
  const existing = await db
    .select({ id: whatsappSessionsTable.id })
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(whatsappSessionsTable)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(whatsappSessionsTable.userId, userId));
  } else {
    await db.insert(whatsappSessionsTable).values({
      userId,
      ...fields,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof whatsappSessionsTable.$inferInsert);
  }
}

function scheduleReconnect(userId: number, delayMs: number): void {
  setTimeout(async () => {
    const rows = await db
      .select()
      .from(whatsappSessionsTable)
      .where(eq(whatsappSessionsTable.userId, userId))
      .limit(1);

    if (!rows.length || !rows[0].sessionData) {
      logger.warn({ userId }, "No session data — skipping reconnect");
      return;
    }

    const attempts = rows[0].reconnectAttempts ?? 0;
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn({ userId, attempts }, "Max reconnect attempts reached");
      await upsertSession(userId, {
        status: "error",
        lastError: "Max reconnect attempts reached. Please re-link your WhatsApp.",
      });
      broadcast(userId, {
        type: "session_disconnected",
        userId,
        reason: "max_retries",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await upsertSession(userId, {
      status: "reconnecting",
      reconnectAttempts: attempts + 1,
    });

    logger.info({ userId, attempt: attempts + 1 }, "Auto-reconnecting WhatsApp session");
    const result = await reconnect(userId);
    if (result.status === "failed") {
      const backoff = Math.min(30_000, delayMs * 2);
      scheduleReconnect(userId, backoff);
    }
  }, delayMs);
}

export async function requestPairingCode(
  userId: number,
  phoneNumber: string
): Promise<{ pairingCode: string; expiresAt: string }> {
  if (pairingInProgress.has(userId)) {
    throw makeApiError(
      "A pairing request is already in progress. Please wait for it to complete or try again in a moment.",
      409
    );
  }

  if (!(await checkRateLimit(userId))) {
    throw makeApiError(
      "Too many attempts. Please wait 10 minutes and try again.",
      429
    );
  }

  const existing = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  if (existing.length > 0 && existing[0].status === "connected") {
    throw makeApiError("WhatsApp is already linked for this account.", 409);
  }

  // Strip all non-digits (removes +, spaces, dashes, parentheses)
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 15) {
    throw makeApiError(
      "Invalid phone number. Please include your country code (e.g. +923001234567).",
      400
    );
  }

  pairingInProgress.add(userId);

  try {
    await destroySocket(userId);

    await upsertSession(userId, {
      status: "pending_pairing",
      pairingCode: null,
      pairingCodeExpiresAt: null,
      sessionData: null,
      lastError: null,
      reconnectAttempts: 0,
      phoneNumber: cleanPhone,
      maskedPhone: maskPhone(cleanPhone),
    });

    const { state, saveCreds } = await useDbAuthState(userId);

    let version: [number, number, number];
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
      logger.debug({ userId, version, isLatest: result.isLatest }, "Baileys version fetched");
    } catch (err) {
      version = [2, 3000, 1015901307];
      logger.warn({ err, userId }, "fetchLatestBaileysVersion failed — using hardcoded fallback");
    }

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: logger.child({ component: "baileys", userId }) as any,
      browser: ["WaTracker Pro", "Chrome", "127.0.0"] as [string, string, string],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false,
      defaultQueryTimeoutMs: undefined,
      getMessage: async (_key) => undefined,
    });

    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
    const entry: SocketEntry = {
      socket: sock,
      pairingCodeExpiresAt: expiresAt,
      connectionAccepted: false,
    };
    activeSockets.set(userId, entry);

    sock.ev.on("creds.update", saveCreds);
    attachPresenceTracker(userId, sock);
    attachMessageHandler(userId, sock);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      logger.info({ userId, connection, qr: !!update.qr, receivedPendingNotifications: update.receivedPendingNotifications }, "WA connection.update");
      const boomErr = lastDisconnect?.error as Boom | undefined;
      const boomStatus = boomErr?.output?.statusCode;
      const boomMessage = boomErr?.message ?? (lastDisconnect?.error as any)?.message;

      if (connection === "open") {
        entry.connectionAccepted = true;
        const now = new Date();
        await upsertSession(userId, {
          status: "connected",
          connectedAt: now,
          lastActiveAt: now,
          lastError: null,
          pairingCode: null,
          pairingCodeExpiresAt: null,
        });
        await saveCreds();
        broadcast(userId, {
          type: "session_connected",
          userId,
          timestamp: now.toISOString(),
        });
        logger.info({ userId }, "WhatsApp session connected via pairing code");
      }

      if (connection === "close") {
        const loggedOut = boomStatus === DisconnectReason.loggedOut;
        const restartRequired = boomStatus === DisconnectReason.restartRequired;

        logger.warn(
          {
            userId,
            boomStatus,
            boomMessage,
            connectionAccepted: entry.connectionAccepted,
            hadPairingCode: !!entry.pairingCode,
          },
          "WhatsApp connection closed"
        );

        sock.ev.removeAllListeners("connection.update");

        if (loggedOut) {
          activeSockets.delete(userId);
          await upsertSession(userId, {
            status: "disconnected",
            sessionData: null,
            lastError: "Logged out from WhatsApp",
          });
          broadcast(userId, {
            type: "session_disconnected",
            userId,
            reason: "logged_out",
            timestamp: new Date().toISOString(),
          });
          return;
        }

        if (restartRequired && entry.connectionAccepted) {
          activeSockets.delete(userId);
          scheduleReconnect(userId, 1000);
          return;
        }

        if (!entry.connectionAccepted) {
          activeSockets.delete(userId);

          // If we never got a pairing code, this is a connection-level failure
          // (network issue, server rejection, invalid handshake) — not a wrong code.
          // If we did get a code and connection closed after, the user entered a wrong code.
          const isConnectionFailure = !entry.pairingCode;
          const errorMsg = isConnectionFailure
            ? `Failed to connect to WhatsApp servers. ${boomMessage ? `Reason: ${boomMessage}.` : ""} Please try again.`
            : "WhatsApp rejected the pairing code. Make sure you entered it in the correct WhatsApp account and try again.";

          await upsertSession(userId, {
            status: "error",
            lastError: errorMsg,
          });
          broadcast(userId, {
            type: "session_disconnected",
            userId,
            reason: isConnectionFailure ? "connection_failed" : "pairing_rejected",
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    let code: string;
    try {
      // IMPORTANT: requestPairingCode must be called immediately after makeWASocket,
      // WITHOUT awaiting waitForSocketOpen() first. Calling waitForSocketOpen() first
      // lets Baileys commit to QR-code registration mode, then requestPairingCode
      // conflicts with the already-started handshake — WhatsApp rejects the pairing.
      // Baileys queues the pairing code request internally before the handshake begins
      // when called this way, ensuring the connection runs in pairing-code mode.
      const codePromise = sock.requestPairingCode(cleanPhone);

      const timeoutPromise = new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(makeApiError(
            "Request timed out — WhatsApp servers did not respond. Check your internet and try again.",
            408
          )),
          PAIRING_REQUEST_TIMEOUT_MS
        )
      );

      code = await Promise.race([codePromise, timeoutPromise]);

      if (!code) {
        throw makeApiError(
          "WhatsApp returned an empty pairing code. Please try again.",
          502
        );
      }

      logger.info({ userId, maskedPhone: maskPhone(cleanPhone) }, "Pairing code generated successfully");
    } catch (err: any) {
      await destroySocket(userId);
      const msg = err?.message ?? "Pairing code request failed";
      await persistError(userId, msg);
      logger.error({ err, userId, cleanPhone: maskPhone(cleanPhone) }, "PAIRING ERROR: requestPairingCode failed");
      throw err;
    }

    entry.pairingCode = code;

    await upsertSession(userId, {
      pairingCode: code,
      pairingCodeExpiresAt: expiresAt,
    });

    broadcast(userId, {
      type: "pairing_code_generated",
      userId,
      pairingCode: code,
      expiresAt: expiresAt.toISOString(),
      timestamp: new Date().toISOString(),
    });

    return { pairingCode: code, expiresAt: expiresAt.toISOString() };
  } finally {
    pairingInProgress.delete(userId);
  }
}

export async function getConnectionStatus(userId: number): Promise<{
  status: ConnectionStatus;
  phoneNumber?: string;
  connectedAt?: string;
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
  lastError?: string;
  reconnectAttempts?: number;
}> {
  const rows = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  if (!rows.length) return { status: "not_connected" };

  const row = rows[0];
  const entry = activeSockets.get(userId);

  const isPairingExpired =
    row.status === "pending_pairing" &&
    row.pairingCodeExpiresAt != null &&
    new Date() > row.pairingCodeExpiresAt;

  return {
    status: (row.status as ConnectionStatus) ?? "not_connected",
    phoneNumber: row.maskedPhone ?? undefined,
    connectedAt: row.connectedAt?.toISOString(),
    pairingCode:
      row.status === "pending_pairing" && !isPairingExpired
        ? (entry?.pairingCode ?? row.pairingCode ?? undefined)
        : undefined,
    pairingCodeExpiresAt:
      row.status === "pending_pairing"
        ? (entry?.pairingCodeExpiresAt?.toISOString() ??
          row.pairingCodeExpiresAt?.toISOString())
        : undefined,
    lastError: row.lastError ?? undefined,
    reconnectAttempts: row.reconnectAttempts ?? 0,
  };
}

export async function getPairingCodeStatus(userId: number): Promise<{
  accepted: boolean;
  status: "waiting" | "accepted" | "expired" | "error";
  pairingCode?: string;
  expiresAt?: string;
}> {
  const entry = activeSockets.get(userId);
  const rows = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  if (!rows.length) return { accepted: false, status: "waiting" };

  const row = rows[0];

  if (row.status === "connected" || entry?.connectionAccepted) {
    return { accepted: true, status: "accepted" };
  }

  if (row.status === "error") {
    return { accepted: false, status: "error" };
  }

  if (row.pairingCodeExpiresAt != null && new Date() > row.pairingCodeExpiresAt) {
    return { accepted: false, status: "expired" };
  }

  return {
    accepted: false,
    status: "waiting",
    pairingCode: entry?.pairingCode ?? row.pairingCode ?? undefined,
    expiresAt:
      entry?.pairingCodeExpiresAt?.toISOString() ??
      row.pairingCodeExpiresAt?.toISOString(),
  };
}

export async function disconnect(userId: number): Promise<void> {
  await destroySocket(userId);
  await upsertSession(userId, {
    status: "disconnected",
    pairingCode: null,
    sessionData: null,
    lastError: null,
    reconnectAttempts: 0,
  });
  broadcast(userId, {
    type: "session_disconnected",
    userId,
    reason: "user_disconnected",
    timestamp: new Date().toISOString(),
  });
  logger.info({ userId }, "WhatsApp session disconnected by user");
}

export async function reconnect(
  userId: number
): Promise<{ status: "connected" | "failed" }> {
  const rows = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  if (!rows.length || !rows[0].sessionData) {
    logger.warn({ userId }, "No session data found for reconnect");
    return { status: "failed" };
  }

  await destroySocket(userId);

  try {
    const { state, saveCreds } = await useDbAuthState(userId);

    let version: [number, number, number];
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
    } catch {
      version = [2, 3000, 1015901307];
      logger.warn({ userId }, "fetchLatestBaileysVersion failed in reconnect — using fallback");
    }

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: logger.child({ component: "baileys-reconnect", userId }) as any,
      browser: ["WaTracker Pro", "Chrome", "127.0.0"] as [string, string, string],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false,
      defaultQueryTimeoutMs: undefined,
      getMessage: async (_key) => undefined,
    });

    const entry: SocketEntry = { socket: sock, connectionAccepted: false };
    activeSockets.set(userId, entry);

    sock.ev.on("creds.update", saveCreds);
    attachPresenceTracker(userId, sock);
    attachMessageHandler(userId, sock);

    return await new Promise<{ status: "connected" | "failed" }>((resolve) => {
      const timeout = setTimeout(() => {
        sock.ev.removeAllListeners("connection.update");
        resolve({ status: "failed" });
      }, 30_000);

      sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
          clearTimeout(timeout);
          entry.connectionAccepted = true;
          const now = new Date();
          await upsertSession(userId, {
            status: "connected",
            connectedAt: now,
            lastActiveAt: now,
            lastError: null,
            reconnectAttempts: 0,
          });
          await saveCreds();
          broadcast(userId, {
            type: "session_connected",
            userId,
            timestamp: now.toISOString(),
          });
          logger.info({ userId }, "WhatsApp session reconnected successfully");
          resolve({ status: "connected" });
        }

        if (connection === "close") {
          clearTimeout(timeout);
          const boomErr = lastDisconnect?.error as Boom | undefined;
          const boomStatus = boomErr?.output?.statusCode;
          const boomMessage = boomErr?.message ?? (lastDisconnect?.error as any)?.message;
          const loggedOut = boomStatus === DisconnectReason.loggedOut;

          logger.warn({ userId, boomStatus, boomMessage }, "WhatsApp reconnect connection closed");

          sock.ev.removeAllListeners("connection.update");
          activeSockets.delete(userId);

          if (loggedOut) {
            await upsertSession(userId, {
              status: "disconnected",
              sessionData: null,
              lastError: "Logged out from WhatsApp",
            });
            broadcast(userId, {
              type: "session_disconnected",
              userId,
              reason: "logged_out",
              timestamp: new Date().toISOString(),
            });
          } else {
            const msg = `Reconnect failed — connection closed. ${boomMessage ? `Reason: ${boomMessage}.` : ""}`;
            await persistError(userId, msg);
          }
          resolve({ status: "failed" });
        }
      });
    });
  } catch (err: any) {
    logger.error({ err, userId }, "Reconnect attempt threw an error");
    await persistError(userId, err?.message ?? "Reconnect failed");
    return { status: "failed" };
  }
}

export async function getHealthStatus(userId: number): Promise<{
  healthy: boolean;
  status: string;
  socketActive: boolean;
  phoneNumber?: string;
  connectedAt?: string;
  lastActiveAt?: string;
  reconnectAttempts?: number;
  lastError?: string;
}> {
  const rows = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  if (!rows.length) {
    return { healthy: false, status: "not_connected", socketActive: false };
  }

  const row = rows[0];
  const socketActive = activeSockets.has(userId);
  const healthy = row.status === "connected" && socketActive;

  return {
    healthy,
    status: row.status ?? "not_connected",
    socketActive,
    phoneNumber: row.maskedPhone ?? undefined,
    connectedAt: row.connectedAt?.toISOString(),
    lastActiveAt: row.lastActiveAt?.toISOString(),
    reconnectAttempts: row.reconnectAttempts ?? 0,
    lastError: row.lastError ?? undefined,
  };
}

export function getActiveSocket(userId: number): WASocket | undefined {
  return activeSockets.get(userId)?.socket;
}

export async function gracefulShutdown(): Promise<void> {
  logger.info({ count: activeSockets.size }, "Graceful shutdown: ending all WhatsApp sockets");
  for (const [userId, entry] of activeSockets) {
    stopPresenceTracker(userId);
    try {
      entry.socket.end(undefined);
    } catch {}
  }
  activeSockets.clear();
}

export async function autoReconnectAllSessions(): Promise<void> {
  const rows = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.status, "connected"));

  logger.info(
    { count: rows.length },
    "Auto-reconnecting persisted WhatsApp sessions"
  );

  for (const row of rows) {
    if (!row.sessionData) continue;
    const jitter = 2_000 + Math.random() * 3_000;
    scheduleReconnect(row.userId, jitter);
  }
}
