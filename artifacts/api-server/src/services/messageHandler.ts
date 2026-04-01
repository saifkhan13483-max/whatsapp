import type { WASocket } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { broadcast } from "./websocket/wsServer.js";
import { checkKeywordAlerts } from "./alertEngine.js";
import fs from "fs";
import path from "path";

function resolveMediaDir(userId: number, type: string): string {
  const dir = path.join(process.cwd(), "uploads", String(userId), type);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function mimeToExt(mime: string | null | undefined): string {
  if (!mime) return "bin";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/aac": "aac",
    "application/pdf": "pdf",
    "application/zip": "zip",
  };
  return map[mime] ?? mime.split("/")[1] ?? "bin";
}

function getMessageType(msg: any): {
  type: string;
  text: string | null;
  isViewOnce: boolean;
  isMedia: boolean;
  isForwarded: boolean;
  quotedMessageId: string | null;
} {
  const m = msg.message;
  if (!m) return { type: "other", text: null, isViewOnce: false, isMedia: false, isForwarded: false, quotedMessageId: null };

  const isForwarded = !!(m.extendedTextMessage?.contextInfo?.isForwarded ||
    m.imageMessage?.contextInfo?.isForwarded ||
    m.videoMessage?.contextInfo?.isForwarded);

  const quotedId =
    m.extendedTextMessage?.contextInfo?.stanzaId ??
    m.imageMessage?.contextInfo?.stanzaId ??
    m.videoMessage?.contextInfo?.stanzaId ??
    null;

  if (m.conversation || m.extendedTextMessage) {
    return {
      type: "text",
      text: m.conversation ?? m.extendedTextMessage?.text ?? null,
      isViewOnce: false,
      isMedia: false,
      isForwarded,
      quotedMessageId: quotedId,
    };
  }
  if (m.imageMessage) return { type: "image", text: m.imageMessage.caption ?? null, isViewOnce: false, isMedia: true, isForwarded, quotedMessageId: quotedId };
  if (m.videoMessage) return { type: "video", text: m.videoMessage.caption ?? null, isViewOnce: false, isMedia: true, isForwarded, quotedMessageId: quotedId };
  if (m.audioMessage) return { type: "audio", text: null, isViewOnce: false, isMedia: true, isForwarded, quotedMessageId: quotedId };
  if (m.documentMessage) return { type: "document", text: m.documentMessage.caption ?? null, isViewOnce: false, isMedia: true, isForwarded, quotedMessageId: quotedId };
  if (m.stickerMessage) return { type: "sticker", text: null, isViewOnce: false, isMedia: true, isForwarded, quotedMessageId: quotedId };
  if (m.contactMessage) return { type: "contact", text: m.contactMessage.displayName ?? null, isViewOnce: false, isMedia: false, isForwarded, quotedMessageId: quotedId };
  if (m.locationMessage) return { type: "location", text: null, isViewOnce: false, isMedia: false, isForwarded, quotedMessageId: quotedId };

  const viewOnce = m.viewOnceMessage?.message ?? m.viewOnceMessageV2?.message;
  if (viewOnce) {
    const innerType = viewOnce.imageMessage ? "image" : viewOnce.videoMessage ? "video" : "other";
    return { type: innerType, text: null, isViewOnce: true, isMedia: true, isForwarded, quotedMessageId: quotedId };
  }

  return { type: "other", text: null, isViewOnce: false, isMedia: false, isForwarded, quotedMessageId: quotedId };
}

export function attachMessageHandler(userId: number, sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        const key = msg.key;
        if (!key?.remoteJid || !key.id) continue;

        const chatJid = key.remoteJid;
        const messageId = key.id;
        const fromMe = key.fromMe ?? false;
        const senderJid = fromMe ? undefined : (key.participant ?? chatJid);
        const senderName = msg.pushName ?? undefined;
        const ts = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000)
          : new Date();

        const { type: msgType, text, isViewOnce, isMedia, isForwarded, quotedMessageId } = getMessageType(msg);

        let mediaPath: string | null = null;
        let mediaMimeType: string | null = null;
        let mediaSize: number | null = null;

        if (isMedia) {
          try {
            const downloadMsg = isViewOnce
              ? (msg.message?.viewOnceMessage?.message ?? msg.message?.viewOnceMessageV2?.message ?? msg.message)
              : msg.message;

            const buffer = await downloadMediaMessage(
              { key, message: downloadMsg } as any,
              "buffer",
              {},
              { logger: logger as any, reuploadRequest: sock.updateMediaMessage }
            );

            if (buffer && buffer.length > 0) {
              const rawMsg = isViewOnce
                ? (msg.message?.viewOnceMessage?.message ?? msg.message?.viewOnceMessageV2?.message)
                : msg.message;
              const mime =
                (rawMsg as any)?.imageMessage?.mimetype ??
                (rawMsg as any)?.videoMessage?.mimetype ??
                (rawMsg as any)?.audioMessage?.mimetype ??
                (rawMsg as any)?.documentMessage?.mimetype ??
                null;

              const ext = mimeToExt(mime);
              const folder = isViewOnce ? "view-once" : msgType;
              const dir = resolveMediaDir(userId, folder);
              const filePath = path.join(dir, `${messageId}.${ext}`);
              fs.writeFileSync(filePath, buffer as Buffer);

              mediaPath = filePath;
              mediaMimeType = mime;
              mediaSize = (buffer as Buffer).length;
            }
          } catch (err) {
            logger.warn({ err, userId, messageId }, "Media download failed");
          }
        }

        const existing = await db
          .select({ id: chatMessagesTable.id })
          .from(chatMessagesTable)
          .where(eq(chatMessagesTable.messageId, messageId))
          .limit(1);

        if (existing.length > 0) continue;

        await db.insert(chatMessagesTable).values({
          userId,
          chatJid,
          messageId,
          fromMe,
          senderJid: senderJid ?? null,
          senderName: senderName ?? null,
          messageType: msgType,
          textContent: text,
          mediaPath,
          mediaMimeType,
          mediaSize,
          isViewOnce,
          isForwarded,
          quotedMessageId: quotedMessageId ?? null,
          timestamp: ts,
        });

        const preview = text?.slice(0, 80) ?? (isViewOnce ? "[View Once]" : `[${msgType}]`);

        broadcast(userId, {
          type: "new_message",
          chatJid,
          messageId,
          preview,
          isViewOnce,
          timestamp: ts.toISOString(),
        });

        if (text) {
          await checkKeywordAlerts(userId, text, chatJid, messageId).catch((err) => {
            logger.warn({ err, userId }, "Keyword alert check failed");
          });
        }

        logger.debug({ userId, chatJid, messageId, msgType, isViewOnce }, "Message stored");
      } catch (err) {
        logger.warn({ err, userId }, "Error processing message");
      }
    }
  });
}
