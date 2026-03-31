import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionPlansTable, userSubscriptionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

async function seedPlansIfNeeded() {
  const existing = await db.select().from(subscriptionPlansTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(subscriptionPlansTable).values([
    {
      name: "Free",
      price: 0,
      period: "month",
      features: ["Track up to 3 contacts", "Basic activity reports", "7-day history"],
      contactLimit: 3,
      isPopular: false,
    },
    {
      name: "Pro",
      price: 9.99,
      period: "month",
      features: [
        "Track up to 20 contacts",
        "Advanced reports & exports",
        "90-day history",
        "View-once media recovery",
        "Keyword alerts",
        "Family dashboard",
      ],
      contactLimit: 20,
      isPopular: true,
    },
    {
      name: "Family",
      price: 19.99,
      period: "month",
      features: [
        "Unlimited contacts",
        "All Pro features",
        "Contact groups",
        "Geofence zones",
        "Priority support",
        "1-year history",
      ],
      contactLimit: 999,
      isPopular: false,
    },
  ]);
}

router.get("/plans", async (_req, res) => {
  try {
    await seedPlansIfNeeded();
    const plans = await db.select().from(subscriptionPlansTable);
    res.json(plans);
  } catch {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

router.get("/current", async (req: AuthRequest, res) => {
  try {
    const [sub] = await db
      .select({
        id: userSubscriptionsTable.id,
        planId: userSubscriptionsTable.planId,
        expiresAt: userSubscriptionsTable.expiresAt,
        isActive: userSubscriptionsTable.isActive,
        planName: subscriptionPlansTable.name,
      })
      .from(userSubscriptionsTable)
      .innerJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
      .where(
        and(
          eq(userSubscriptionsTable.userId, req.userId!),
          eq(userSubscriptionsTable.isActive, true)
        )
      )
      .limit(1);

    if (!sub) {
      res.json({
        planId: "free",
        planName: "Free",
        expiresAt: null,
        isActive: true,
      });
      return;
    }
    res.json({
      planId: String(sub.planId),
      planName: sub.planName,
      expiresAt: sub.expiresAt,
      isActive: sub.isActive,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

router.post("/upgrade", async (req: AuthRequest, res) => {
  try {
    const { planId } = req.body;
    await db
      .update(userSubscriptionsTable)
      .set({ isActive: false })
      .where(eq(userSubscriptionsTable.userId, req.userId!));
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const [sub] = await db
      .insert(userSubscriptionsTable)
      .values({ userId: req.userId!, planId: Number(planId), expiresAt, isActive: true })
      .returning();
    res.json({ ok: true, subscriptionId: sub.id });
  } catch {
    res.status(500).json({ error: "Failed to upgrade subscription" });
  }
});

export default router;
