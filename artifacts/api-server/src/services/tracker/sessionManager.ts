import type { Page } from "puppeteer-core";
import { db } from "@workspace/db";
import { trackerSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getBrowser, getOrCreatePage, closeBrowser } from "./browserManager.js";
import { logger } from "../../lib/logger.js";

const WA_URL = "https://web.whatsapp.com";
const SESSION_TIMEOUT_MS = 60_000;

export type SessionStatus =
  | "disconnected"
  | "qr_ready"
  | "loading"
  | "connected"
  | "error";

export interface SessionInfo {
  status: SessionStatus;
  qrCodeBase64: string | null;
  connectedAt: Date | null;
}

const sessionPages = new Map<number, Page>();

export async function getSessionPage(userId: number): Promise<Page | null> {
  return sessionPages.get(userId) ?? null;
}

async function saveSession(userId: number, page: Page): Promise<void> {
  try {
    const cookies = await page.cookies();
    const ls = await page.evaluate(() => {
      const result: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) result[key] = localStorage.getItem(key) ?? "";
      }
      return result;
    });

    await db
      .update(trackerSessionsTable)
      .set({
        cookiesJson: JSON.stringify(cookies),
        localStorageJson: JSON.stringify(ls),
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trackerSessionsTable.userId, userId));
  } catch (err) {
    logger.warn({ err, userId }, "Failed to save session data");
  }
}

async function restoreSession(userId: number, page: Page): Promise<boolean> {
  try {
    const [row] = await db
      .select()
      .from(trackerSessionsTable)
      .where(eq(trackerSessionsTable.userId, userId))
      .limit(1);

    if (!row?.cookiesJson || !row?.localStorageJson) return false;

    const cookies = JSON.parse(row.cookiesJson);
    await page.setCookie(...cookies);

    await page.evaluateOnNewDocument((ls: Record<string, string>) => {
      for (const [k, v] of Object.entries(ls)) {
        localStorage.setItem(k, v);
      }
    }, JSON.parse(row.localStorageJson));

    logger.info({ userId }, "Session data restored from DB");
    return true;
  } catch (err) {
    logger.warn({ err, userId }, "Failed to restore session data");
    return false;
  }
}

async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('[data-testid="chat-list"], [data-icon="default-user"]', {
      timeout: 8000,
    });
    const qr = await page.$('[data-ref]');
    return !qr;
  } catch {
    return false;
  }
}

async function captureQrCode(page: Page): Promise<string | null> {
  try {
    const canvas = await page.$("canvas");
    if (!canvas) return null;
    const img = await canvas.screenshot({ encoding: "base64" });
    return `data:image/png;base64,${img}`;
  } catch {
    return null;
  }
}

async function upsertSession(userId: number, status: SessionStatus): Promise<void> {
  const existing = await db
    .select({ id: trackerSessionsTable.id })
    .from(trackerSessionsTable)
    .where(eq(trackerSessionsTable.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(trackerSessionsTable).values({
      userId,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(trackerSessionsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(trackerSessionsTable.userId, userId));
  }
}

export async function startSession(userId: number): Promise<SessionInfo> {
  logger.info({ userId }, "Starting WhatsApp Web session");
  const sessionKey = `user-${userId}`;

  await upsertSession(userId, "loading");

  const browser = await getBrowser(sessionKey);
  const page = await getOrCreatePage(sessionKey, "whatsapp-main");

  const hasSession = await restoreSession(userId, page);

  await page.goto(WA_URL, { waitUntil: "networkidle2", timeout: SESSION_TIMEOUT_MS });

  if (await isLoggedIn(page)) {
    sessionPages.set(userId, page);
    const now = new Date();
    await db
      .update(trackerSessionsTable)
      .set({ status: "connected", connectedAt: now, updatedAt: new Date() })
      .where(eq(trackerSessionsTable.userId, userId));

    await saveSession(userId, page);
    logger.info({ userId }, "WhatsApp session connected");
    return { status: "connected", qrCodeBase64: null, connectedAt: now };
  }

  try {
    await page.waitForSelector("canvas", { timeout: 20000 });
    const qr = await captureQrCode(page);

    await db
      .update(trackerSessionsTable)
      .set({
        status: "qr_ready",
        qrCodeBase64: qr,
        updatedAt: new Date(),
      })
      .where(eq(trackerSessionsTable.userId, userId));

    sessionPages.set(userId, page);

    page
      .waitForSelector('[data-testid="chat-list"]', { timeout: 120000 })
      .then(async () => {
        const now = new Date();
        await db
          .update(trackerSessionsTable)
          .set({ status: "connected", connectedAt: now, qrCodeBase64: null, updatedAt: new Date() })
          .where(eq(trackerSessionsTable.userId, userId));
        await saveSession(userId, page);
        logger.info({ userId }, "QR scanned — session connected");
      })
      .catch(() => {
        logger.warn({ userId }, "QR scan timed out");
      });

    return { status: "qr_ready", qrCodeBase64: qr, connectedAt: null };
  } catch {
    await upsertSession(userId, "error");
    return { status: "error", qrCodeBase64: null, connectedAt: null };
  }
}

export async function getSessionStatus(userId: number): Promise<SessionInfo> {
  const [row] = await db
    .select()
    .from(trackerSessionsTable)
    .where(eq(trackerSessionsTable.userId, userId))
    .limit(1);

  if (!row) {
    return { status: "disconnected", qrCodeBase64: null, connectedAt: null };
  }

  return {
    status: row.status as SessionStatus,
    qrCodeBase64: row.qrCodeBase64 ?? null,
    connectedAt: row.connectedAt ?? null,
  };
}

export async function disconnectSession(userId: number): Promise<void> {
  sessionPages.delete(userId);
  await closeBrowser(`user-${userId}`);
  await db
    .update(trackerSessionsTable)
    .set({
      status: "disconnected",
      qrCodeBase64: null,
      cookiesJson: null,
      localStorageJson: null,
      updatedAt: new Date(),
    })
    .where(eq(trackerSessionsTable.userId, userId));
  logger.info({ userId }, "Session disconnected and cleared");
}
