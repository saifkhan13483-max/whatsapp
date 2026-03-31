import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
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

export async function requestPairingCode(userId: number, phoneNumber: string): Promise<{ pairingCode: string; expiresAt: string }> {
  if (!checkRateLimit(userId)) {
    const err = new Error("Too many attempts. Please wait 10 minutes and try again.");
    (err as any).statusCode = 429;
    throw err;
  }

  const existingSession = await db.select().from(whatsappSessionsTable).where(eq(whatsappSessionsTable.userId, userId)).limit(1);
  if (existingSession.length > 0 && existingSession[0].status === "connected") {
    const err = new Error("WhatsApp is already linked for this account.");
    (err as any).statusCode = 409;
    throw err;
  }

  await destroySocket(userId);

  const sessionDir = getSessionDir(userId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state as AuthenticationState,
    printQRInTerminal: false,
    logger: logger.child({ component: "baileys", userId }) as any,
    browser: ["WaTracker Pro", "Chrome", "1.0.0"],
  });

  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
  const entry: SocketEntry = {
    socket: sock,
    pairingCodeExpiresAt: expiresAt,
    connectionAccepted: false,
    sessionDir,
  };
  activeSockets.set(userId, entry);

  const cleanPhone = phoneNumber.replace(/\D/g, "");

  return new Promise(async (resolve, reject) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Could not reach WhatsApp. Please check your internet connection."));
      }
    }, 30_000);

    try {
      await new Promise<void>((r) => setTimeout(r, 1500));
      const code = await sock.requestPairingCode(cleanPhone);
      clearTimeout(timeout);
      resolved = true;

      entry.pairingCode = code;
      entry.pairingCodeExpiresAt = expiresAt;

      const masked = maskPhone(phoneNumber);

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
            updatedAt: new Date(),
          },
        });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, isNewLogin } = update;

        if (isNewLogin) {
          entry.connectionAccepted = true;
        }

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
            logger.error({ e }, "Failed to save WhatsApp session");
          }
        }

        if (connection === "close") {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          if (!shouldReconnect) {
            await db
              .update(whatsappSessionsTable)
              .set({ status: "disconnected", updatedAt: new Date() })
              .where(eq(whatsappSessionsTable.userId, userId));
            activeSockets.delete(userId);
          }
        }
      });

      resolve({ pairingCode: code, expiresAt: expiresAt.toISOString() });
    } catch (e: any) {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        const msg = e?.message ?? "WhatsApp server error";
        if (msg.includes("phone")) {
          const err = new Error("This phone number doesn't appear to be registered on WhatsApp.");
          (err as any).statusCode = 400;
          reject(err);
        } else {
          reject(new Error("Could not reach WhatsApp. Please check your internet connection."));
        }
      }
    }
  });
}

export async function getConnectionStatus(userId: number): Promise<{
  status: ConnectionStatus;
  phoneNumber?: string;
  connectedAt?: string;
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
}> {
  const rows = await db.select().from(whatsappSessionsTable).where(eq(whatsappSessionsTable.userId, userId)).limit(1);
  if (rows.length === 0) return { status: "not_connected" };

  const row = rows[0];
  const entry = activeSockets.get(userId);

  if (row.status === "pending_pairing" && row.pairingCodeExpiresAt && new Date() > row.pairingCodeExpiresAt) {
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
    pairingCode: row.status === "pending_pairing" ? (entry?.pairingCode ?? row.pairingCode ?? undefined) : undefined,
    pairingCodeExpiresAt: row.status === "pending_pairing" ? (entry?.pairingCodeExpiresAt?.toISOString() ?? row.pairingCodeExpiresAt?.toISOString()) : undefined,
  };
}

export async function getPairingCodeStatus(userId: number): Promise<{
  accepted: boolean;
  status: "waiting" | "accepted" | "expired" | "error";
}> {
  const entry = activeSockets.get(userId);
  const rows = await db.select().from(whatsappSessionsTable).where(eq(whatsappSessionsTable.userId, userId)).limit(1);

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

export async function reconnect(userId: number): Promise<{ status: "connected" | "failed" }> {
  const rows = await db.select().from(whatsappSessionsTable).where(eq(whatsappSessionsTable.userId, userId)).limit(1);
  if (rows.length === 0 || !rows[0].sessionData) return { status: "failed" };

  const row = rows[0];
  const sessionDir = getSessionDir(userId);

  try {
    const credsData = decrypt(row.sessionData);
    fs.writeFileSync(path.join(sessionDir, "creds.json"), credsData, "utf8");

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const sock = makeWASocket({
      auth: state as AuthenticationState,
      printQRInTerminal: false,
      logger: logger.child({ component: "baileys", userId }) as any,
      browser: ["WaTracker Pro", "Chrome", "1.0.0"],
    });

    const entry: SocketEntry = { socket: sock, connectionAccepted: false, sessionDir };
    activeSockets.set(userId, entry);

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        await db.update(whatsappSessionsTable).set({ status: "connected", lastActiveAt: new Date(), updatedAt: new Date() }).where(eq(whatsappSessionsTable.userId, userId));
      }
      if (connection === "close") {
        const loggedOut = (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut;
        if (loggedOut) {
          await db.update(whatsappSessionsTable).set({ status: "disconnected", updatedAt: new Date() }).where(eq(whatsappSessionsTable.userId, userId));
          activeSockets.delete(userId);
        }
      }
    });

    await db.update(whatsappSessionsTable).set({ status: "connected", updatedAt: new Date() }).where(eq(whatsappSessionsTable.userId, userId));
    return { status: "connected" };
  } catch (e) {
    logger.error({ e }, "Failed to reconnect WhatsApp session");
    return { status: "failed" };
  }
}
