import { db } from "@workspace/db";
import { alertRulesTable, alertEventsTable, activitySessionsTable, contactsTable, notificationsTable } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { broadcast } from "./websocket/wsServer.js";

export async function checkKeywordAlerts(
  userId: number,
  textContent: string,
  chatJid: string,
  messageId: string
): Promise<void> {
  const rules = await db
    .select()
    .from(alertRulesTable)
    .where(
      and(
        eq(alertRulesTable.userId, userId),
        eq(alertRulesTable.type, "keyword"),
        eq(alertRulesTable.isEnabled, true)
      )
    );

  const lower = textContent.toLowerCase();

  for (const rule of rules) {
    if (!rule.keyword) continue;
    if (!lower.includes(rule.keyword.toLowerCase())) continue;

    const [event] = await db
      .insert(alertEventsTable)
      .values({
        alertId: rule.id,
        contactId: rule.contactId ?? null,
        details: { keyword: rule.keyword, chatJid, messageId, preview: textContent.slice(0, 100) },
      })
      .returning();

    await db.insert(notificationsTable).values({
      userId,
      title: "Keyword Alert",
      body: `Keyword "${rule.keyword}" detected in a message`,
      type: "alert",
    });

    broadcast(userId, {
      type: "alert_triggered",
      alertId: rule.id,
      alertType: "keyword",
      contactName: chatJid.split("@")[0] ?? chatJid,
      details: `Keyword "${rule.keyword}" detected`,
      eventId: event?.id,
      timestamp: new Date().toISOString(),
    });

    logger.info({ userId, keyword: rule.keyword, chatJid }, "Keyword alert triggered");
  }
}

export async function checkOnlineThresholdAlerts(
  userId: number,
  contactId: number,
  contactName: string
): Promise<void> {
  const rules = await db
    .select()
    .from(alertRulesTable)
    .where(
      and(
        eq(alertRulesTable.userId, userId),
        eq(alertRulesTable.type, "online_threshold"),
        eq(alertRulesTable.isEnabled, true),
        sql`(${alertRulesTable.contactId} IS NULL OR ${alertRulesTable.contactId} = ${contactId})`
      )
    );

  if (!rules.length) return;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sessions = await db
    .select()
    .from(activitySessionsTable)
    .where(
      and(
        eq(activitySessionsTable.contactId, contactId),
        gte(activitySessionsTable.startTime, todayStart)
      )
    );

  const totalMinutesToday = sessions.reduce((s, sess) => s + sess.durationMinutes, 0);

  for (const rule of rules) {
    if (!rule.thresholdMinutes) continue;
    if (totalMinutesToday < rule.thresholdMinutes) continue;

    const [event] = await db
      .insert(alertEventsTable)
      .values({
        alertId: rule.id,
        contactId,
        details: { totalMinutesToday, threshold: rule.thresholdMinutes, contactName },
      })
      .returning();

    await db.insert(notificationsTable).values({
      userId,
      title: "Online Time Alert",
      body: `${contactName} has been online for ${totalMinutesToday} minutes today (threshold: ${rule.thresholdMinutes} min)`,
      type: "alert",
    });

    broadcast(userId, {
      type: "alert_triggered",
      alertId: rule.id,
      alertType: "online_threshold",
      contactName,
      details: `Online ${totalMinutesToday} min today (limit: ${rule.thresholdMinutes} min)`,
      eventId: event?.id,
      timestamp: new Date().toISOString(),
    });

    logger.info({ userId, contactId, totalMinutesToday, threshold: rule.thresholdMinutes }, "Online threshold alert triggered");
  }
}

export async function checkLateNightAlerts(
  userId: number,
  contactId: number,
  contactName: string
): Promise<void> {
  const now = new Date();
  const currentHour = now.getHours();

  const rules = await db
    .select()
    .from(alertRulesTable)
    .where(
      and(
        eq(alertRulesTable.userId, userId),
        eq(alertRulesTable.type, "late_night"),
        eq(alertRulesTable.isEnabled, true),
        sql`(${alertRulesTable.contactId} IS NULL OR ${alertRulesTable.contactId} = ${contactId})`
      )
    );

  for (const rule of rules) {
    if (rule.startHour == null || rule.endHour == null) continue;

    const inWindow =
      rule.startHour <= rule.endHour
        ? currentHour >= rule.startHour && currentHour < rule.endHour
        : currentHour >= rule.startHour || currentHour < rule.endHour;

    if (!inWindow) continue;

    const [event] = await db
      .insert(alertEventsTable)
      .values({
        alertId: rule.id,
        contactId,
        details: { currentHour, startHour: rule.startHour, endHour: rule.endHour, contactName },
      })
      .returning();

    await db.insert(notificationsTable).values({
      userId,
      title: "Late Night Alert",
      body: `${contactName} is online during restricted hours (${rule.startHour}:00 - ${rule.endHour}:00)`,
      type: "alert",
    });

    broadcast(userId, {
      type: "alert_triggered",
      alertId: rule.id,
      alertType: "late_night",
      contactName,
      details: `Online during restricted hours (${rule.startHour}:00–${rule.endHour}:00)`,
      eventId: event?.id,
      timestamp: new Date().toISOString(),
    });

    logger.info({ userId, contactId, currentHour, window: `${rule.startHour}-${rule.endHour}` }, "Late night alert triggered");
  }
}
