import type { WASocket } from "@whiskeysockets/baileys";
import { db } from "@workspace/db";
import { contactsTable, activitySessionsTable } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { broadcast } from "./websocket/wsServer.js";
import { checkOnlineThresholdAlerts, checkLateNightAlerts } from "./alertEngine.js";

interface PresenceCache {
  status: "online" | "offline" | "unknown";
  onlineSince?: Date;
}

const presenceCache = new Map<string, PresenceCache>();
const resubscribeIntervals = new Map<number, ReturnType<typeof setInterval>>();
const trackedJids = new Map<number, Set<string>>();

function jidFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

export function attachPresenceTracker(userId: number, sock: WASocket): void {
  sock.ev.on("presence.update", async ({ id: jid, presences }) => {
    try {
      const presence = presences[jid];
      if (!presence) return;

      const rawPresence = presence.lastKnownPresence;
      const isOnline =
        rawPresence === "available" ||
        rawPresence === "composing" ||
        rawPresence === "recording";

      const newStatus: "online" | "offline" = isOnline ? "online" : "offline";
      const cacheKey = `${userId}:${jid}`;
      const cached = presenceCache.get(cacheKey);

      if (cached?.status === newStatus) return;

      presenceCache.set(cacheKey, {
        status: newStatus,
        onlineSince: newStatus === "online" ? new Date() : cached?.onlineSince,
      });

      const digits = jid.split("@")[0] ?? "";
      const contacts = await db
        .select()
        .from(contactsTable)
        .where(
          and(
            eq(contactsTable.userId, userId),
            eq(contactsTable.phoneNumber, digits)
          )
        )
        .limit(1);

      if (!contacts.length) return;
      const contact = contacts[0];

      const now = new Date();

      if (newStatus === "online") {
        await db
          .update(contactsTable)
          .set({ isOnline: true })
          .where(eq(contactsTable.id, contact.id));

        await db.insert(activitySessionsTable).values({
          contactId: contact.id,
          startTime: now,
          durationMinutes: 0,
        });
      } else {
        const lastSeen = presence.lastSeen ? new Date(presence.lastSeen * 1000) : now;
        await db
          .update(contactsTable)
          .set({ isOnline: false, lastSeen })
          .where(eq(contactsTable.id, contact.id));

        const openSessions = await db
          .select()
          .from(activitySessionsTable)
          .where(
            and(
              eq(activitySessionsTable.contactId, contact.id),
              isNull(activitySessionsTable.endTime)
            )
          );

        for (const session of openSessions) {
          const durationMinutes = Math.max(
            1,
            Math.round((now.getTime() - session.startTime.getTime()) / 60000)
          );
          await db
            .update(activitySessionsTable)
            .set({ endTime: now, durationMinutes })
            .where(eq(activitySessionsTable.id, session.id));
        }
      }

      broadcast(userId, {
        type: "status_change",
        contactId: contact.id,
        contactName: contact.name,
        status: newStatus,
        timestamp: now.toISOString(),
      });

      if (newStatus === "online") {
        checkLateNightAlerts(userId, contact.id, contact.name).catch(() => {});
      } else {
        checkOnlineThresholdAlerts(userId, contact.id, contact.name).catch(() => {});
      }

      logger.debug({ userId, contactId: contact.id, status: newStatus }, "Presence updated");
    } catch (err) {
      logger.warn({ err, userId, jid }, "Error processing presence update");
    }
  });

  setupResubscribe(userId, sock);
}

async function subscribeToAll(userId: number, sock: WASocket): Promise<void> {
  const jids = trackedJids.get(userId);
  if (!jids || jids.size === 0) {
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.userId, userId));

    const set = new Set<string>();
    for (const c of contacts) {
      const jid = jidFromPhone(c.phoneNumber);
      set.add(jid);
    }
    trackedJids.set(userId, set);
  }

  const jids2 = trackedJids.get(userId);
  if (!jids2) return;

  for (const jid of jids2) {
    try {
      await sock.presenceSubscribe(jid);
    } catch (err) {
      logger.warn({ err, userId, jid }, "presenceSubscribe failed");
    }
  }
}

function setupResubscribe(userId: number, sock: WASocket): void {
  if (resubscribeIntervals.has(userId)) {
    clearInterval(resubscribeIntervals.get(userId)!);
  }

  const interval = setInterval(async () => {
    try {
      await subscribeToAll(userId, sock);
      logger.debug({ userId }, "Presence re-subscribed for all contacts");
    } catch (err) {
      logger.warn({ err, userId }, "Presence re-subscribe error");
    }
  }, 10 * 60 * 1000);

  resubscribeIntervals.set(userId, interval);

  subscribeToAll(userId, sock).catch((err) => {
    logger.warn({ err, userId }, "Initial presence subscribe error");
  });
}

export function stopPresenceTracker(userId: number): void {
  const interval = resubscribeIntervals.get(userId);
  if (interval) {
    clearInterval(interval);
    resubscribeIntervals.delete(userId);
  }
  trackedJids.delete(userId);

  for (const key of [...presenceCache.keys()]) {
    if (key.startsWith(`${userId}:`)) presenceCache.delete(key);
  }
}

export function addTrackedContact(userId: number, phoneNumber: string): void {
  if (!trackedJids.has(userId)) trackedJids.set(userId, new Set());
  trackedJids.get(userId)!.add(jidFromPhone(phoneNumber));
}

export function removeTrackedContact(userId: number, phoneNumber: string): void {
  trackedJids.get(userId)?.delete(jidFromPhone(phoneNumber));
}

export async function subscribeContact(userId: number, phoneNumber: string, sock: WASocket): Promise<void> {
  const jid = jidFromPhone(phoneNumber);
  addTrackedContact(userId, phoneNumber);
  try {
    await sock.presenceSubscribe(jid);
  } catch (err) {
    logger.warn({ err, userId, jid }, "presenceSubscribe failed for new contact");
  }
}

