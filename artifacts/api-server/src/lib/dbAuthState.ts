import {
  type AuthenticationCreds,
  type SignalDataTypeMap,
  type SignalKeyStore,
  initAuthCreds,
  BufferJSON,
} from "@whiskeysockets/baileys";
import { db } from "@workspace/db";
import { whatsappSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "./logger.js";

const ENCRYPTION_KEY_HEX = process.env["WHATSAPP_ENCRYPTION_KEY"];
if (!ENCRYPTION_KEY_HEX) {
  throw new Error(
    "WHATSAPP_ENCRYPTION_KEY is not set. Generate a 32-byte hex key and set it as an environment variable."
  );
}
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error("WHATSAPP_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars).");
}

interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

function encryptGCM(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

function decryptGCM(payload: EncryptedPayload): string {
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function isLegacyCBC(raw: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]+$/i.test(raw);
}

function decryptLegacyCBC(text: string): string {
  const JWT_SECRET = process.env["JWT_SECRET"] ?? "default-secret-change-me";
  const [ivHex, encHex] = text.split(":");
  const key = crypto.scryptSync(JWT_SECRET, "salt", 32);
  const iv = Buffer.from(ivHex!, "hex");
  const enc = Buffer.from(encHex!, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export interface DbAuthState {
  state: {
    creds: AuthenticationCreds;
    keys: SignalKeyStore;
  };
  saveCreds: () => Promise<void>;
}

interface PersistedAuthData {
  creds: ReturnType<typeof JSON.parse>;
  keys: Record<string, Record<string, unknown>>;
}

export async function useDbAuthState(userId: number): Promise<DbAuthState> {
  const rows = await db
    .select({ sessionData: whatsappSessionsTable.sessionData })
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.userId, userId))
    .limit(1);

  let creds: AuthenticationCreds;
  let keyStore: Record<string, Record<string, unknown>> = {};

  if (rows.length > 0 && rows[0].sessionData) {
    try {
      const raw = rows[0].sessionData;
      let plaintext: string;

      if (isLegacyCBC(raw)) {
        logger.warn({ userId }, "Migrating session from legacy AES-CBC to AES-GCM");
        plaintext = decryptLegacyCBC(raw);
      } else {
        const payload: EncryptedPayload = JSON.parse(raw);
        plaintext = decryptGCM(payload);
      }

      const parsed: PersistedAuthData = JSON.parse(plaintext, BufferJSON.reviver);
      creds = parsed.creds as AuthenticationCreds;
      keyStore = parsed.keys ?? {};
      logger.debug({ userId }, "Restored Baileys auth state from DB");
    } catch (err) {
      logger.warn({ err, userId }, "Failed to parse DB auth state — starting fresh");
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  async function saveState(): Promise<void> {
    try {
      const data: PersistedAuthData = { creds, keys: keyStore };
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      const payload = encryptGCM(serialized);
      const encryptedJson = JSON.stringify(payload);

      await db
        .update(whatsappSessionsTable)
        .set({
          sessionData: encryptedJson,
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappSessionsTable.userId, userId));
    } catch (err) {
      logger.error({ err, userId }, "Failed to persist Baileys auth state to DB");
    }
  }

  const keys: SignalKeyStore = {
    get<T extends keyof SignalDataTypeMap>(
      type: T,
      ids: string[]
    ): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
      const typeMap = keyStore[type] ?? {};
      const result: Record<string, unknown> = {};
      for (const id of ids) {
        const val = typeMap[id];
        if (val !== undefined) result[id] = val;
      }
      return Promise.resolve(result as { [id: string]: SignalDataTypeMap[T] });
    },

    set(data: {
      [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null };
    }): Promise<void> {
      for (const [type, entries] of Object.entries(data)) {
        if (!keyStore[type]) keyStore[type] = {};
        for (const [id, value] of Object.entries(entries as Record<string, unknown>)) {
          if (value == null) {
            delete keyStore[type]![id];
          } else {
            keyStore[type]![id] = value;
          }
        }
      }
      return saveState();
    },
  };

  return {
    state: { creds, keys },
    saveCreds: saveState,
  };
}
