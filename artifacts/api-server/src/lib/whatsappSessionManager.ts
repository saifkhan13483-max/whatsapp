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

  // ROOT CAUSE 2: Strip ALL non-digit characters — Baileys requires pure digits only
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 7) {
    throw makeApiError("Invalid phone number. Please include your country code.", 400);
  }

  // Destroy any in-memory socket for this user first
  await destroySocket(userId);

  if (existingSession.length > 0) {
    await db
      .update(whatsappSessionsTable)
      .set({ sessionData: null, status: "pending_pairing", updatedAt: new Date() })
      .where(eq(whatsappSessionsTable.userId, userId));
  }

  // CRITICAL FIX: Always wipe and recreate the session directory unconditionally.
  // destroySocket() only cleans up files when an entry exists in activeSockets
  // (the in-memory map). After a server restart, activeSockets is empty even
  // though stale creds.json files remain in /tmp. Those stale creds contain
  // `me.id` from a previous failed attempt, which makes Baileys do a passive
  // (reconnection) login instead of a fresh pairing — WhatsApp rejects that
  // with a 401. Wiping the dir here guarantees a truly fresh auth state every
  // single time, regardless of restarts or prior failures.
  const sessionDir = path.join(os.tmpdir(), `wa_session_${userId}`);
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch {}
  fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  // Fetch latest supported Baileys version from WhatsApp servers
  const { version } = await fetchLatestBaileysVersion();

  // ROOT CAUSE 3: printQRInTerminal MUST be false when using pairing code method
  const sock = makeWASocket({
    version,
    auth: state as AuthenticationState,
    printQRInTerminal: false,
    logger: logger.child({ component: "baileys", userId }) as any,
    browser: ["WaTracker Pro", "Chrome", "120.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
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

  // ROOT CAUSE 1 FIX: Wrap the entire flow in a Promise.
  // requestPairingCode() is called INSIDE the connection.update listener,
  // only after connection === 'connecting' OR !!qr — never immediately.
  return new Promise((resolve, reject) => {
    let codeRequested = false;
    let codeObtained = false;

    const timeout = setTimeout(() => {
      if (!codeObtained) {
        cleanup(true);
        reject(
          makeApiError(
            "Could not reach WhatsApp. Please check your internet connection and try again.",
            408
          )
        );
      }
    }, PAIRING_REQUEST_TIMEOUT_MS);

    function cleanup(shouldDestroySocket = false) {
      clearTimeout(timeout);
      sock.ev.removeAllListeners("connection.update");
      if (shouldDestroySocket) {
        // End the socket and remove from map so the next attempt starts fresh.
        // This also prevents any pending saveCreds from writing more stale data.
        try { sock.end(undefined); } catch {}
        activeSockets.delete(userId);
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch {}
      }
    }

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;

      if (isNewLogin) {
        entry.connectionAccepted = true;
      }

      // Only call requestPairingCode when WhatsApp has sent the pair-device IQ
      // (!!qr). This fires AFTER the WebSocket is open and the noise handshake
      // is complete — the only safe moment. "connecting" fires via
      // process.nextTick() before the WebSocket even opens, causing a 428.
      if (!!qr && !codeRequested) {
        codeRequested = true;

        try {
          const code = await sock.requestPairingCode(cleanPhone);

          if (!code) {
            cleanup(true);
            reject(makeApiError("WhatsApp returned an empty code. Please try again.", 502));
            return;
          }

          codeObtained = true;
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

          cleanup();
          resolve({ pairingCode: code, expiresAt: expiresAt.toISOString() });
        } catch (err: any) {
          if (!codeObtained) {
            cleanup(true);
            const msg: string = err?.message ?? "WhatsApp server error";
            const lowerMsg = msg.toLowerCase();
            const boomStatus = (err as Boom)?.output?.statusCode;

            if (
              lowerMsg.includes("not registered") ||
              lowerMsg.includes("does not exist") ||
              lowerMsg.includes("invalid phone")
            ) {
              reject(
                makeApiError(
                  "This phone number doesn't appear to be registered on WhatsApp.",
                  400
                )
              );
            } else if (boomStatus === 428 || lowerMsg.includes("428")) {
              reject(
                makeApiError(
                  "Connection was not ready. Please wait a moment and try again.",
                  428
                )
              );
            } else if (boomStatus === 401 || lowerMsg.includes("401")) {
              reject(
                makeApiError("WhatsApp rejected the connection. Please try again.", 401)
              );
            } else {
              reject(makeApiError("Could not connect to WhatsApp. Please try again.", 500));
            }
          }
        }
      }

      // Handle pairing accepted — socket becomes open
      if (connection === "open") {
        entry.connectionAccepted = true;
        try {
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
        } catch (e) {
          logger.error({ e }, "Failed to save WhatsApp session after open");
        }
      }

      // ROOT CAUSE 6 FIX: If the connection closes before we got a code, reject.
      if (connection === "close" && !codeObtained) {
        const boomStatusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = boomStatusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          await db
            .update(whatsappSessionsTable)
            .set({ status: "disconnected", updatedAt: new Date() })
            .where(eq(whatsappSessionsTable.userId, userId));
          activeSockets.delete(userId);
        }

        if (!codeRequested) {
          cleanup(true);
          const httpStatus = boomStatusCode === 401 ? 401 : 500;
          reject(
            makeApiError("Could not connect to WhatsApp. Please try again.", httpStatus)
          );
        }
      }
    });
  });
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
