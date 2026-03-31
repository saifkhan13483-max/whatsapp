import { Router } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
  viewOnceMediaTable,
  contactsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/conversations", async (req: AuthRequest, res) => {
  try {
    const userContacts = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(eq(contactsTable.userId, req.userId!));
    const contactIds = userContacts.map((c) => c.id);
    if (contactIds.length === 0) {
      res.json([]);
      return;
    }
    const conversations = await db
      .select({
        id: conversationsTable.id,
        contactId: conversationsTable.contactId,
        lastMessage: conversationsTable.lastMessage,
        lastMessageAt: conversationsTable.lastMessageAt,
        unreadCount: conversationsTable.unreadCount,
        contactName: contactsTable.name,
        contactPhone: contactsTable.phoneNumber,
        isOnline: contactsTable.isOnline,
      })
      .from(conversationsTable)
      .innerJoin(contactsTable, eq(conversationsTable.contactId, contactsTable.id))
      .where(eq(contactsTable.userId, req.userId!))
      .orderBy(desc(conversationsTable.lastMessageAt));
    res.json(conversations);
  } catch {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/messages/:contactId", async (req: AuthRequest, res) => {
  try {
    const contactId = Number(req.params["contactId"]);
    const page = Number(req.query["page"] ?? 1);
    const limit = Number(req.query["limit"] ?? 30);
    const offset = (page - 1) * limit;
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.contactId, contactId))
      .orderBy(desc(messagesTable.sentAt))
      .limit(limit)
      .offset(offset);
    res.json(messages);
  } catch {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/view-once", async (req: AuthRequest, res) => {
  try {
    const userContacts = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(eq(contactsTable.userId, req.userId!));
    const contactIds = userContacts.map((c) => c.id);
    if (contactIds.length === 0) {
      res.json([]);
      return;
    }
    const media = await db
      .select({
        id: viewOnceMediaTable.id,
        contactId: viewOnceMediaTable.contactId,
        mediaType: viewOnceMediaTable.mediaType,
        url: viewOnceMediaTable.url,
        capturedAt: viewOnceMediaTable.capturedAt,
        contactName: contactsTable.name,
      })
      .from(viewOnceMediaTable)
      .innerJoin(contactsTable, eq(viewOnceMediaTable.contactId, contactsTable.id))
      .where(eq(contactsTable.userId, req.userId!))
      .orderBy(desc(viewOnceMediaTable.capturedAt));
    res.json(media);
  } catch {
    res.status(500).json({ error: "Failed to fetch view-once media" });
  }
});

export default router;
