import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable, dndRulesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    let [settings] = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, req.userId!))
      .limit(1);
    if (!settings) {
      const [created] = await db
        .insert(userSettingsTable)
        .values({ userId: req.userId! })
        .returning();
      settings = created;
    }
    res.json({
      notificationsEnabled: settings.notificationsEnabled,
      onlineAlerts: settings.onlineAlerts,
      offlineAlerts: settings.offlineAlerts,
      reportFrequency: settings.reportFrequency,
      dndEnabled: settings.dndEnabled,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/", async (req: AuthRequest, res) => {
  try {
    const { notificationsEnabled, onlineAlerts, offlineAlerts, reportFrequency, dndEnabled } = req.body;
    const updates: Partial<typeof userSettingsTable.$inferInsert> = {};
    if (notificationsEnabled !== undefined) updates.notificationsEnabled = notificationsEnabled;
    if (onlineAlerts !== undefined) updates.onlineAlerts = onlineAlerts;
    if (offlineAlerts !== undefined) updates.offlineAlerts = offlineAlerts;
    if (reportFrequency !== undefined) updates.reportFrequency = reportFrequency;
    if (dndEnabled !== undefined) updates.dndEnabled = dndEnabled;

    let existing = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, req.userId!))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(userSettingsTable).values({ userId: req.userId!, ...updates });
    } else {
      await db.update(userSettingsTable).set(updates).where(eq(userSettingsTable.userId, req.userId!));
    }
    const [updated] = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, req.userId!))
      .limit(1);
    res.json({
      notificationsEnabled: updated.notificationsEnabled,
      onlineAlerts: updated.onlineAlerts,
      offlineAlerts: updated.offlineAlerts,
      reportFrequency: updated.reportFrequency,
      dndEnabled: updated.dndEnabled,
    });
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.get("/dnd", async (req: AuthRequest, res) => {
  try {
    const rules = await db
      .select()
      .from(dndRulesTable)
      .where(eq(dndRulesTable.userId, req.userId!));
    res.json(rules);
  } catch {
    res.status(500).json({ error: "Failed to fetch DND rules" });
  }
});

router.post("/dnd", async (req: AuthRequest, res) => {
  try {
    const { startTime, endTime, label } = req.body;
    const [rule] = await db
      .insert(dndRulesTable)
      .values({ userId: req.userId!, startTime, endTime, label: label ?? "Do Not Disturb" })
      .returning();
    res.json(rule);
  } catch {
    res.status(500).json({ error: "Failed to create DND rule" });
  }
});

router.delete("/dnd/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    await db
      .delete(dndRulesTable)
      .where(and(eq(dndRulesTable.id, id), eq(dndRulesTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete DND rule" });
  }
});

export default router;
