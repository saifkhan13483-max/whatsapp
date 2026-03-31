import type { Page } from "puppeteer-core";
import { logger } from "../../lib/logger.js";

export type PresenceStatus = "online" | "offline" | "last_seen" | "unknown";

export interface PresenceResult {
  status: PresenceStatus;
  text: string | null;
}

const WA_SEND_URL = "https://web.whatsapp.com/send";

export function jitterMs(baseMs: number, jitterPct = 0.4): number {
  const delta = baseMs * jitterPct;
  return baseMs + Math.round((Math.random() * 2 - 1) * delta);
}

async function dismissDialogs(page: Page): Promise<void> {
  try {
    const buttons = await page.$$("button, [role='button']");
    for (const btn of buttons) {
      const text = await btn
        .evaluate((el) => el.textContent?.toLowerCase() ?? "")
        .catch(() => "");
      if (
        text.includes("continue") ||
        text.includes("ok") ||
        text.includes("open") ||
        text.includes("use here") ||
        text.includes("keep using")
      ) {
        await btn.click().catch(() => {});
        await new Promise((r) => setTimeout(r, jitterMs(600)));
        break;
      }
    }
  } catch {}
}

async function isDomStable(page: Page): Promise<boolean> {
  try {
    const headerExists = await page
      .evaluate(() => !!document.querySelector("header"))
      .catch(() => false);
    return headerExists;
  } catch {
    return false;
  }
}

async function readStatusFromDOM(page: Page): Promise<PresenceResult> {
  try {
    return await page.evaluate((): { status: string; text: string | null } => {
      const header = document.querySelector("header");
      if (!header) return { status: "unknown", text: null };

      const normalize = (s: string) => s.trim().toLowerCase();

      const allSpans = Array.from(header.querySelectorAll("span, div"));
      for (const el of allSpans) {
        const raw = normalize(el.textContent ?? "");
        if (!raw || raw.length > 80) continue;

        if (raw === "online") {
          return { status: "online", text: "online" };
        }
        if (
          raw.startsWith("last seen") ||
          raw.startsWith("last seen today") ||
          raw.startsWith("last seen yesterday")
        ) {
          return {
            status: "last_seen",
            text: (el.textContent ?? "").trim(),
          };
        }
      }

      const specificSelectors = [
        "span._3W2ap",
        "span[class*='subtitle']",
        "div[class*='info'] span",
        "span[class*='y44bm']",
        "span[class*='presence']",
        "[data-testid='conversation-info-header-chat-title'] + span",
      ];
      for (const sel of specificSelectors) {
        try {
          const els = header.querySelectorAll(sel);
          for (const el of els) {
            const raw = normalize(el.textContent ?? "");
            if (raw === "online") return { status: "online", text: "online" };
            if (raw.startsWith("last seen"))
              return {
                status: "last_seen",
                text: (el.textContent ?? "").trim(),
              };
          }
        } catch {}
      }

      return { status: "offline", text: null };
    }) as PresenceResult;
  } catch (err) {
    logger.debug({ err }, "DOM read failed");
    return { status: "unknown", text: null };
  }
}

async function doubleCheckStatus(page: Page): Promise<PresenceResult> {
  const first = await readStatusFromDOM(page);
  if (first.status === "unknown") return first;

  await new Promise((r) => setTimeout(r, jitterMs(400, 0.3)));
  const second = await readStatusFromDOM(page);

  if (first.status === second.status) return second;

  await new Promise((r) => setTimeout(r, jitterMs(600, 0.3)));
  const third = await readStatusFromDOM(page);

  return second.status === third.status ? third : first;
}

export async function readStatusFromDOMRecheck(page: Page): Promise<PresenceResult> {
  const stable = await isDomStable(page);
  if (!stable) return { status: "unknown", text: null };
  return doubleCheckStatus(page);
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
      await new Promise((r) => setTimeout(r, jitterMs(1000)));
      await dismissDialogs(page);
    } catch (err) {
      logger.warn({ err, phoneNumber }, "Failed to navigate to chat");
      return { status: "unknown", text: null };
    }
  } else {
    await new Promise((r) => setTimeout(r, jitterMs(1500)));
    await dismissDialogs(page);
  }

  return doubleCheckStatus(page);
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
        : await readStatusFromDOMRecheck(page);

      await onResult(result);
    } catch (err) {
      logger.warn({ err, phoneNumber }, "Status poll error");
    }
  }
}
