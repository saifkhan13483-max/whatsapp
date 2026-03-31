import { Router } from "express";
import { db } from "@workspace/db";
import { keywordAlertsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/keywords", async (req: AuthRequest, res) => {
  try {
    const alerts = await db
      .select()
      .from(keywordAlertsTable)
      .where(eq(keywordAlertsTable.userId, req.userId!));
    res.json(alerts);
  } catch {
    res.status(500).json({ error: "Failed to fetch keyword alerts" });
  }
});

router.post("/keyword", async (req: AuthRequest, res) => {
  try {
    const { keyword, severity = "medium" } = req.body;
    const [alert] = await db
      .insert(keywordAlertsTable)
      .values({ userId: req.userId!, keyword, severity })
      .returning();
    res.json(alert);
  } catch {
    res.status(500).json({ error: "Failed to create keyword alert" });
  }
});

router.delete("/keyword/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    await db
      .delete(keywordAlertsTable)
      .where(and(eq(keywordAlertsTable.id, id), eq(keywordAlertsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete keyword alert" });
  }
});

export default router;
