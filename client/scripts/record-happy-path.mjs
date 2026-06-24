import { chromium } from "playwright";
import { mkdir, rename, readdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.OPERO_URL ?? "http://localhost:3001";
const OUTPUT_DIR = join(process.cwd(), "demo-recordings");
const SHOTS_DIR = join(OUTPUT_DIR, "happy-path");

const STORAGE_KEY = "opero-demo-state-3phase-v1";

async function setProfile(page, profileId) {
  await page.evaluate(
    ([id, key]) => {
      const raw = localStorage.getItem(key);
      const parsed = raw
        ? JSON.parse(raw)
        : { state: { activeProfileId: id }, version: 0 };
      parsed.state.activeProfileId = id;
      localStorage.setItem(key, JSON.stringify(parsed));
    },
    [profileId, STORAGE_KEY],
  );
  await page.reload({ waitUntil: "networkidle" });
  // Zustand persist rehydratie is async — wacht tot het juiste profiel in de UI staat
  await page.waitForFunction(
    ([id, key]) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      return JSON.parse(raw).state.activeProfileId === id;
    },
    [profileId, STORAGE_KEY],
  );
  await page.waitForTimeout(800);
}

async function resetState(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
}

let step = 1;
async function snap(page, label) {
  const fileName = `${String(step++).padStart(2, "0")}-${label
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}.png`;
  await page.screenshot({ path: join(SHOTS_DIR, fileName) });
  console.log(`  ✓ ${fileName}`);
}

async function tease(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

await mkdir(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: OUTPUT_DIR,
    size: { width: 1440, height: 900 },
  },
  deviceScaleFactor: 2,
});
const page = await desktop.newPage();

console.log("▶ DESKTOP HAPPY PATH");

// 0. Reset demo data so we always start from a clean slate
await resetState(page);

// 1. Super admin opens dashboard
await setProfile(page, "profile-super-admin");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await tease(page, 1500);
await snap(page, "dashboard-super-admin");

// 2. Show kanban
await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
await tease(page, 1500);
await snap(page, "projects-kanban");

// 3. Switch to Sales
await setProfile(page, "profile-sales");
await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
await tease(page, 1500);
await snap(page, "sales-kanban-only-verkoop");

// 4. Create new aanvraag
const newAanvraag = page.getByRole("button", { name: /nieuwe aanvraag/i }).first();
await newAanvraag.click();
await tease(page, 700);
await snap(page, "new-aanvraag-dialog");

// Pick a customer
const customerSelect = page.locator("#np-customer").first();
await customerSelect.selectOption({ index: 1 });
await page.locator("#np-notes").fill(
  "Klant belt over spouwmuurisolatie voor het kantoorpand. Wil graag snel een prijsindicatie.",
);
await tease(page, 600);
await snap(page, "new-aanvraag-filled");

const submit = page.getByRole("button", { name: /aanvraag aanmaken/i });
await submit.click();
await page.waitForURL(/\/projects\/p-/, { timeout: 5000 });
await tease(page, 1500);
await snap(page, "new-project-overview");

// 5. Switch to project verkoop tab and build offerte
const verkoopTab = page.getByRole("tab", { name: /verkoop/i }).first();
await verkoopTab.click();
await tease(page, 800);
await snap(page, "empty-verkoop");

// Add catalog items by selecting from picker (catalog picker has the "Werk / materiaal toevoegen" option)
const picker = page
  .locator('select[data-slot="select"]')
  .filter({ has: page.locator('option:text("+ Werk / materiaal toevoegen")') })
  .first();
await picker.selectOption("iso-spouwmuur");
await tease(page, 600);
await picker.selectOption("lab-uur");
await tease(page, 600);
await picker.selectOption("log-voorrijden");
await tease(page, 1000);
await snap(page, "catalog-items-added");

// Edit quantities — set m2 to 92 and uren to 16
const quantityInputs = page.locator(
  '.space-y-3 input[type="number"], input[type="number"]',
);
// First numeric input is the qty of the iso line. Get all rows and set the first two to 92 and 16
const rows = page.locator("tbody tr");
const rowCount = await rows.count();
if (rowCount >= 2) {
  const isoQty = rows.nth(0).locator('input[type="number"]').first();
  await isoQty.fill("92");
  await isoQty.blur();
  await tease(page, 400);
  const laborQty = rows.nth(1).locator('input[type="number"]').first();
  await laborQty.fill("16");
  await laborQty.blur();
  await tease(page, 800);
}
await snap(page, "quote-quantities-set");

// Open offerte preview
const bekijkOfferte = page.getByRole("button", { name: /bekijk offerte/i }).first();
await bekijkOfferte.click();
await tease(page, 1200);
await snap(page, "offerte-document-preview");

await page.keyboard.press("Escape");
await tease(page, 600);

// Verstuur offerte via "Volgende stap"
const advance = page.getByRole("button", { name: /verstuur offerte/i }).first();
if (await advance.count()) {
  await advance.click();
  await tease(page, 1500);
  await snap(page, "offerte-verstuurd");
}

// 6. Switch to opdrachtgever in portaal
await setProfile(page, "profile-opdrachtgever");
await page.goto(`${BASE}/portaal`, { waitUntil: "networkidle" });
await tease(page, 1500);
await snap(page, "klantportaal");

// Find the project with sent quote and open offerte
const portaalOfferte = page.getByRole("button", { name: /bekijk offerte/i }).first();
if (await portaalOfferte.count()) {
  await portaalOfferte.click();
  await tease(page, 1500);
  await snap(page, "klantportaal-offerte-met-accepteren");

  const accepteer = page
    .getByRole("button", { name: /offerte accepteren/i })
    .first();
  if (await accepteer.count()) {
    await accepteer.click();
    await tease(page, 1500);
    await snap(page, "klant-accepteert-offerte");
  }
}

// 7. Switch to PM and plan
await setProfile(page, "profile-projectmanager");
await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
await tease(page, 1500);
await snap(page, "planning-overzicht");

// Navigate to the project and plan it
await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
await tease(page, 1200);
await snap(page, "pm-kanban-na-acceptatie");

// Open p-005 which is in operatie status with materials ready
await page.goto(`${BASE}/projects/p-005`, { waitUntil: "networkidle" });
await tease(page, 1500);
const operatieTab = page.getByRole("tab", { name: /operatie/i }).first();
if (await operatieTab.count()) {
  await operatieTab.click();
  await tease(page, 1200);
  await snap(page, "operatie-tab-materialen");

  const planButton = page.getByRole("button", { name: /^plan project$/i }).first();
  if (await planButton.count()) {
    await planButton.click();
    await tease(page, 1500);
    await snap(page, "project-gepland");
  }
}

// 8. Switch to Monteur view (desktop preview first)
await setProfile(page, "profile-monteur");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await tease(page, 1500);
await snap(page, "monteur-dashboard-desktop");

await desktop.close();
console.log("✓ Desktop session opgenomen");

// MOBILE
console.log("▶ MOBILE WERKBON");
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  recordVideo: {
    dir: OUTPUT_DIR,
    size: { width: 390, height: 844 },
  },
});
const m = await mobile.newPage();
await m.goto(`${BASE}/`, { waitUntil: "networkidle" });
await m.evaluate(
  ([id, key]) => {
    const raw = localStorage.getItem(key);
    const parsed = raw
      ? JSON.parse(raw)
      : { state: { activeProfileId: id }, version: 0 };
    parsed.state.activeProfileId = id;
    localStorage.setItem(key, JSON.stringify(parsed));
  },
  ["profile-monteur", STORAGE_KEY],
);
await m.reload({ waitUntil: "networkidle" });
await tease(m, 1200);

step = 50;
await snap(m, "mobile-dashboard");

await m.goto(`${BASE}/execution`, { waitUntil: "networkidle" });
await tease(m, 1500);
await snap(m, "mobile-werkbon");

// Start werk
const startWerk = m.getByRole("button", { name: /start werk/i }).first();
if (await startWerk.count()) {
  await startWerk.click();
  await tease(m, 1200);
  await snap(m, "mobile-werk-gestart");
}

// Open bottom-sheet
const meer = m.getByRole("button", { name: /meer acties/i }).first();
if (await meer.count()) {
  await meer.click();
  await tease(m, 1000);
  await snap(m, "mobile-bottom-sheet");

  // Add foto
  const foto = m.getByRole("button", { name: /^foto$/i }).first();
  if (await foto.count()) {
    await foto.click();
    await tease(m, 1200);
    await snap(m, "mobile-foto-toegevoegd");
  }
}

// Open sheet again, add notitie
await m.getByRole("button", { name: /meer acties/i }).first().click();
await tease(m, 800);
await m.getByRole("button", { name: /^notitie$/i }).first().click();
await tease(m, 700);
await m.locator("textarea").first().fill("Materiaal binnen, werk loopt op schema.");
await tease(m, 600);
await snap(m, "mobile-notitie-dialog");
await m.getByRole("button", { name: /opslaan/i }).first().click();
await tease(m, 1000);

// Add meerwerk
await m.getByRole("button", { name: /meer acties/i }).first().click();
await tease(m, 800);
await m.getByRole("button", { name: /^meerwerk$/i }).first().click();
await tease(m, 700);
await m.locator("#extra-desc").fill("Extra rooster aan de zuidgevel");
await m.locator("#extra-amount").fill("180");
await tease(m, 600);
await snap(m, "mobile-meerwerk-dialog");
await m.getByRole("button", { name: /toevoegen/i }).first().click();
await tease(m, 1000);

// Afronden
const afronden = m
  .getByRole("button", { name: /werk afronden/i })
  .first();
if (await afronden.count()) {
  await afronden.click();
  await tease(m, 1500);
  await snap(m, "mobile-werkbon-afgerond");
}

await mobile.close();
console.log("✓ Mobile session opgenomen");

// 9. Final: admin closes the project on desktop
console.log("▶ ADMIN AFRONDING");
const closing = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: OUTPUT_DIR,
    size: { width: 1440, height: 900 },
  },
  deviceScaleFactor: 2,
});
const a = await closing.newPage();
await a.goto(`${BASE}/`, { waitUntil: "networkidle" });
await a.evaluate(
  ([id, key]) => {
    const raw = localStorage.getItem(key);
    const parsed = raw
      ? JSON.parse(raw)
      : { state: { activeProfileId: id }, version: 0 };
    parsed.state.activeProfileId = id;
    localStorage.setItem(key, JSON.stringify(parsed));
  },
  ["profile-projectmanager", STORAGE_KEY],
);
await a.reload({ waitUntil: "networkidle" });
await tease(a, 1200);

step = 80;
await snap(a, "pm-dashboard");

// PM rondt de oplevercheck af van een afgerond project
await a.goto(`${BASE}/projects/p-009`, { waitUntil: "networkidle" });
await tease(a, 1500);
const afrondingTab = a.getByRole("tab", { name: /afronding/i }).first();
if (await afrondingTab.count()) {
  await afrondingTab.click();
  await tease(a, 1200);
  await snap(a, "oplevercheck-open");
}

// Check off all open delivery items
let safety = 0;
while (safety++ < 10) {
  const open = a.locator(
    'label:has([role="checkbox"][aria-checked="false"])',
  );
  const count = await open.count();
  if (count === 0) break;
  await open.first().click();
  await tease(a, 350);
}
await snap(a, "delivery-checklist-compleet");

const completeDelivery = a
  .getByRole("button", { name: /oplevering afronden/i })
  .first();
if (await completeDelivery.count()) {
  await completeDelivery.click();
  await tease(a, 1500);
  await snap(a, "oplevering-afgerond");
}

// Wissel naar admin om factuur af te handelen
await a.evaluate(
  ([id, key]) => {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw);
    parsed.state.activeProfileId = id;
    localStorage.setItem(key, JSON.stringify(parsed));
  },
  ["profile-administratie", STORAGE_KEY],
);
await a.reload({ waitUntil: "networkidle" });
await tease(a, 1500);
await snap(a, "admin-dashboard-afronding");

await a.goto(`${BASE}/projects/p-009`, { waitUntil: "networkidle" });
await tease(a, 1500);
const adminAfrondingTab = a.getByRole("tab", { name: /afronding/i }).first();
if (await adminAfrondingTab.count()) {
  await adminAfrondingTab.click();
  await tease(a, 1200);
}

const maakConcept = a
  .getByRole("button", { name: /maak factuurconcept/i })
  .first();
if (await maakConcept.count()) {
  await maakConcept.click();
  await tease(a, 1500);
  await snap(a, "factuurconcept-aangemaakt");
}

// Bekijk factuur document
const bekijkFactuur = a
  .getByRole("button", { name: /bekijk factuur/i })
  .first();
if (await bekijkFactuur.count()) {
  await bekijkFactuur.click();
  await tease(a, 1500);
  await snap(a, "factuur-document-preview");
  await a.keyboard.press("Escape");
  await tease(a, 600);
}

// Verstuur factuur
const verstuurFactuur = a
  .getByRole("button", { name: /factuur versturen/i })
  .first();
if (await verstuurFactuur.count()) {
  await verstuurFactuur.click();
  await tease(a, 1500);
  await snap(a, "factuur-verstuurd");
}

// Markeer betaald
const markeerBetaald = a
  .getByRole("button", { name: /markeer betaald/i })
  .first();
if (await markeerBetaald.count()) {
  await markeerBetaald.click();
  await tease(a, 1500);
  await snap(a, "factuur-betaald-project-gesloten");
}

// Eindshot: dashboard met klaargemaakt project
await a.goto(`${BASE}/`, { waitUntil: "networkidle" });
await tease(a, 1500);
await snap(a, "eind-dashboard");

await closing.close();
console.log("✓ Admin session opgenomen");

await browser.close();

// Rename video files for clarity
const files = await readdir(OUTPUT_DIR);
const webms = files.filter((f) => f.endsWith(".webm"));
webms.sort();
const titles = ["happy-path-01-desktop.webm", "happy-path-02-mobile.webm", "happy-path-03-afronding.webm"];
for (let i = 0; i < webms.length && i < titles.length; i++) {
  await rename(join(OUTPUT_DIR, webms[i]), join(OUTPUT_DIR, titles[i]));
  console.log(`  renamed ${webms[i]} → ${titles[i]}`);
}

console.log("\n✅ Klaar. Bestanden in:", OUTPUT_DIR);
