import { Router } from "express";
import { db } from "@workspace/db";
import { alertRulesTable, alertEventsTable, contactsTable } from "@workspace/db/schema";
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

router.get("/events", async (req: AuthRequest, res) => {
  try {
    const unreadOnly = req.query["unreadOnly"] === "true";
    const contactIdFilter = req.query["contactId"] ? Number(req.query["contactId"]) : undefined;

    const events = await db
      .select({
        id: alertEventsTable.id,
        alertId: alertEventsTable.alertId,
        contactId: alertEventsTable.contactId,
        triggeredAt: alertEventsTable.triggeredAt,
        details: alertEventsTable.details,
        isRead: alertEventsTable.isRead,
        ruleType: alertRulesTable.type,
        ruleKeyword: alertRulesTable.keyword,
        ruleThreshold: alertRulesTable.thresholdMinutes,
        contactName: contactsTable.name,
      })
      .from(alertEventsTable)
      .innerJoin(alertRulesTable, eq(alertEventsTable.alertId, alertRulesTable.id))
      .leftJoin(contactsTable, eq(alertEventsTable.contactId, contactsTable.id))
      .where(
        and(
          eq(alertRulesTable.userId, req.userId!),
          unreadOnly ? eq(alertEventsTable.isRead, false) : undefined,
          contactIdFilter ? eq(alertEventsTable.contactId, contactIdFilter) : undefined
        )
      )
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

router.patch("/events/read-all", async (req: AuthRequest, res) => {
  try {
    const allEventIds = await db
      .select({ id: alertEventsTable.id })
      .from(alertEventsTable)
      .innerJoin(alertRulesTable, eq(alertEventsTable.alertId, alertRulesTable.id))
      .where(eq(alertRulesTable.userId, req.userId!));

    if (allEventIds.length > 0) {
      for (const e of allEventIds) {
        await db
          .update(alertEventsTable)
          .set({ isRead: true })
          .where(eq(alertEventsTable.id, e.id));
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark all events as read" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
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
    if (keyword !== undefined) updates["keyword"] = keyword;
    if (thresholdMinutes !== undefined) updates["thresholdMinutes"] = thresholdMinutes;
    if (startHour !== undefined) updates["startHour"] = startHour;
    if (endHour !== undefined) updates["endHour"] = endHour;
    if (isEnabled !== undefined) updates["isEnabled"] = isEnabled;
    if (contactId !== undefined) updates["contactId"] = contactId;

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

export default router;
