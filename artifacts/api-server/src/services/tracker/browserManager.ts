import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { BROWSER_ARGS, getChromiumPath } from "../../lib/chromium.js";
import { logger } from "../../lib/logger.js";

interface BrowserEntry {
  browser: Browser;
  createdAt: Date;
  pageCount: number;
}

const browsers = new Map<string, BrowserEntry>();

export async function getBrowser(sessionKey: string): Promise<Browser> {
  const existing = browsers.get(sessionKey);
  if (existing) {
    try {
      const pages = await existing.browser.pages();
      if (pages.length >= 0) {
        existing.pageCount = pages.length;
        return existing.browser;
      }
    } catch {
      browsers.delete(sessionKey);
    }
  }

  logger.info({ sessionKey }, "Launching new Chromium browser");
  const chromePath = getChromiumPath();

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: BROWSER_ARGS,
    ignoreHTTPSErrors: true,
    defaultViewport: { width: 1280, height: 800 },
  });

  browser.on("disconnected", () => {
    logger.warn({ sessionKey }, "Browser disconnected");
    browsers.delete(sessionKey);
  });

  browsers.set(sessionKey, { browser, createdAt: new Date(), pageCount: 0 });
  return browser;
}

export async function getOrCreatePage(
  sessionKey: string,
  label: string
): Promise<Page> {
  const browser = await getBrowser(sessionKey);
  const pages = await browser.pages();

  const blank = pages.find(
    (p) => p.url() === "about:blank" || p.url() === ""
  );
  if (blank) {
    return blank;
  }

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
  );
  logger.info({ sessionKey, label }, "Created new page");
  return page;
}

export async function closeBrowser(sessionKey: string): Promise<void> {
  const entry = browsers.get(sessionKey);
  if (!entry) return;
  try {
    await entry.browser.close();
  } catch {}
  browsers.delete(sessionKey);
  logger.info({ sessionKey }, "Browser closed");
}

export function isBrowserAlive(sessionKey: string): boolean {
  const entry = browsers.get(sessionKey);
  if (!entry) return false;
  try {
    return entry.browser.connected;
  } catch {
    return false;
  }
}

export function getActiveBrowserCount(): number {
  return browsers.size;
}
