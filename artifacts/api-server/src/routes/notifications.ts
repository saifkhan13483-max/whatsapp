import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const { filter, page = "1", limit = "30" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [eq(notificationsTable.userId, req.userId!)];
    if (filter && filter !== "all") {
      conditions.push(eq(notificationsTable.type, filter as string));
    }
    const items = await db
      .select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(Number(limit))
      .offset(offset);
    res.json(items.map((n) => ({ ...n, read: n.isRead })));
  } catch {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/mark-read/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark notification" });
  }
});

router.post("/mark-all-read", async (req: AuthRequest, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.userId!));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark all notifications" });
  }
});

router.delete("/clear", async (req: AuthRequest, res) => {
  try {
    await db
      .delete(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

export default router;
