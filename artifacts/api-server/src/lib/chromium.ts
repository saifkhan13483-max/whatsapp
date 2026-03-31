import { execSync } from "child_process";
import { existsSync } from "fs";

const FALLBACK_PATHS = [
  "/nix/var/nix/profiles/default/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

let cachedPath: string | null = null;

export function getChromiumPath(): string {
  if (cachedPath) return cachedPath;

  try {
    const path = execSync("which chromium", { encoding: "utf-8" }).trim();
    if (path && existsSync(path)) {
      cachedPath = path;
      return path;
    }
  } catch {}

  for (const p of FALLBACK_PATHS) {
    if (existsSync(p)) {
      cachedPath = p;
      return p;
    }
  }

  throw new Error(
    "Chromium not found. Install it via system dependencies (chromium package)."
  );
}

export const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--disable-gpu",
  "--no-first-run",
  "--no-zygote",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-translate",
  "--hide-scrollbars",
  "--metrics-recording-only",
  "--mute-audio",
  "--safebrowsing-disable-auto-update",
  "--ignore-certificate-errors",
  "--ignore-ssl-errors",
  "--ignore-certificate-errors-spki-list",
  "--window-size=1280,800",
  "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
];
