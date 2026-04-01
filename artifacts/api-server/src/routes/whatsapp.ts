import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import {
  requestPairingCode,
  getConnectionStatus,
  getPairingCodeStatus,
  disconnect,
  reconnect,
  getHealthStatus,
} from "../lib/whatsappSessionManager.js";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

const router = Router();
router.use(requireAuth);

function classifyPairingError(e: any): { httpStatus: number; code: string; message: string } {
  const msg: string = e?.message ?? "";
  const boomStatus: number | undefined = e?.output?.statusCode ?? e?.statusCode;

  if (e?.code === "RATE_LIMITED") {
    return { httpStatus: 429, code: "RATE_LIMITED", message: e.message };
  }
  if (e?.code === "PAIRING_IN_PROGRESS") {
    return { httpStatus: 409, code: "PAIRING_IN_PROGRESS", message: e.message };
  }

  // Boom 428 / connectionClosed — WhatsApp closed the connection.
  // Most common cause: phone number not registered on WhatsApp.
  if (boomStatus === 428 || msg.toLowerCase().includes("connection closed") || msg.toLowerCase().includes("connection terminated")) {
    return {
      httpStatus: 503,
      code: "CONNECTION_CLOSED",
      message:
        "WhatsApp closed the connection. Make sure the phone number has an active WhatsApp account and try again.",
    };
  }

  // Boom 401 / loggedOut
  if (boomStatus === 401 || msg.toLowerCase().includes("logged out")) {
    return { httpStatus: 401, code: "LOGGED_OUT", message: "Session logged out. Please link your account again." };
  }

  // Timeout (408)
  if (boomStatus === 408 || msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("timeout")) {
    return {
      httpStatus: 408,
      code: "TIMEOUT",
      message: "WhatsApp servers did not respond in time. Check your internet connection and try again.",
    };
  }

  return {
    httpStatus: 500,
    code: "SERVER_ERROR",
    message: msg || "WhatsApp server error. Please try again.",
  };
}

async function handleRequestPairingCode(req: AuthRequest, res: any) {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber || typeof phoneNumber !== "string") {
      res.status(400).json({ code: "INVALID_INPUT", message: "Phone number is required." });
      return;
    }
    const trimmed = phoneNumber.trim();
    if (!isValidPhoneNumber(trimmed)) {
      res.status(400).json({ code: "INVALID_PHONE", message: "Please enter a valid phone number with country code (e.g. +923001234567)." });
      return;
    }
    const parsed = parsePhoneNumber(trimmed);
    const e164 = parsed.format("E.164");
    const result = await requestPairingCode(req.userId!, e164);
    res.json(result);
  } catch (e: any) {
    const { httpStatus, code, message } = classifyPairingError(e);
    res.status(httpStatus).json({ code, message });
  }
}

async function handleConnectionStatus(req: AuthRequest, res: any) {
  try {
    const status = await getConnectionStatus(req.userId!);
    res.json(status);
  } catch {
    res.json({ status: "not_connected" });
  }
}

async function handleDisconnect(req: AuthRequest, res: any) {
  try {
    await disconnect(req.userId!);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ code: "SERVER_ERROR", message: e?.message ?? "Failed to disconnect." });
  }
}

async function handleReconnect(req: AuthRequest, res: any) {
  try {
    const result = await reconnect(req.userId!);
    res.json(result);
  } catch {
    res.json({ status: "failed" });
  }
}

router.post("/request-pairing-code", handleRequestPairingCode);
router.post("/link", handleRequestPairingCode);

router.get("/connection-status", handleConnectionStatus);
router.get("/status", handleConnectionStatus);

router.get("/pairing-code-status", async (req: AuthRequest, res) => {
  try {
    const status = await getPairingCodeStatus(req.userId!);
    res.json(status);
  } catch {
    res.json({ accepted: false, status: "waiting" });
  }
});

router.post("/disconnect", handleDisconnect);
router.post("/reconnect", handleReconnect);

router.get("/health", async (req: AuthRequest, res) => {
  try {
    const health = await getHealthStatus(req.userId!);
    res.json(health);
  } catch {
    res.json({ healthy: false, status: "error" });
  }
});

export default router;
