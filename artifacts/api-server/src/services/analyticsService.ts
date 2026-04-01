import { db } from "@workspace/db";
import { activitySessionsTable, contactsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export async function getDailySummary(
  userId: number,
  contactId: number,
  date: Date
): Promise<{
  totalOnlineMinutes: number;
  sessionCount: number;
  firstOnline: string | null;
  lastOffline: string | null;
  longestSessionMinutes: number;
}> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const sessions = await db
    .select()
    .from(activitySessionsTable)
    .where(
      and(
        eq(activitySessionsTable.contactId, contactId),
        gte(activitySessionsTable.startTime, dayStart),
        lte(activitySessionsTable.startTime, dayEnd)
      )
    );

  if (!sessions.length) {
    return { totalOnlineMinutes: 0, sessionCount: 0, firstOnline: null, lastOffline: null, longestSessionMinutes: 0 };
  }

  const totalOnlineMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const longestSessionMinutes = Math.max(...sessions.map((s) => s.durationMinutes));
  const sorted = [...sessions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const firstOnline = sorted[0]?.startTime.toISOString() ?? null;
  const lastSession = sorted[sorted.length - 1];
  const lastOffline = lastSession?.endTime?.toISOString() ?? null;

  return { totalOnlineMinutes, sessionCount: sessions.length, firstOnline, lastOffline, longestSessionMinutes };
}

export async function getHourlyHeatmap(
  userId: number,
  contactId: number,
  startDate: Date,
  endDate: Date
): Promise<Array<{ hour: number; totalMinutesOnline: number; sessionCount: number }>> {
  const sessions = await db
    .select()
    .from(activitySessionsTable)
    .where(
      and(
        eq(activitySessionsTable.contactId, contactId),
        gte(activitySessionsTable.startTime, startDate),
        lte(activitySessionsTable.startTime, endDate)
      )
    );

  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    totalMinutesOnline: 0,
    sessionCount: 0,
  }));

  for (const session of sessions) {
    const hour = session.startTime.getHours();
    buckets[hour]!.totalMinutesOnline += session.durationMinutes;
    buckets[hour]!.sessionCount += 1;
  }

  return buckets;
}

export async function getWeeklyReport(
  userId: number,
  contactId: number
): Promise<{
  days: Array<{ date: string; totalMinutes: number; sessionCount: number }>;
  totalMinutes: number;
  avgDailyMinutes: number;
  peakDay: string | null;
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const sessions = await db
    .select()
    .from(activitySessionsTable)
    .where(
      and(
        eq(activitySessionsTable.contactId, contactId),
        gte(activitySessionsTable.startTime, sevenDaysAgo)
      )
    );

  const dayMap: Record<string, { totalMinutes: number; sessionCount: number }> = {};

  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0]!;
    dayMap[key] = { totalMinutes: 0, sessionCount: 0 };
  }

  for (const session of sessions) {
    const key = session.startTime.toISOString().split("T")[0]!;
    if (!dayMap[key]) dayMap[key] = { totalMinutes: 0, sessionCount: 0 };
    dayMap[key]!.totalMinutes += session.durationMinutes;
    dayMap[key]!.sessionCount += 1;
  }

  const days = Object.entries(dayMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));
  const totalMinutes = days.reduce((sum, d) => sum + d.totalMinutes, 0);
  const avgDailyMinutes = Math.round(totalMinutes / 7);
  const peakDay = days.reduce((best, d) => (!best || d.totalMinutes > best.totalMinutes ? d : best), days[0] ?? null)?.date ?? null;

  return { days, totalMinutes, avgDailyMinutes, peakDay };
}

export async function getFamilySummary(userId: number): Promise<{
  contacts: Array<{ contactId: number; name: string; todayMinutes: number; isOnline: boolean }>;
  totalOnlineMinutes: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.userId, userId));

  const result = await Promise.all(
    contacts.map(async (c) => {
      const summary = await getDailySummary(userId, c.id, new Date());
      return {
        contactId: c.id,
        name: c.name,
        todayMinutes: summary.totalOnlineMinutes,
        isOnline: c.isOnline,
      };
    })
  );

  const totalOnlineMinutes = result.reduce((sum, c) => sum + c.todayMinutes, 0);

  return { contacts: result, totalOnlineMinutes };
}
