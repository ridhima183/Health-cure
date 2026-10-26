import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "../playwright-output");
const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";
const widths = [390, 768, 1440];
const routes = [
  { path: "/", name: "diagnose", setup: loadSample },
  { path: "/report", name: "report" },
  { path: "/history", name: "history", setup: loadHistoryDemo },
  { path: "/performance", name: "performance" },
  { path: "/model-card", name: "model-card" },
];

async function loadSample(page) {
  const sample = page.getByRole("button", { name: /use this sample/i }).first();
  if (await sample.count()) {
    await sample.click();
    await page.waitForTimeout(800);
  }
}

async function loadHistoryDemo(page) {
  const demo = page.getByRole("button", { name: /load demo patients/i }).first();
  if (await demo.count()) {
    await demo.click();
    await page.waitForTimeout(800);
  }
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const route of routes) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(`${base}${route.path}`, { waitUntil: "networkidle" });
    if (route.setup) await route.setup(page);
    await page.waitForTimeout(400);
    const file = join(outDir, `${route.name}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("wrote", file);
  }
}

await browser.close();
