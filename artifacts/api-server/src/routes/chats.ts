import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db/schema";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import fs from "fs";
import path from "path";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        chatJid: chatMessagesTable.chatJid,
        lastMessage: chatMessagesTable.textContent,
        lastMessageType: chatMessagesTable.messageType,
        lastMessageTime: chatMessagesTable.timestamp,
        isViewOnce: chatMessagesTable.isViewOnce,
        fromMe: chatMessagesTable.fromMe,
        senderName: chatMessagesTable.senderName,
      })
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, req.userId!))
      .orderBy(desc(chatMessagesTable.timestamp));

    const chatMap = new Map<string, (typeof rows)[0]>();
    for (const row of rows) {
      if (!chatMap.has(row.chatJid)) {
        chatMap.set(row.chatJid, row);
      }
    }

    res.json([...chatMap.values()]);
  } catch {
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

router.get("/view-once", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.userId, req.userId!),
          eq(chatMessagesTable.isViewOnce, true)
        )
      )
      .orderBy(desc(chatMessagesTable.timestamp));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch view-once media" });
  }
});

router.get("/search", async (req: AuthRequest, res) => {
  try {
    const q = (req.query["q"] as string) ?? "";
    if (!q.trim()) {
      res.json([]);
      return;
    }
    const rows = await db
      .select()
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.userId, req.userId!),
          ilike(chatMessagesTable.textContent, `%${q}%`)
        )
      )
      .orderBy(desc(chatMessagesTable.timestamp))
      .limit(50);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to search messages" });
  }
});

router.get("/media/:messageId", async (req: AuthRequest, res) => {
  try {
    const [msg] = await db
      .select()
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.messageId, req.params["messageId"]!),
          eq(chatMessagesTable.userId, req.userId!)
        )
      )
      .limit(1);

    if (!msg || !msg.mediaPath) {
      res.status(404).json({ error: "Media not found" });
      return;
    }

    if (!fs.existsSync(msg.mediaPath)) {
      res.status(404).json({ error: "Media file missing on disk" });
      return;
    }

    const ext = path.extname(msg.mediaPath).slice(1);
    const mime = msg.mediaMimeType ?? `application/octet-stream`;
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${msg.messageId}.${ext}"`
    );
    fs.createReadStream(msg.mediaPath).pipe(res);
  } catch {
    res.status(500).json({ error: "Failed to serve media" });
  }
});

router.get("/:chatJid/messages", async (req: AuthRequest, res) => {
  try {
    const chatJid = decodeURIComponent(req.params["chatJid"]!);
    const page = Number(req.query["page"] ?? 1);
    const limit = Math.min(Number(req.query["limit"] ?? 30), 100);
    const offset = (page - 1) * limit;

    const rows = await db
      .select()
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.userId, req.userId!),
          eq(chatMessagesTable.chatJid, chatJid)
        )
      )
      .orderBy(desc(chatMessagesTable.timestamp))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.userId, req.userId!),
          eq(chatMessagesTable.chatJid, chatJid)
        )
      );

    res.json({ messages: rows, total: count, page, limit });
  } catch {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

export default router;
