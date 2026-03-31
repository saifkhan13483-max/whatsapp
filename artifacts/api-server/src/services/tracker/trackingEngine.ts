import { db } from "@workspace/db";
import {
  trackerJobsTable,
  trackerSessionsTable,
  activityLogsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { getSessionPage, startSession } from "./sessionManager.js";
import {
  openChatAndDetect,
  readStatusFromDOMRecheck,
  jitterMs,
  type PresenceResult,
  type PresenceStatus,
} from "./statusDetector.js";
import { broadcast } from "../websocket/wsServer.js";
import type { Page } from "puppeteer-core";

interface WorkerState {
  controller: AbortController;
  lastStatus: PresenceStatus;
  sessionStartAt: Date | null;
  userId: number;
  phoneNumber: string;
  jobId: number;
}

const workers = new Map<number, WorkerState>();

async function getActivePage(userId: number): Promise<Page | null> {
  const page = await getSessionPage(userId);
  if (page) return page;

  const [row] = await db
    .select()
    .from(trackerSessionsTable)
    .where(eq(trackerSessionsTable.userId, userId))
    .limit(1);

  if (row?.status !== "connected") return null;

  const info = await startSession(userId);
  if (info.status !== "connected") return null;

  return getSessionPage(userId);
}

async function handleStatusChange(
  state: WorkerState,
  result: PresenceResult
): Promise<void> {
  const { userId, phoneNumber, jobId } = state;
  const newStatus = result.status === "unknown" ? state.lastStatus : result.status;

  if (newStatus === state.lastStatus) return;

  const now = new Date();
  const prevStatus = state.lastStatus;
  state.lastStatus = newStatus;

  let durationSeconds: number | null = null;

  if (newStatus === "offline" || newStatus === "last_seen") {
    if (state.sessionStartAt) {
      durationSeconds = Math.round(
        (now.getTime() - state.sessionStartAt.getTime()) / 1000
      );
      state.sessionStartAt = null;
    }
  }

  if (newStatus === "online" && prevStatus !== "online") {
    state.sessionStartAt = now;
  }

  await db.insert(activityLogsTable).values({
    jobId,
    userId,
    phoneNumber,
    event: newStatus,
    statusText: result.text,
    sessionStartAt: prevStatus === "online" ? state.sessionStartAt ?? undefined : undefined,
    sessionEndAt: newStatus !== "online" && state.sessionStartAt === null ? now : undefined,
    durationSeconds: durationSeconds ?? undefined,
    createdAt: now,
  });

  await db
    .update(trackerJobsTable)
    .set({
      lastStatus: newStatus,
      lastStatusAt: now,
      updatedAt: now,
    })
    .where(eq(trackerJobsTable.id, jobId));

  broadcast(userId, {
    type: "status_change",
    jobId,
    phoneNumber,
    status: newStatus,
    previousStatus: prevStatus,
    statusText: result.text,
    durationSeconds,
    timestamp: now.toISOString(),
  });

  logger.info(
    { userId, phoneNumber, jobId, prevStatus, newStatus, durationSeconds },
    "Status changed"
  );
}

async function runWorker(state: WorkerState): Promise<void> {
  const { controller, userId, phoneNumber, jobId } = state;
  const signal = controller.signal;

  const [job] = await db
    .select()
    .from(trackerJobsTable)
    .where(eq(trackerJobsTable.id, jobId))
    .limit(1);

  const pollInterval = (job?.pollIntervalSeconds ?? 7) * 1000;
  let chatOpened = false;

  while (!signal.aborted) {
    try {
      const page = await getActivePage(userId);
      if (!page) {
        logger.warn({ userId, phoneNumber }, "No active page — waiting");
        await new Promise((r) => setTimeout(r, 15_000));
        continue;
      }

      let result: PresenceResult;
      if (!chatOpened) {
        result = await openChatAndDetect(page, phoneNumber);
        chatOpened = true;
      } else {
        result = await readStatusFromDOMRecheck(page);
      }

      await handleStatusChange(state, result);
    } catch (err) {
      logger.error({ err, userId, phoneNumber }, "Worker error");
      chatOpened = false;
    }

    if (!signal.aborted) {
      await new Promise((r) =>
        setTimeout(r, jitterMs(pollInterval, 0.4))
      );
    }
  }

  logger.info({ jobId, phoneNumber }, "Worker stopped");
}

export async function startTracking(
  jobId: number,
  userId: number,
  phoneNumber: string,
  pollIntervalSeconds = 7
): Promise<void> {
  if (workers.has(jobId)) {
    logger.warn({ jobId }, "Worker already running");
    return;
  }

  const [existing] = await db
    .select()
    .from(trackerJobsTable)
    .where(eq(trackerJobsTable.id, jobId))
    .limit(1);

  const controller = new AbortController();
  const state: WorkerState = {
    controller,
    lastStatus: (existing?.lastStatus as PresenceStatus) ?? "unknown",
    sessionStartAt: null,
    userId,
    phoneNumber,
    jobId,
  };

  workers.set(jobId, state);

  runWorker(state).catch((err) => {
    logger.error({ err, jobId }, "Worker crashed");
    workers.delete(jobId);
  });

  logger.info({ jobId, userId, phoneNumber, pollIntervalSeconds }, "Tracking started");
}

export function stopTracking(jobId: number): void {
  const state = workers.get(jobId);
  if (!state) return;
  state.controller.abort();
  workers.delete(jobId);
  logger.info({ jobId }, "Tracking stopped");
}

export async function initializeFromDB(): Promise<void> {
  const jobs = await db
    .select()
    .from(trackerJobsTable)
    .where(eq(trackerJobsTable.isActive, true));

  logger.info({ count: jobs.length }, "Initializing tracking jobs from DB");

  for (const job of jobs) {
    await new Promise((r) => setTimeout(r, jitterMs(500, 0.5)));
    startTracking(job.id, job.userId, job.phoneNumber, job.pollIntervalSeconds).catch(
      (err) => logger.error({ err, jobId: job.id }, "Failed to start job")
    );
  }
}

export function getWorkerStatus(): Array<{
  jobId: number;
  userId: number;
  phoneNumber: string;
  lastStatus: PresenceStatus;
  running: boolean;
}> {
  return Array.from(workers.entries()).map(([jobId, state]) => ({
    jobId,
    userId: state.userId,
    phoneNumber: state.phoneNumber,
    lastStatus: state.lastStatus,
    running: !state.controller.signal.aborted,
  }));
}
