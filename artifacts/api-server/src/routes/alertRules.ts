import { Router } from "express";
import { db } from "@workspace/db";
import { alertRulesTable, alertEventsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const rules = await db
      .select()
      .from(alertRulesTable)
      .where(eq(alertRulesTable.userId, req.userId!))
      .orderBy(desc(alertRulesTable.createdAt));
    res.json(rules);
  } catch {
    res.status(500).json({ error: "Failed to fetch alert rules" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { type, contactId, keyword, thresholdMinutes, startHour, endHour } = req.body;
    if (!type) {
      res.status(400).json({ error: "type is required" });
      return;
    }
    const [rule] = await db
      .insert(alertRulesTable)
      .values({
        userId: req.userId!,
        type,
        contactId: contactId ?? null,
        keyword: keyword ?? null,
        thresholdMinutes: thresholdMinutes ?? null,
        startHour: startHour ?? null,
        endHour: endHour ?? null,
      })
      .returning();
    res.status(201).json(rule);
  } catch {
    res.status(500).json({ error: "Failed to create alert rule" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const [rule] = await db
      .select()
      .from(alertRulesTable)
      .where(and(eq(alertRulesTable.id, id), eq(alertRulesTable.userId, req.userId!)))
      .limit(1);
    if (!rule) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rule);
  } catch {
    res.status(500).json({ error: "Failed to fetch alert rule" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const { keyword, thresholdMinutes, startHour, endHour, isEnabled, contactId } = req.body;
    const updates: Record<string, unknown> = {};
    if (keyword !== undefined) updates.keyword = keyword;
    if (thresholdMinutes !== undefined) updates.thresholdMinutes = thresholdMinutes;
    if (startHour !== undefined) updates.startHour = startHour;
    if (endHour !== undefined) updates.endHour = endHour;
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (contactId !== undefined) updates.contactId = contactId;

    const [rule] = await db
      .update(alertRulesTable)
      .set(updates as any)
      .where(and(eq(alertRulesTable.id, id), eq(alertRulesTable.userId, req.userId!)))
      .returning();
    if (!rule) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rule);
  } catch {
    res.status(500).json({ error: "Failed to update alert rule" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    await db
      .delete(alertRulesTable)
      .where(and(eq(alertRulesTable.id, id), eq(alertRulesTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete alert rule" });
  }
});

router.get("/events", async (req: AuthRequest, res) => {
  try {
    const unreadOnly = req.query["unreadOnly"] === "true";

    const baseCondition = unreadOnly
      ? and(eq(alertRulesTable.userId, req.userId!), eq(alertEventsTable.isRead, false))
      : eq(alertRulesTable.userId, req.userId!);

    const events = await db
      .select({
        event: alertEventsTable,
        ruleType: alertRulesTable.type,
        ruleKeyword: alertRulesTable.keyword,
      })
      .from(alertEventsTable)
      .innerJoin(alertRulesTable, eq(alertEventsTable.alertId, alertRulesTable.id))
      .where(baseCondition)
      .orderBy(desc(alertEventsTable.triggeredAt))
      .limit(100);

    res.json(events);
  } catch {
    res.status(500).json({ error: "Failed to fetch alert events" });
  }
});

router.patch("/events/:id/read", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    await db
      .update(alertEventsTable)
      .set({ isRead: true })
      .where(eq(alertEventsTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark event as read" });
  }
});

export default router;
