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
      const raw = decrypt(rows[0].sessionData);
      const parsed: PersistedAuthData = JSON.parse(raw, BufferJSON.reviver);
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
      const encrypted = encrypt(serialized);

      await db
        .update(whatsappSessionsTable)
        .set({ sessionData: encrypted, lastActiveAt: new Date(), updatedAt: new Date() })
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

    set(data: { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } }): Promise<void> {
      for (const [type, entries] of Object.entries(data)) {
        if (!keyStore[type]) keyStore[type] = {};
        for (const [id, value] of Object.entries(entries as Record<string, unknown>)) {
          if (value == null) {
            delete keyStore[type][id];
          } else {
            keyStore[type][id] = value;
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
