import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.OPERO_URL ?? "http://localhost:3001";
const OUTPUT_DIR = join(process.cwd(), "demo-recordings");
const SHOTS_DIR = join(OUTPUT_DIR, "screenshots");

async function step(page, label, fn) {
  const start = Date.now();
  console.log(`▶ ${label}`);
  await fn();
  await page.waitForTimeout(700);
  const safeName = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const target = join(SHOTS_DIR, `${String(stepCounter++).padStart(2, "0")}-${safeName}.png`);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`  ✓ ${label} (${Date.now() - start}ms) → ${target}`);
}

let stepCounter = 1;

async function switchProfile(page, profileId) {
  await page.evaluate((id) => {
    const raw = localStorage.getItem("opero-demo-state-3phase-v1");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state.activeProfileId = id;
    localStorage.setItem("opero-demo-state-3phase-v1", JSON.stringify(parsed));
  }, profileId);
  await page.reload({ waitUntil: "networkidle" });
}

await mkdir(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: OUTPUT_DIR,
    size: { width: 1440, height: 900 },
  },
  deviceScaleFactor: 2,
});

const page = await context.newPage();

// Prime state once so role switches are deterministic
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("opero-demo-state-3phase-v1"));
await page.reload({ waitUntil: "networkidle" });

await step(page, "Dashboard als Super admin", async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
});

await step(page, "Projectenbord drie fases", async () => {
  await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
});

await step(page, "Projecten als Sales filter verkoop", async () => {
  await switchProfile(page, "profile-sales");
  await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
});

await step(page, "Filterbar Klaar voor factuur", async () => {
  await switchProfile(page, "profile-super-admin");
  await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
  const chip = page.getByRole("button", { name: /klaar voor factuur/i }).first();
  if (await chip.count()) await chip.click();
  await page.waitForTimeout(400);
});

await step(page, "Tabelweergave", async () => {
  const tableToggle = page.getByRole("button", { name: /tabel/i }).first();
  if (await tableToggle.count()) await tableToggle.click();
  await page.waitForTimeout(400);
});

await step(page, "Project detail verkoop tab", async () => {
  await page.goto(`${BASE}/projects/p-004`, { waitUntil: "networkidle" });
});

await step(page, "Catalog picker open", async () => {
  const verkoopTab = page.getByRole("tab", { name: /verkoop/i }).first();
  if (await verkoopTab.count()) await verkoopTab.click();
  await page.waitForTimeout(400);
});

await step(page, "Offerte document dialog", async () => {
  const btn = page.getByRole("button", { name: /bekijk offerte/i }).first();
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(700);
});

await step(page, "Sluit dialog en open operatie", async () => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const operatieTab = page.getByRole("tab", { name: /operatie/i }).first();
  if (await operatieTab.count()) await operatieTab.click();
  await page.waitForTimeout(400);
});

await step(page, "Planning agenda", async () => {
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
});

await step(page, "Klantportaal als opdrachtgever", async () => {
  await switchProfile(page, "profile-opdrachtgever");
  await page.goto(`${BASE}/portaal`, { waitUntil: "networkidle" });
});

await step(page, "Offerte preview in portaal", async () => {
  const btn = page.getByRole("button", { name: /bekijk offerte/i }).first();
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(700);
});

await step(page, "Mensen pagina", async () => {
  await switchProfile(page, "profile-super-admin");
  await page.goto(`${BASE}/mensen`, { waitUntil: "networkidle" });
});

await step(page, "Mensen team tab", async () => {
  const teamTab = page.getByRole("tab", { name: /team/i }).first();
  if (await teamTab.count()) await teamTab.click();
  await page.waitForTimeout(400);
});

// Mobile execution
await context.close();
const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  recordVideo: {
    dir: OUTPUT_DIR,
    size: { width: 390, height: 844 },
  },
});
const mobilePage = await mobileContext.newPage();
await mobilePage.goto(`${BASE}/`, { waitUntil: "networkidle" });
await mobilePage.evaluate(() => {
  const id = "profile-monteur";
  const raw = localStorage.getItem("opero-demo-state-3phase-v1");
  const parsed = raw
    ? JSON.parse(raw)
    : { state: { activeProfileId: id }, version: 0 };
  parsed.state.activeProfileId = id;
  localStorage.setItem("opero-demo-state-3phase-v1", JSON.stringify(parsed));
});
await mobilePage.reload({ waitUntil: "networkidle" });

stepCounter = 50;
await step(mobilePage, "Mobile dashboard monteur", async () => {
  await mobilePage.goto(`${BASE}/`, { waitUntil: "networkidle" });
});

await step(mobilePage, "Mobile werkbon", async () => {
  await mobilePage.goto(`${BASE}/execution`, { waitUntil: "networkidle" });
});

await step(mobilePage, "Bottom sheet acties", async () => {
  const more = mobilePage.getByRole("button", { name: /meer acties/i }).first();
  if (await more.count()) await more.click();
  await mobilePage.waitForTimeout(700);
});

await mobileContext.close();
await browser.close();

console.log("\n✅ Klaar. Bestanden in:", OUTPUT_DIR);
