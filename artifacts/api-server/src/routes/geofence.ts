import { Router } from "express";
import { db } from "@workspace/db";
import { geofenceZonesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
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
    const [zone] = await db
      .insert(geofenceZonesTable)
      .values({ userId: req.userId!, name, lat, lng, radius })
      .returning();
    res.json(zone);
  } catch {
    res.status(500).json({ error: "Failed to create geofence zone" });
  }
});

export default router;
