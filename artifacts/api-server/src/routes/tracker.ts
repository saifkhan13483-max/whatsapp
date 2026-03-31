import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import {
  trackerSessionsTable,
  trackerJobsTable,
  activityLogsTable,
} from "@workspace/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  startSession,
  getSessionStatus,
  disconnectSession,
} from "../services/tracker/sessionManager.js";
import {
  startTracking,
  stopTracking,
  getWorkerStatus,
} from "../services/tracker/trackingEngine.js";
import { getConnectedCount } from "../services/websocket/wsServer.js";
import {
  requestPairingCode,
  getPairingCodeStatus,
  getConnectionStatus,
} from "../lib/whatsappSessionManager.js";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

const router = Router();

router.use(requireAuth);

router.post("/session/start", async (req, res) => {
  const userId = (req as any).userId as number;
  const info = await startSession(userId);
  res.json({ success: true, ...info });
});

router.get("/session/status", async (req, res) => {
  const userId = (req as any).userId as number;
  const info = await getSessionStatus(userId);
  res.json({ success: true, ...info });
});

router.delete("/session", async (req, res) => {
  const userId = (req as any).userId as number;
  await disconnectSession(userId);
  res.json({ success: true, message: "Session disconnected" });
});

router.post("/session/pairing-code", async (req, res) => {
  const userId = (req as any).userId as number;
  const { phoneNumber } = req.body as { phoneNumber?: string };

  if (!phoneNumber || typeof phoneNumber !== "string") {
    res.status(400).json({ error: "phoneNumber is required." });
    return;
  }

  const trimmed = phoneNumber.trim();

  let e164: string;
  try {
    if (!isValidPhoneNumber(trimmed)) {
      res.status(400).json({
        error:
          "Invalid phone number. Please enter a valid number with country code (e.g. +923001234567).",
      });
      return;
    }
    const parsed = parsePhoneNumber(trimmed);
    e164 = parsed.format("E.164");
  } catch {
    res.status(400).json({
      error:
        "Could not parse phone number. Make sure to include the country code (e.g. +923001234567).",
    });
    return;
  }

  try {
    const result = await requestPairingCode(userId, e164);
    res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    res.status(status).json({ error: err?.message ?? "Failed to generate pairing code." });
  }
});

router.get("/session/verify", async (req, res) => {
  const userId = (req as any).userId as number;
  try {
    const status = await getPairingCodeStatus(userId);
    res.json({ success: true, ...status });
  } catch {
    res.json({ success: false, accepted: false, status: "error" });
  }
});

router.post("/session/verify", async (req, res) => {
  const userId = (req as any).userId as number;
  try {
    const status = await getConnectionStatus(userId);
    const linked = status.status === "connected";
    res.json({
      success: true,
      linked,
      status: status.status,
      phoneNumber: status.phoneNumber,
      connectedAt: status.connectedAt,
      lastError: status.lastError,
    });
  } catch {
    res.json({ success: false, linked: false, status: "error" });
  }
});

router.post("/track", async (req, res) => {
  const userId = (req as any).userId as number;
  const { phoneNumber, label, pollIntervalSeconds = 7 } = req.body as {
    phoneNumber: string;
    label?: string;
    pollIntervalSeconds?: number;
  };

  if (!phoneNumber) {
    return res.status(400).json({ error: "phoneNumber is required" });
  }

  const normalized = phoneNumber.replace(/\D/g, "");

  const existing = await db
    .select()
    .from(trackerJobsTable)
    .where(
      and(
        eq(trackerJobsTable.userId, userId),
        eq(trackerJobsTable.phoneNumber, normalized)
      )
    )
    .limit(1);

  let jobId: number;

  if (existing.length > 0) {
    jobId = existing[0].id;
    await db
      .update(trackerJobsTable)
      .set({ isActive: true, label: label ?? existing[0].label, updatedAt: new Date() })
      .where(eq(trackerJobsTable.id, jobId));
  } else {
    const [inserted] = await db
      .insert(trackerJobsTable)
      .values({
        userId,
        phoneNumber: normalized,
        label: label ?? normalized,
        isActive: true,
        pollIntervalSeconds: Math.max(5, Math.min(60, pollIntervalSeconds)),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: trackerJobsTable.id });
    jobId = inserted.id;
  }

  await startTracking(jobId, userId, normalized, pollIntervalSeconds);

  res.json({
    success: true,
    jobId,
    phoneNumber: normalized,
    message: "Tracking started",
  });
});

router.delete("/untrack/:jobId", async (req, res) => {
  const userId = (req as any).userId as number;
  const jobId = parseInt(req.params.jobId, 10);

  const [job] = await db
    .select()
    .from(trackerJobsTable)
    .where(and(eq(trackerJobsTable.id, jobId), eq(trackerJobsTable.userId, userId)))
    .limit(1);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  stopTracking(jobId);
  await db
    .update(trackerJobsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(trackerJobsTable.id, jobId));

  res.json({ success: true, message: "Tracking stopped" });
});

router.get("/jobs", async (req, res) => {
  const userId = (req as any).userId as number;
  const jobs = await db
    .select()
    .from(trackerJobsTable)
    .where(eq(trackerJobsTable.userId, userId))
    .orderBy(desc(trackerJobsTable.createdAt));

  const runningWorkers = getWorkerStatus();
  const running = new Set(runningWorkers.map((w) => w.jobId));

  res.json({
    success: true,
    jobs: jobs.map((j) => ({ ...j, workerRunning: running.has(j.id) })),
  });
});

router.get("/activity/:phoneNumber", async (req, res) => {
  const userId = (req as any).userId as number;
  const { phoneNumber } = req.params;
  const normalized = phoneNumber.replace(/\D/g, "");
  const limit = Math.min(parseInt((req.query.limit as string) ?? "100", 10), 500);
  const since = req.query.since
    ? new Date(req.query.since as string)
    : new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(
      and(
        eq(activityLogsTable.userId, userId),
        eq(activityLogsTable.phoneNumber, normalized),
        gte(activityLogsTable.createdAt, since)
      )
    )
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit);

  res.json({ success: true, phoneNumber: normalized, logs });
});

router.get("/stats/:phoneNumber", async (req, res) => {
  const userId = (req as any).userId as number;
  const { phoneNumber } = req.params;
  const normalized = phoneNumber.replace(/\D/g, "");
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(
      and(
        eq(activityLogsTable.userId, userId),
        eq(activityLogsTable.phoneNumber, normalized),
        gte(activityLogsTable.createdAt, since)
      )
    )
    .orderBy(desc(activityLogsTable.createdAt));

  const onlineEvents = logs.filter((l) => l.event === "online");
  const offlineEvents = logs.filter((l) => l.event === "offline" || l.event === "last_seen");
  const totalDuration = offlineEvents.reduce(
    (sum, l) => sum + (l.durationSeconds ?? 0),
    0
  );

  const byDay: Record<string, { sessions: number; durationSeconds: number }> = {};
  for (const log of offlineEvents) {
    const day = log.createdAt.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { sessions: 0, durationSeconds: 0 };
    byDay[day].sessions++;
    byDay[day].durationSeconds += log.durationSeconds ?? 0;
  }

  const currentStatus = logs[0]?.event ?? "unknown";

  res.json({
    success: true,
    phoneNumber: normalized,
    stats: {
      totalSessions: onlineEvents.length,
      totalOnlineDurationSeconds: totalDuration,
      averageSessionSeconds:
        offlineEvents.length > 0
          ? Math.round(totalDuration / offlineEvents.length)
          : 0,
      currentStatus,
      lastActivity: logs[0]?.createdAt ?? null,
      dailyBreakdown: byDay,
      periodDays: 7,
    },
  });
});

router.get("/ws/info", async (_req, res) => {
  res.json({
    wsUrl: "/ws",
    connectedClients: getConnectedCount(),
    note: "Connect with ?userId=YOUR_ID query param",
  });
});

export default router;
