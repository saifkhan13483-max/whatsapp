import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import {
  requestPairingCode,
  getConnectionStatus,
  getPairingCodeStatus,
  disconnect,
  reconnect,
} from "../lib/whatsappSessionManager.js";
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

const router = Router();
router.use(requireAuth);

router.post("/request-pairing-code", async (req: AuthRequest, res) => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber || typeof phoneNumber !== "string") {
      res.status(400).json({ error: "Phone number is required." });
      return;
    }
    const trimmed = phoneNumber.trim();
    if (!isValidPhoneNumber(trimmed)) {
      res.status(400).json({ error: "Please enter a valid phone number." });
      return;
    }
    const parsed = parsePhoneNumber(trimmed);
    const e164 = parsed.format("E.164");
    const result = await requestPairingCode(req.userId!, e164);
    res.json(result);
  } catch (e: any) {
    const status = e?.statusCode ?? 500;
    res.status(status).json({ error: e?.message ?? "WhatsApp server error." });
  }
});

router.get("/connection-status", async (req: AuthRequest, res) => {
  try {
    const status = await getConnectionStatus(req.userId!);
    res.json(status);
  } catch {
    res.json({ status: "not_connected" });
  }
});

router.get("/pairing-code-status", async (req: AuthRequest, res) => {
  try {
    const status = await getPairingCodeStatus(req.userId!);
    res.json(status);
  } catch {
    res.json({ accepted: false, status: "waiting" });
  }
});

router.post("/disconnect", async (req: AuthRequest, res) => {
  try {
    await disconnect(req.userId!);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Failed to disconnect." });
  }
});

router.post("/reconnect", async (req: AuthRequest, res) => {
  try {
    const result = await reconnect(req.userId!);
    res.json(result);
  } catch {
    res.json({ status: "failed" });
  }
});

export default router;
