import type { Page } from "puppeteer-core";
import { logger } from "../../lib/logger.js";

export type PresenceStatus = "online" | "offline" | "last_seen" | "unknown";

export interface PresenceResult {
  status: PresenceStatus;
  text: string | null;
}

const WA_SEND_URL = "https://web.whatsapp.com/send";

function jitterMs(baseMs: number, jitterPct = 0.4): number {
  const delta = baseMs * jitterPct;
  return baseMs + Math.round((Math.random() * 2 - 1) * delta);
}

async function dismissDialogs(page: Page): Promise<void> {
  try {
    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = await btn.evaluate((el) => el.textContent?.toLowerCase() ?? "");
      if (
        text.includes("continue") ||
        text.includes("ok") ||
        text.includes("open")
      ) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 500));
        break;
      }
    }
  } catch {}
}

async function readStatusFromDOM(page: Page): Promise<PresenceResult> {
  try {
    return await page.evaluate((): { status: string; text: string | null } => {
      const header = document.querySelector("header");
      if (!header) return { status: "unknown", text: null };

      const allSpans = Array.from(header.querySelectorAll("span"));
      for (const span of allSpans) {
        const raw = (span.textContent ?? "").trim().toLowerCase();
        if (raw === "online") {
          return { status: "online", text: "online" };
        }
        if (raw.startsWith("last seen")) {
          return { status: "last_seen", text: span.textContent?.trim() ?? raw };
        }
      }

      const subtitles = header.querySelectorAll(
        "span._3W2ap, span[class*='subtitle'], div[class*='info'] span"
      );
      for (const el of subtitles) {
        const raw = (el.textContent ?? "").trim().toLowerCase();
        if (raw === "online") return { status: "online", text: "online" };
        if (raw.startsWith("last seen")) {
          return { status: "last_seen", text: el.textContent?.trim() ?? raw };
        }
      }

      return { status: "offline", text: null };
    }) as PresenceResult;
  } catch (err) {
    logger.debug({ err }, "DOM read failed");
    return { status: "unknown", text: null };
  }
}

export async function readStatusFromDOMRecheck(page: Page): Promise<PresenceResult> {
  return readStatusFromDOM(page);
}

export async function openChatAndDetect(
  page: Page,
  phoneNumber: string
): Promise<PresenceResult> {
  const normalized = phoneNumber.replace(/\D/g, "");
  const url = `${WA_SEND_URL}?phone=${normalized}&type=phone_number&app_absent=0`;

  const currentUrl = page.url();
  const alreadyOnChat =
    currentUrl.includes(`phone=${normalized}`) ||
    currentUrl.includes(`/${normalized}`);

  if (!alreadyOnChat) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await new Promise((r) => setTimeout(r, jitterMs(3000)));
      await dismissDialogs(page);
      await page.waitForSelector("header", { timeout: 15_000 });
    } catch (err) {
      logger.warn({ err, phoneNumber }, "Failed to navigate to chat");
      return { status: "unknown", text: null };
    }
  } else {
    await new Promise((r) => setTimeout(r, jitterMs(1500)));
  }

  return readStatusFromDOM(page);
}

export async function pollStatus(
  page: Page,
  phoneNumber: string,
  intervalSeconds: number,
  onResult: (result: PresenceResult) => Promise<void>,
  signal: AbortSignal
): Promise<void> {
  let first = true;

  while (!signal.aborted) {
    if (!first) {
      const waitMs = jitterMs(intervalSeconds * 1000, 0.5);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    first = false;

    if (signal.aborted) break;

    try {
      const result = first
        ? await openChatAndDetect(page, phoneNumber)
        : await readStatusFromDOM(page);

      await onResult(result);
    } catch (err) {
      logger.warn({ err, phoneNumber }, "Status poll error");
    }
  }
}

export { jitterMs };
