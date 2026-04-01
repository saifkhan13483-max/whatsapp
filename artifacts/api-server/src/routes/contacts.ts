import { Router } from "express";
import { db } from "@workspace/db";
import {
  contactsTable,
  contactFavoritesTable,
  contactGroupsTable,
  contactGroupMembersTable,
  activitySessionsTable,
  userSubscriptionsTable,
  subscriptionPlansTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql, inArray, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import {
  subscribeContact,
  removeTrackedContact,
  getActiveSocket,
} from "../services/presenceTracker.js";

const router = Router();
router.use(requireAuth);

router.get("/favorites", async (req: AuthRequest, res) => {
  try {
    const favs = await db
      .select({ contactId: contactFavoritesTable.contactId })
      .from(contactFavoritesTable)
      .where(eq(contactFavoritesTable.userId, req.userId!));
    if (favs.length === 0) {
      res.json([]);
      return;
    }
    const ids = favs.map((f) => f.contactId);
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.userId, req.userId!), inArray(contactsTable.id, ids)));
    res.json(contacts);
  } catch {
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

router.get("/groups", async (req: AuthRequest, res) => {
  try {
    const groups = await db
      .select()
      .from(contactGroupsTable)
      .where(eq(contactGroupsTable.userId, req.userId!));
    const result = await Promise.all(
      groups.map(async (g) => {
        const members = await db
          .select({ contactId: contactGroupMembersTable.contactId })
          .from(contactGroupMembersTable)
          .where(eq(contactGroupMembersTable.groupId, g.id));
        return { ...g, contactIds: members.map((m) => m.contactId) };
      })
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

router.post("/groups", async (req: AuthRequest, res) => {
  try {
    const { name, contactIds = [] } = req.body;
    const [group] = await db
      .insert(contactGroupsTable)
      .values({ userId: req.userId!, name })
      .returning();
    if (contactIds.length > 0) {
      await db.insert(contactGroupMembersTable).values(
        contactIds.map((cid: number) => ({ groupId: group.id, contactId: cid }))
      );
    }
    res.json({ ...group, contactIds });
  } catch {
    res.status(500).json({ error: "Failed to create group" });
  }
});

router.put("/groups/:id", async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params["id"]);
    const { name, contactIds } = req.body;
    const updates: Partial<typeof contactGroupsTable.$inferInsert> = {};
    if (name) updates.name = name;
    if (Object.keys(updates).length > 0) {
      await db
        .update(contactGroupsTable)
        .set(updates)
        .where(and(eq(contactGroupsTable.id, groupId), eq(contactGroupsTable.userId, req.userId!)));
    }
    if (contactIds !== undefined) {
      await db.delete(contactGroupMembersTable).where(eq(contactGroupMembersTable.groupId, groupId));
      if (contactIds.length > 0) {
        await db.insert(contactGroupMembersTable).values(
          contactIds.map((cid: number) => ({ groupId, contactId: cid }))
        );
      }
    }
    const members = await db
      .select({ contactId: contactGroupMembersTable.contactId })
      .from(contactGroupMembersTable)
      .where(eq(contactGroupMembersTable.groupId, groupId));
    res.json({ id: groupId, name, contactIds: members.map((m) => m.contactId) });
  } catch {
    res.status(500).json({ error: "Failed to update group" });
  }
});

router.delete("/groups/:id", async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params["id"]);
    await db
      .delete(contactGroupsTable)
      .where(and(eq(contactGroupsTable.id, groupId), eq(contactGroupsTable.userId, req.userId!)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete group" });
  }
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.userId, req.userId!));
    res.json(contacts);
  } catch {
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { name, phoneNumber, phone, notes, alertEnabled } = req.body;
    const resolvedPhone = phoneNumber ?? phone;
    if (!name || !resolvedPhone) {
      res.status(400).json({ error: "name and phoneNumber are required" });
      return;
    }

    const activeSub = await db
      .select({ contactLimit: subscriptionPlansTable.contactLimit })
      .from(userSubscriptionsTable)
      .innerJoin(subscriptionPlansTable, eq(userSubscriptionsTable.planId, subscriptionPlansTable.id))
      .where(
        and(
          eq(userSubscriptionsTable.userId, req.userId!),
          eq(userSubscriptionsTable.isActive, true)
        )
      )
      .limit(1);

    const contactLimit = activeSub[0]?.contactLimit ?? 3;

    if (contactLimit !== -1) {
      const [{ value: existingCount }] = await db
        .select({ value: count() })
        .from(contactsTable)
        .where(eq(contactsTable.userId, req.userId!));

      if (existingCount >= contactLimit) {
        res.status(403).json({
          error: `Contact limit reached (${contactLimit}). Upgrade your plan to add more contacts.`,
          code: "CONTACT_LIMIT_REACHED",
          limit: contactLimit,
        });
        return;
      }
    }

    const [contact] = await db
      .insert(contactsTable)
      .values({
        userId: req.userId!,
        name,
        phoneNumber: resolvedPhone,
        notes: notes ?? null,
        alertEnabled: alertEnabled ?? true,
      })
      .returning();

    const sock = getActiveSocket(req.userId!);
    if (sock) {
      subscribeContact(req.userId!, resolvedPhone, sock).catch(() => {});
    }

    res.json(contact);
  } catch (err) {
    console.error("Create contact error:", err);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const [contact] = await db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, req.userId!)))
      .limit(1);
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json(contact);
  } catch {
    res.status(500).json({ error: "Failed to fetch contact" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const { name, notes, alertEnabled } = req.body;
    const updates: Partial<typeof contactsTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (notes !== undefined) updates.notes = notes;
    if (alertEnabled !== undefined) updates.alertEnabled = alertEnabled;
    const [contact] = await db
      .update(contactsTable)
      .set(updates)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, req.userId!)))
      .returning();
    res.json(contact);
  } catch {
    res.status(500).json({ error: "Failed to update contact" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params["id"]);
    const [contact] = await db
      .select({ phoneNumber: contactsTable.phoneNumber })
      .from(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, req.userId!)))
      .limit(1);

    await db
      .delete(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, req.userId!)));

    if (contact) {
      removeTrackedContact(req.userId!, contact.phoneNumber);
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

router.post("/:id/favorite", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["id"]);
    const existing = await db
      .select()
      .from(contactFavoritesTable)
      .where(
        and(
          eq(contactFavoritesTable.userId, req.userId!),
          eq(contactFavoritesTable.contactId, contactId)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .delete(contactFavoritesTable)
        .where(
          and(
            eq(contactFavoritesTable.userId, req.userId!),
            eq(contactFavoritesTable.contactId, contactId)
          )
        );
      res.json({ favorited: false });
    } else {
      await db
        .insert(contactFavoritesTable)
        .values({ userId: req.userId!, contactId })
        .onConflictDoNothing();
      res.json({ favorited: true });
    }
  } catch {
    res.status(500).json({ error: "Failed to toggle favorite" });
  }
});

router.get("/:id/sessions", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["id"]);
    const { from, to } = req.query;
    const conditions = [eq(activitySessionsTable.contactId, contactId)];
    if (from) conditions.push(gte(activitySessionsTable.startTime, new Date(from as string)));
    if (to) conditions.push(lte(activitySessionsTable.startTime, new Date(to as string)));
    const sessions = await db
      .select()
      .from(activitySessionsTable)
      .where(and(...conditions))
      .orderBy(activitySessionsTable.startTime);
    res.json(sessions);
  } catch {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.get("/:id/stats", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["id"]);
    const range = (req.query["range"] as string) ?? "today";
    const now = new Date();
    let fromDate = new Date(now);
    if (range === "today") fromDate.setHours(0, 0, 0, 0);
    else if (range === "week") fromDate.setDate(fromDate.getDate() - 7);
    else if (range === "month") fromDate.setMonth(fromDate.getMonth() - 1);

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
    const avgSessionMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
    const hourCounts: Record<number, number> = {};
    sessions.forEach((s) => {
      const h = new Date(s.startTime).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

    res.json({
      totalSessions,
      totalMinutes,
      avgSessionMinutes,
      peakHour: Number(peakHour),
      onlineStreak: totalSessions,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/:id/hourly", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["id"]);
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const sessions = await db
      .select()
      .from(activitySessionsTable)
      .where(
        and(
          eq(activitySessionsTable.contactId, contactId),
          gte(activitySessionsTable.startTime, dayStart)
        )
      );
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, value: 0 }));
    sessions.forEach((s) => {
      const h = new Date(s.startTime).getHours();
      hourly[h].value += s.durationMinutes;
    });
    res.json(hourly);
  } catch {
    res.status(500).json({ error: "Failed to fetch hourly data" });
  }
});

router.post("/:id/status", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["id"]);
    const [owned] = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, req.userId!)))
      .limit(1);
    if (!owned) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    const { status } = req.body;
    const isOnline = status === "online";
    const updates: Partial<typeof contactsTable.$inferInsert> = { isOnline };
    if (!isOnline) updates.lastSeen = new Date();
    await db.update(contactsTable).set(updates).where(eq(contactsTable.id, contactId));
    if (isOnline) {
      await db
        .insert(activitySessionsTable)
        .values({ contactId, startTime: new Date(), durationMinutes: 0 });
    } else {
      const [lastSession] = await db
        .select()
        .from(activitySessionsTable)
        .where(
          and(
            eq(activitySessionsTable.contactId, contactId),
            sql`${activitySessionsTable.endTime} IS NULL`
          )
        )
        .orderBy(activitySessionsTable.startTime)
        .limit(1);
      if (lastSession) {
        const end = new Date();
        const dur = Math.round((end.getTime() - lastSession.startTime.getTime()) / 60000);
        await db
          .update(activitySessionsTable)
          .set({ endTime: end, durationMinutes: Math.max(dur, 1) })
          .where(eq(activitySessionsTable.id, lastSession.id));
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.get("/:id/patterns", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["id"]);
    const sessions = await db
      .select()
      .from(activitySessionsTable)
      .where(eq(activitySessionsTable.contactId, contactId));
    const hourCounts: number[] = new Array(24).fill(0);
    sessions.forEach((s) => {
      const h = new Date(s.startTime).getHours();
      hourCounts[h]++;
    });
    const total = sessions.length || 1;
    const patterns = hourCounts.map((count, hour) => ({
      hour,
      likelihood: Math.round((count / total) * 100),
      label: count > 3 ? "Very Active" : count > 1 ? "Active" : count > 0 ? "Occasional" : "Inactive",
    }));
    res.json(patterns);
  } catch {
    res.status(500).json({ error: "Failed to fetch patterns" });
  }
});

export default router;
