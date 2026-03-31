import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { db } from "@workspace/db";
import { whatsappSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { useDbAuthState } from "./dbAuthState.js";
import { broadcast } from "../services/websocket/wsServer.js";

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

const rateLimitMap = new Map<number, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
const PAIRING_REQUEST_TIMEOUT_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 5;

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
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
  if (!checkRateLimit(userId)) {
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

  const cleanPhone = phoneNumber.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7) {
    throw makeApiError(
      "Invalid phone number. Please include your country code (e.g. +923001234567).",
      400
    );
  }

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
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: logger.child({ component: "baileys", userId }) as any,
    browser: ["Windows", "Chrome", "114.0.5735.198"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    defaultQueryTimeoutMs: undefined,
    qrTimeout: 10 * 60 * 1000,
  });

  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
  const entry: SocketEntry = {
    socket: sock,
    pairingCodeExpiresAt: expiresAt,
    connectionAccepted: false,
  };
  activeSockets.set(userId, entry);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
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
      const boomStatus = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = boomStatus === DisconnectReason.loggedOut;
      const restartRequired = boomStatus === DisconnectReason.restartRequired;

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
        await persistError(
          userId,
          "Connection closed before pairing completed. Check the code and try again."
        );
        broadcast(userId, {
          type: "session_disconnected",
          userId,
          reason: "pairing_failed",
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  let code: string;
  try {
    const codeRace = (async () => {
      await sock.waitForSocketOpen();
      return sock.requestPairingCode(cleanPhone);
    })();

    const timeoutRace = new Promise<never>((_, rej) =>
      setTimeout(
        () =>
          rej(
            makeApiError(
              "Could not reach WhatsApp servers. Check your internet connection and try again.",
              408
            )
          ),
        PAIRING_REQUEST_TIMEOUT_MS
      )
    );

    code = await Promise.race([codeRace, timeoutRace]);
  } catch (err: any) {
    await destroySocket(userId);
    await persistError(userId, err?.message ?? "Pairing code request failed");
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

  logger.info(
    { userId, maskedPhone: maskPhone(cleanPhone) },
    "Pairing code generated successfully"
  );

  return { pairingCode: code, expiresAt: expiresAt.toISOString() };
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
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: logger.child({ component: "baileys-reconnect", userId }) as any,
      browser: ["Windows", "Chrome", "114.0.5735.198"],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: undefined,
    });

    const entry: SocketEntry = { socket: sock, connectionAccepted: false };
    activeSockets.set(userId, entry);

    sock.ev.on("creds.update", saveCreds);

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
          const boomStatus = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const loggedOut = boomStatus === DisconnectReason.loggedOut;
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
            await persistError(userId, "Reconnect failed — connection closed unexpectedly");
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
