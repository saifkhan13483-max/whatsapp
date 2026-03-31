import { Router } from "express";
import { db } from "@workspace/db";
import { activitySessionsTable, contactsTable } from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

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
      .where(eq(contactsTable.id, contactId))
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

    res.json({
      contactId,
      contactName: contact.name,
      range,
      totalSessions,
      totalMinutes,
      peakHour: Number(peakHour),
      dailyBreakdown: Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch {
    res.status(500).json({ error: "Failed to generate report" });
  }
});

router.get("/:contactId/export", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["contactId"]);
    const format = (req.query["format"] as string) ?? "csv";
    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.id, contactId))
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
      "id,contactId,startTime,endTime,durationMinutes",
      ...sessions.map((s) =>
        [
          s.id,
          s.contactId,
          s.startTime?.toISOString() ?? "",
          s.endTime?.toISOString() ?? "",
          s.durationMinutes,
        ].join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${contactId}.csv"`
    );
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to export report" });
  }
});

export default router;
