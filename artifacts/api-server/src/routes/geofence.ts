import { Router } from "express";
import { db } from "@workspace/db";
import { geofenceZonesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/zones", async (req: AuthRequest, res) => {
  try {
    const zones = await db
      .select()
      .from(geofenceZonesTable)
      .where(eq(geofenceZonesTable.userId, req.userId!));
    res.json(zones);
  } catch {
    res.status(500).json({ error: "Failed to fetch geofence zones" });
  }
});

router.post("/zones", async (req: AuthRequest, res) => {
  try {
    const { name, lat, lng, radius } = req.body;
    if (!name || lat == null || lng == null || radius == null) {
      res.status(400).json({ error: "name, lat, lng, and radius are required" });
      return;
    }
    const [zone] = await db
      .insert(geofenceZonesTable)
      .values({ userId: req.userId!, name, lat, lng, radius })
      .returning();
    res.json(zone);
  } catch {
    res.status(500).json({ error: "Failed to create geofence zone" });
  }
});

router.put("/zones/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const { name, lat, lng, radius } = req.body;
    const updates: Partial<typeof geofenceZonesTable.$inferInsert> = {};
    if (name != null) updates.name = name;
    if (lat != null) updates.lat = lat;
    if (lng != null) updates.lng = lng;
    if (radius != null) updates.radius = radius;
    const [updated] = await db
      .update(geofenceZonesTable)
      .set(updates)
      .where(and(eq(geofenceZonesTable.id, id), eq(geofenceZonesTable.userId, req.userId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Zone not found" });
      return;
    }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update geofence zone" });
  }
});

router.delete("/zones/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const deleted = await db
      .delete(geofenceZonesTable)
      .where(and(eq(geofenceZonesTable.id, id), eq(geofenceZonesTable.userId, req.userId!)))
      .returning();
    if (deleted.length === 0) {
      res.status(404).json({ error: "Zone not found" });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete geofence zone" });
  }
});

export default router;
