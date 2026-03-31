import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type AuthenticationState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { db } from "@workspace/db";
import { whatsappSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const APP_SECRET = process.env["JWT_SECRET"] ?? "default-secret-change-me";

function encrypt(text: string): string {
  const key = crypto.scryptSync(APP_SECRET, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  try {
    const [ivHex, encHex] = text.split(":");
    const key = crypto.scryptSync(APP_SECRET, "salt", 32);
    const iv = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return text;
  }
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  const last4 = digits.slice(-4);
  const prefix = phone.slice(0, phone.indexOf(digits.slice(-7, -4)));
  return phone.replace(digits.slice(-7, -4), "***").replace(digits.slice(-4), last4);
}

export type ConnectionStatus = "not_connected" | "pending_pairing" | "connected" | "disconnected";

interface SocketEntry {
  socket: WASocket;
  pairingCode?: string;
  pairingCodeExpiresAt?: Date;
  connectionAccepted: boolean;
  sessionDir: string;
}

const activeSockets = new Map<number, SocketEntry>();
const rateLimitMap = new Map<number, { count: number; windowStart: number }>();

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
const PAIRING_REQUEST_TIMEOUT_MS = 30_000;

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

function getSessionDir(userId: number): string {
  const dir = path.join(os.tmpdir(), `wa_session_${userId}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function destroySocket(userId: number) {
  const entry = activeSockets.get(userId);
  if (entry) {
    try {
      entry.socket.end(undefined);
    } catch {}
    activeSockets.delete(userId);
    try {
      fs.rmSync(entry.sessionDir, { recursive: true, force: true });
    } catch {}
  }
}

function makeApiError(message: string, statusCode: number): Error {
  const err = new Error(message);
  (err as any).statusCode = statusCode;
  return err;
}

export async function requestPairingCode(
  userId: number,
  phoneNumber: string
): Promise<{ pairingCode: string; expiresAt: string }> {
  if (!checkRateLimit(userId)) {
    throw makeApiError("Too many attempts. Please wait 10 minutes and try again.", 429);
  }

  const existingSession = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  if (existingSession.length > 0 && existingSession[0].status === "connected") {
    throw makeApiError("WhatsApp is already linked for this account.", 409);
  }

  // Baileys requires pure digits only — strip country code + sign
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7) {
    throw makeApiError("Invalid phone number. Please include your country code.", 400);
  }

  // Destroy any existing in-memory socket
  await destroySocket(userId);

  if (existingSession.length > 0) {
    await db
      .update(whatsappSessionsTable)
      .set({ sessionData: null, status: "pending_pairing", updatedAt: new Date() })
      .where(eq(whatsappSessionsTable.userId, userId));
  }

  // Always wipe the session dir — prevents stale creds.json from causing passive
  // (reconnect) login instead of fresh pairing. Works across server restarts
  // since activeSockets is empty but /tmp files persist.
  const sessionDir = path.join(os.tmpdir(), `wa_session_${userId}`);
  try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state as AuthenticationState,
    printQRInTerminal: false,
    logger: logger.child({ component: "baileys", userId }) as any,
    browser: ["WaTracker Pro", "Chrome", "120.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    // Safety net: even if pair-device arrives unexpectedly, keep socket alive
    // long enough for the user to enter the code (10 min per QR ref).
    qrTimeout: 10 * 60 * 1000,
  });

  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
  const entry: SocketEntry = {
    socket: sock,
    pairingCodeExpiresAt: expiresAt,
    connectionAccepted: false,
    sessionDir,
  };
  activeSockets.set(userId, entry);
  sock.ev.on("creds.update", saveCreds);

  function destroyEntry() {
    try { sock.end(undefined); } catch {}
    activeSockets.delete(userId);
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
  }

  // --- Phase 1: Obtain the pairing code ---
  // We MUST call requestPairingCode() BEFORE WhatsApp sends the pair-device IQ.
  // waitForSocketOpen() resolves after the Noise handshake completes (WS is open
  // and the noise channel is ready). At that point, validateConnection() has
  // started in Baileys but pair-device has not yet arrived (it takes a network
  // round-trip). Sending link_code_companion_reg here tells WhatsApp to enter
  // phone-number pairing mode — it never sends pair-device, so the QR ref loop
  // never starts and can never kill the socket.
  let code: string;
  try {
    const codeRace = (async () => {
      await sock.waitForSocketOpen();
      return await sock.requestPairingCode(cleanPhone);
    })();

    const timeoutRace = new Promise<never>((_, rej) =>
      setTimeout(
        () => rej(makeApiError(
          "Could not reach WhatsApp. Please check your internet connection and try again.",
          408
        )),
        PAIRING_REQUEST_TIMEOUT_MS
      )
    );

    code = await Promise.race([codeRace, timeoutRace]);
  } catch (err: any) {
    destroyEntry();
    const msg: string = err?.message ?? "";
    const lowerMsg = msg.toLowerCase();
    const boomStatus = (err as Boom)?.output?.statusCode;
    const httpStatus: number = (err as any).statusCode ?? (
      (lowerMsg.includes("not registered") || lowerMsg.includes("invalid phone")) ? 400 :
      boomStatus === 428 || lowerMsg.includes("428") ? 428 :
      boomStatus === 401 || lowerMsg.includes("401") ? 401 :
      typeof (err as any).statusCode === "number" ? (err as any).statusCode :
      500
    );
    throw makeApiError(
      (err as any).statusCode ? msg :
      (httpStatus === 400 ? "This phone number doesn't appear to be registered on WhatsApp." :
       httpStatus === 408 ? "Could not reach WhatsApp. Please check your internet connection and try again." :
       httpStatus === 428 ? "Connection was not ready. Please wait a moment and try again." :
       httpStatus === 401 ? "WhatsApp rejected the connection. Please try again." :
       "Could not connect to WhatsApp. Please try again."),
      httpStatus
    );
  }

  if (!code) {
    destroyEntry();
    throw makeApiError("WhatsApp returned an empty code. Please try again.", 502);
  }

  entry.pairingCode = code;
  entry.pairingCodeExpiresAt = expiresAt;

  const masked = maskPhone(phoneNumber);
  try {
    await db
      .insert(whatsappSessionsTable)
      .values({
        userId,
        phoneNumber: encrypt(phoneNumber),
        maskedPhone: masked,
        status: "pending_pairing",
        pairingCode: code,
        pairingCodeExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: whatsappSessionsTable.userId,
        set: {
          phoneNumber: encrypt(phoneNumber),
          maskedPhone: masked,
          status: "pending_pairing",
          pairingCode: code,
          pairingCodeExpiresAt: expiresAt,
          sessionData: null,
          updatedAt: new Date(),
        },
      });
  } catch (dbErr) {
    logger.error({ dbErr }, "Failed to save pairing code to DB");
  }

  // --- Phase 2: Background listener — wait for pairing completion ---
  // Keep the socket alive in activeSockets. When the user enters the code,
  // WhatsApp sends pair-success, Baileys emits isNewLogin then closes the
  // connection. We persist the connected state to the DB here.
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, isNewLogin } = update;

    if (isNewLogin) {
      // pair-success received — mark accepted immediately (sync, before any await)
      entry.connectionAccepted = true;
      logger.info({ userId }, "WhatsApp pairing accepted (isNewLogin)");
      try {
        // Give saveCreds a tick to flush creds.json
        await new Promise((r) => setTimeout(r, 200));
        const credsData = fs.readFileSync(path.join(sessionDir, "creds.json"), "utf8");
        await db
          .update(whatsappSessionsTable)
          .set({
            status: "connected",
            connectedAt: new Date(),
            lastActiveAt: new Date(),
            sessionData: encrypt(credsData),
            updatedAt: new Date(),
          })
          .where(eq(whatsappSessionsTable.userId, userId));
        logger.info({ userId }, "WhatsApp session saved as connected");
      } catch (e) {
        logger.error({ e }, "Failed to save WhatsApp session after pairing");
      }
    }

    if (connection === "open") {
      // Socket reconnected after pair-success restart
      entry.connectionAccepted = true;
      if (!entry.connectionAccepted) {
        try {
          const credsData = JSON.stringify(state.creds);
          await db
            .update(whatsappSessionsTable)
            .set({
              status: "connected",
              connectedAt: new Date(),
              lastActiveAt: new Date(),
              sessionData: encrypt(credsData),
              updatedAt: new Date(),
            })
            .where(eq(whatsappSessionsTable.userId, userId));
        } catch (e) {
          logger.error({ e }, "Failed to save WhatsApp session after reconnect");
        }
      }
    }

    if (connection === "close") {
      const boomStatus = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = boomStatus === DisconnectReason.loggedOut;
      sock.ev.removeAllListeners("connection.update");
      if (loggedOut || !entry.connectionAccepted) {
        activeSockets.delete(userId);
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
        if (loggedOut) {
          await db
            .update(whatsappSessionsTable)
            .set({ status: "disconnected", updatedAt: new Date() })
            .where(eq(whatsappSessionsTable.userId, userId));
        }
      }
    }
  });

  return { pairingCode: code, expiresAt: expiresAt.toISOString() };
}

export async function getConnectionStatus(userId: number): Promise<{
  status: ConnectionStatus;
  phoneNumber?: string;
  connectedAt?: string;
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
}> {
  const rows = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);
  if (rows.length === 0) return { status: "not_connected" };

  const row = rows[0];
  const entry = activeSockets.get(userId);

  if (
    row.status === "pending_pairing" &&
    row.pairingCodeExpiresAt &&
    new Date() > row.pairingCodeExpiresAt
  ) {
    return {
      status: "pending_pairing",
      pairingCode: row.pairingCode ?? undefined,
      pairingCodeExpiresAt: row.pairingCodeExpiresAt?.toISOString(),
    };
  }

  return {
    status: (row.status as ConnectionStatus) ?? "not_connected",
    phoneNumber: row.maskedPhone ?? undefined,
    connectedAt: row.connectedAt?.toISOString(),
    pairingCode:
      row.status === "pending_pairing"
        ? (entry?.pairingCode ?? row.pairingCode ?? undefined)
        : undefined,
    pairingCodeExpiresAt:
      row.status === "pending_pairing"
        ? (entry?.pairingCodeExpiresAt?.toISOString() ??
          row.pairingCodeExpiresAt?.toISOString())
        : undefined,
  };
}

export async function getPairingCodeStatus(userId: number): Promise<{
  accepted: boolean;
  status: "waiting" | "accepted" | "expired" | "error";
}> {
  const entry = activeSockets.get(userId);
  const rows = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  if (rows.length === 0) return { accepted: false, status: "waiting" };

  const row = rows[0];

  if (row.status === "connected") return { accepted: true, status: "accepted" };
  if (entry?.connectionAccepted) return { accepted: true, status: "accepted" };

  if (row.pairingCodeExpiresAt && new Date() > row.pairingCodeExpiresAt) {
    return { accepted: false, status: "expired" };
  }

  return { accepted: false, status: "waiting" };
}

export async function disconnect(userId: number): Promise<void> {
  await destroySocket(userId);
  await db
    .update(whatsappSessionsTable)
    .set({ status: "disconnected", pairingCode: null, sessionData: null, updatedAt: new Date() })
    .where(eq(whatsappSessionsTable.userId, userId));
}

export async function reconnect(
  userId: number
): Promise<{ status: "connected" | "failed" }> {
  const rows = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);
  if (rows.length === 0 || !rows[0].sessionData) return { status: "failed" };

  const row = rows[0];
  const sessionDir = getSessionDir(userId);

  try {
    const credsData = decrypt(row.sessionData!);
    fs.writeFileSync(path.join(sessionDir, "creds.json"), credsData, "utf8");

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state as AuthenticationState,
      printQRInTerminal: false,
      logger: logger.child({ component: "baileys", userId }) as any,
      browser: ["WaTracker Pro", "Chrome", "120.0.0"],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    const entry: SocketEntry = { socket: sock, connectionAccepted: false, sessionDir };
    activeSockets.set(userId, entry);

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        await db
          .update(whatsappSessionsTable)
          .set({ status: "connected", lastActiveAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappSessionsTable.userId, userId));
      }
      if (connection === "close") {
        const loggedOut =
          (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut;
        if (loggedOut) {
          await db
            .update(whatsappSessionsTable)
            .set({ status: "disconnected", updatedAt: new Date() })
            .where(eq(whatsappSessionsTable.userId, userId));
          activeSockets.delete(userId);
        }
      }
    });

    await db
      .update(whatsappSessionsTable)
      .set({ status: "connected", updatedAt: new Date() })
      .where(eq(whatsappSessionsTable.userId, userId));
    return { status: "connected" };
  } catch (e) {
    logger.error({ e }, "Failed to reconnect WhatsApp session");
    return { status: "failed" };
  }
}
