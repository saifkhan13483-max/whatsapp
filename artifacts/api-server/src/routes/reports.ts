import { Router } from "express";
import { db } from "@workspace/db";
import { activitySessionsTable, contactsTable } from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { format } from "date-fns";
import {
  getHourlyHeatmap,
  getDailySummary,
  getWeeklyReport,
} from "../services/analyticsService.js";

const router = Router();
router.use(requireAuth);

router.get("/heatmap/:contactId", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["contactId"]);
    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, req.userId!)))
      .limit(1);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const from = req.query["from"] ? new Date(req.query["from"] as string) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = req.query["to"] ? new Date(req.query["to"] as string) : new Date();
    const heatmap = await getHourlyHeatmap(req.userId!, contactId, from, to);
    res.json({ contactId, contactName: contact.name, from: from.toISOString(), to: to.toISOString(), heatmap });
  } catch {
    res.status(500).json({ error: "Failed to generate heatmap" });
  }
});

router.get("/daily/:contactId", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["contactId"]);
    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, req.userId!)))
      .limit(1);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const date = req.query["date"] ? new Date(req.query["date"] as string) : new Date();
    const summary = await getDailySummary(req.userId!, contactId, date);
    res.json({ contactId, contactName: contact.name, date: date.toISOString().split("T")[0], ...summary });
  } catch {
    res.status(500).json({ error: "Failed to generate daily report" });
  }
});

router.get("/weekly/:contactId", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["contactId"]);
    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, req.userId!)))
      .limit(1);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const report = await getWeeklyReport(req.userId!, contactId);
    res.json({ contactId, contactName: contact.name, ...report });
  } catch {
    res.status(500).json({ error: "Failed to generate weekly report" });
  }
});

router.get("/:contactId", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["contactId"]);
    const range = (req.query["range"] as string) ?? "week";
    const now = new Date();
    let fromDate = new Date(now);
    if (range === "today") fromDate.setHours(0, 0, 0, 0);
    else if (range === "week") fromDate.setDate(fromDate.getDate() - 7);
    else if (range === "month") fromDate.setMonth(fromDate.getMonth() - 1);

    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, req.userId!)))
      .limit(1);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const sessions = await db
      .select()
      .from(activitySessionsTable)
      .where(
        and(
          eq(activitySessionsTable.contactId, contactId),
          gte(activitySessionsTable.startTime, fromDate)
        )
      );

    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);

    const hourCounts: Record<number, number> = {};
    sessions.forEach((s) => {
      const h = new Date(s.startTime).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

    const dayMap: Record<string, { date: string; minutes: number; sessions: number }> = {};
    sessions.forEach((s) => {
      const d = new Date(s.startTime).toISOString().split("T")[0]!;
      if (!dayMap[d]) dayMap[d] = { date: d, minutes: 0, sessions: 0 };
      dayMap[d].minutes += s.durationMinutes;
      dayMap[d].sessions += 1;
    });

    const hourlyHeatmap = new Array(7 * 24).fill(0);
    sessions.forEach((s) => {
      const start = new Date(s.startTime);
      const dayOfWeek = start.getDay();
      const hour = start.getHours();
      hourlyHeatmap[dayOfWeek * 24 + hour] += s.durationMinutes;
    });

    const sessionRows = sessions.map((s) => ({
      id: s.id,
      date: format(new Date(s.startTime), "MMM d, yyyy"),
      startTime: format(new Date(s.startTime), "HH:mm"),
      endTime: s.endTime ? format(new Date(s.endTime), "HH:mm") : "—",
      durationMinutes: s.durationMinutes,
    }));

    res.json({
      contactId,
      contactName: contact.name,
      range,
      totalSessions,
      totalMinutes,
      peakHour: Number(peakHour),
      dailyBreakdown: Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)),
      hourlyHeatmap,
      sessions: sessionRows,
    });
  } catch {
    res.status(500).json({ error: "Failed to generate report" });
  }
});

router.get("/:contactId/export", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["contactId"]);
    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, req.userId!)))
      .limit(1);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const sessions = await db
      .select()
      .from(activitySessionsTable)
      .where(eq(activitySessionsTable.contactId, contactId));

    const csv = [
      "id,contactId,contactName,startTime,endTime,durationMinutes",
      ...sessions.map((s) =>
        [
          s.id,
          s.contactId,
          JSON.stringify(contact.name),
          s.startTime?.toISOString() ?? "",
          s.endTime?.toISOString() ?? "",
          s.durationMinutes,
        ].join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${contactId}-${Date.now()}.csv"`
    );
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to export report" });
  }
});

export default router;
