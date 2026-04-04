import { Router } from "express";
import { waWebBridge } from "../services/waWebBridge.js";

const router = Router();

router.get("/status", (_req, res) => {
  res.json(waWebBridge.getStatus());
});

router.get("/qr", (_req, res) => {
  const qr = waWebBridge.getQR();
  if (!qr) {
    res.status(404).json({ error: "No QR code available" });
    return;
  }
  res.json({ qr });
});

router.post("/start", (_req, res) => {
  waWebBridge.start().catch((err) =>
    console.error("WA Bridge start error:", err),
  );
  res.json({ started: true });
});

router.post("/stop", async (_req, res) => {
  await waWebBridge.stop();
  res.json({ stopped: true });
});

router.post("/pairing-code", async (req, res) => {
  const { number } = req.body as { number?: string };
  if (!number) {
    res.status(400).json({ error: "number is required" });
    return;
  }
  try {
    const code = await waWebBridge.requestPairingCode(number);
    res.json({ code });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to get pairing code" });
  }
});

router.post("/authorize", (req, res) => {
  const { number } = req.body as { number?: string | null };
  const n = number ?? null;
  waWebBridge.setAuthorizedNumber(n);
  res.json({ authorized: n });
});

router.get("/messages", (_req, res) => {
  res.json(waWebBridge.getMessages());
});

export default router;
