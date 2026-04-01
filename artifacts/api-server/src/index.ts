import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initWsServer } from "./services/websocket/wsServer.js";
import { initializeFromDB } from "./services/tracker/trackingEngine.js";
import { autoReconnectAllSessions, gracefulShutdown } from "./lib/whatsappSessionManager.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

initWsServer(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");

  initializeFromDB().catch((err) => {
    logger.error({ err }, "Failed to initialize tracking jobs from DB");
  });

  autoReconnectAllSessions().catch((err) => {
    logger.error({ err }, "Failed to auto-reconnect WhatsApp sessions");
  });
});

httpServer.on("error", (err) => {
  logger.error({ err }, "HTTP server error");
  process.exit(1);
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");
  await gracefulShutdown();
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
