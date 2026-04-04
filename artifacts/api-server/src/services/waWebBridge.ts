import { createRequire } from "module";
import type { Client as ClientType, Message } from "whatsapp-web.js";
import QRCode from "qrcode";
import { existsSync } from "fs";
import { logger } from "../lib/logger.js";

const _require = createRequire(import.meta.url);
const { Client, LocalAuth } = _require("whatsapp-web.js") as {
  Client: typeof ClientType;
  LocalAuth: any;
};

const CHROMIUM_PATHS = [
  "/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome",
  "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

function findChromium(): string | undefined {
  for (const p of CHROMIUM_PATHS) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

export interface WaMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
}

class WaWebBridge {
  private client: Client | null = null;
  private qrDataUrl: string | null = null;
  private pairingCode: string | null = null;
  private ready = false;
  private initializing = false;
  private qrFired = false;
  private authorizedNumber: string | null = null;
  private connectedPhone: string | null = null;
  private messages: WaMessage[] = [];

  getStatus() {
    return {
      ready: this.ready,
      initializing: this.initializing,
      hasQR: !!this.qrDataUrl,
      pairingCode: this.pairingCode,
      phoneNumber: this.connectedPhone,
      authorizedNumber: this.authorizedNumber,
      messageCount: this.messages.length,
    };
  }

  getQR(): string | null {
    return this.qrDataUrl;
  }

  getMessages(): WaMessage[] {
    return this.messages.slice(-50);
  }

  async start(): Promise<void> {
    if (this.client || this.initializing) return;

    this.initializing = true;
    this.ready = false;
    this.qrDataUrl = null;
    this.pairingCode = null;
    this.qrFired = false;
    this.connectedPhone = null;

    const executablePath = findChromium();
    logger.info({ executablePath }, "WA Bridge: Starting with Chromium");

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: "./.whatsapp-session" }),
      puppeteer: {
        headless: true,
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--no-zygote",
          "--single-process",
        ],
      },
    });

    this.client.on("qr", async (qr: string) => {
      logger.info("WA Bridge: QR received");
      this.qrFired = true;
      try {
        this.qrDataUrl = await QRCode.toDataURL(qr);
      } catch (err) {
        logger.error({ err }, "WA Bridge: Failed to generate QR data URL");
      }
    });

    this.client.on("ready", () => {
      logger.info("WA Bridge: Client ready");
      this.ready = true;
      this.initializing = false;
      this.qrDataUrl = null;
      const info = (this.client as any)?.info;
      this.connectedPhone = info?.wid?.user ?? null;
    });

    this.client.on("authenticated", () => {
      logger.info("WA Bridge: Authenticated");
    });

    this.client.on("auth_failure", (msg: string) => {
      logger.error({ msg }, "WA Bridge: Auth failure");
      this.initializing = false;
    });

    this.client.on("disconnected", (reason: string) => {
      logger.info({ reason }, "WA Bridge: Disconnected");
      this.ready = false;
      this.initializing = false;
      this.qrDataUrl = null;
      this.pairingCode = null;
      this.qrFired = false;
      this.connectedPhone = null;
      this.client = null;
    });

    this.client.on("message", (msg: Message) => {
      if (
        this.authorizedNumber &&
        msg.from !== `${this.authorizedNumber}@c.us` &&
        msg.from !== `${this.authorizedNumber}@g.us`
      ) {
        return;
      }

      const entry: WaMessage = {
        id: msg.id.id,
        from: msg.from,
        body: msg.body,
        timestamp: msg.timestamp * 1000,
        isGroup: msg.from.endsWith("@g.us"),
      };

      this.messages.push(entry);
      if (this.messages.length > 200) {
        this.messages = this.messages.slice(-200);
      }
    });

    try {
      await this.client.initialize();
    } catch (err) {
      logger.error({ err }, "WA Bridge: Failed to initialize client");
      this.initializing = false;
      this.client = null;
    }
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.destroy();
    } catch {}
    this.client = null;
    this.ready = false;
    this.initializing = false;
    this.qrDataUrl = null;
    this.pairingCode = null;
    this.qrFired = false;
    this.connectedPhone = null;
  }

  async requestPairingCode(number: string): Promise<string> {
    if (!this.client) throw new Error("Client not started");
    if (!this.qrFired) throw new Error("Client not ready for pairing code yet — wait for QR to appear first");
    const code = await (this.client as any).requestPairingCode(number);
    this.pairingCode = code;
    this.qrDataUrl = null;
    return code;
  }

  setAuthorizedNumber(number: string | null): void {
    this.authorizedNumber = number;
  }
}

export const waWebBridge = new WaWebBridge();
