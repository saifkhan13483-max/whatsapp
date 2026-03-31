import { Router } from "express";
import { db } from "@workspace/db";
import { contactsTable, activitySessionsTable } from "@workspace/db/schema";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/family-summary", async (req: AuthRequest, res) => {
  try {
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.userId, req.userId!));

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const members = await Promise.all(
      contacts.map(async (c) => {
        const todaySessions = await db
          .select()
          .from(activitySessionsTable)
          .where(
            and(
              eq(activitySessionsTable.contactId, c.id),
              gte(activitySessionsTable.startTime, dayStart)
            )
          );
        const minutesToday = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        return {
          id: c.id,
          name: c.name,
          phoneNumber: c.phoneNumber,
          isOnline: c.isOnline,
          lastSeen: c.lastSeen,
          minutesToday,
          sessionsToday: todaySessions.length,
        };
      })
    );

    const onlineNow = members.filter((m) => m.isOnline).length;
    const totalMinutesToday = members.reduce((sum, m) => sum + m.minutesToday, 0);

    res.json({
      totalContacts: contacts.length,
      onlineNow,
      totalMinutesToday,
      alerts: 0,
      members,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch family summary" });
  }
});

router.get("/comparisons", async (req: AuthRequest, res) => {
  try {
    const contactIdsParam = req.query["contactIds"] as string;
    if (!contactIdsParam) {
      res.json([]);
      return;
    }
    const ids = contactIdsParam.split(",").map(Number).filter(Boolean);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.userId, req.userId!), inArray(contactsTable.id, ids)));

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const result = await Promise.all(
      contacts.map(async (c) => {
        const sessions = await db
          .select()
          .from(activitySessionsTable)
          .where(
            and(
              eq(activitySessionsTable.contactId, c.id),
              gte(activitySessionsTable.startTime, weekStart)
            )
          );
        const totalOnlineMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
        const sessionsCount = sessions.length;
        const avgSessionDuration = sessionsCount > 0 ? Math.round(totalOnlineMinutes / sessionsCount) : 0;
        const hourCounts: Record<number, number> = {};
        sessions.forEach((s) => {
          const h = new Date(s.startTime).getHours();
          hourCounts[h] = (hourCounts[h] ?? 0) + 1;
        });
        const peakHour = Number(
          Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
        );
        const weeklyData = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now);
          d.setDate(d.getDate() - (6 - i));
          d.setHours(0, 0, 0, 0);
          const next = new Date(d);
          next.setDate(next.getDate() + 1);
          return sessions
            .filter((s) => s.startTime >= d && s.startTime < next)
            .reduce((sum, s) => sum + s.durationMinutes, 0);
        });

        return {
          contactId: c.id,
          name: c.name,
          phoneNumber: c.phoneNumber,
          totalOnlineMinutes,
          sessionsCount,
          avgSessionDuration,
          peakHour,
          weeklyData,
        };
      })
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch comparisons" });
  }
});

router.get("/timeline", async (req: AuthRequest, res) => {
  try {
    const dateParam = req.query["date"] as string;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.userId, req.userId!));

    const result = await Promise.all(
      contacts.map(async (c) => {
        const sessions = await db
          .select()
          .from(activitySessionsTable)
          .where(
            and(
              eq(activitySessionsTable.contactId, c.id),
              gte(activitySessionsTable.startTime, dayStart)
            )
          );
        const events: { time: string; status: "online" | "offline" }[] = [];
        sessions.forEach((s) => {
          events.push({ time: s.startTime.toISOString(), status: "online" });
          if (s.endTime) events.push({ time: s.endTime.toISOString(), status: "offline" });
        });
        return { contactId: c.id, name: c.name, events };
      })
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch timeline" });
  }
});

export default router;
