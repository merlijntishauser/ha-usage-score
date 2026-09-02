/**
 * Capture every card for the README, from the built bundle.
 *
 * Reuses the layout-test harness, so the screenshots are of the same artifact
 * the layout specs measure and the Lovelace resource serves. Regenerating them
 * is one command, which is the only way documentation images stay honest after
 * a card changes.
 *
 *     npm run build && node scripts/capture-cards.mjs
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = new URL("../docs/images/", import.meta.url);
const PORT = 8124;
const BASE = `http://localhost:${PORT}/e2e/harness.html`;

/** name, element, column width, variant. */
const SHOTS = [
  ["hero", "haus-card", 500, "full"],
  ["hero-degraded", "haus-card", 500, "degraded"],
  ["hero-narrow", "haus-card", 320, "full"],
  ["breakdown", "haus-breakdown-card", 500, "full"],
  ["spread", "haus-spread-card", 500, "full"],
  ["household", "haus-household-card", 500, "full"],
  ["badge", "haus-badge", 260, "full"],
  ["tile", "haus-tile", 300, "full"],
];

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`server never came up at ${url}`);
}

const server = spawn("node", ["e2e/serve.mjs"], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});

try {
  await waitForServer(BASE);
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  // Retina, because a 1x card screenshot looks soft on every modern display.
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  for (const [name, card, width, variant] of SHOTS) {
    await page.goto(`${BASE}?card=${card}&width=${width}&variant=${variant}`);
    await page.waitForSelector("body[data-ready='true']");
    const element = page.locator(card);
    await element.screenshot({
      path: fileURLToPath(new URL(`${name}.png`, OUT)),
    });
    console.log(`docs/images/${name}.png  (${card} at ${width}px, ${variant})`);
  }

  await browser.close();
} finally {
  server.kill();
}
