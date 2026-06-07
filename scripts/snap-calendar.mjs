import { chromium } from "playwright";

const BASE = process.env.OPERO_URL ?? "http://localhost:3001";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(`${BASE}/projects/p-001`, { waitUntil: "networkidle" });
const operatieTab = page.getByRole("tab", { name: /operatie/i }).first();
if (await operatieTab.count()) {
  await operatieTab.click();
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: "demo-recordings/calendar-fix.png" });
await browser.close();
console.log("✓");
