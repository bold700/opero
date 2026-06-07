import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('http://localhost:3100/projects', { waitUntil: 'networkidle' });

await p.getByRole('button', { name: /nieuw project|project aanmaken|nieuw/i }).first().click().catch(()=>{});
await p.waitForTimeout(400);
for (const s of await p.locator('select').all()) {
  const opts = await s.locator('option').all();
  if (opts.length > 1) await s.selectOption({ index: 1 });
}
await p.getByPlaceholder(/geef het project een naam/i).first().fill('Afrond test').catch(()=>{});
await p.getByRole('button', { name: /aanmaken|opslaan|maak/i }).last().click().catch(()=>{});
await p.waitForTimeout(900);

// add zone
await p.getByRole('button', { name: /taak aanmaken/i }).first().click().catch(()=>{});
await p.waitForTimeout(600);
// add a regel via dialog
await p.getByRole('button', { name: /taak toevoegen/i }).first().click().catch(()=>{});
await p.waitForTimeout(400);
await p.locator('[role=dialog] select').first().selectOption({ index: 1 }).catch(()=>{});
await p.locator('[role=dialog]').getByRole('button', { name: /taak toevoegen/i }).click().catch(()=>{});
await p.waitForTimeout(600);

// button styling
const btnInfo = await p.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Werkbon afronden');
  if (!b) return { found: false };
  const cs = getComputedStyle(b);
  return { found: true, bg: cs.backgroundColor, color: cs.color };
});
console.log('Button:', JSON.stringify(btnInfo));

// click afronden -> expect dialog
await p.getByRole('button', { name: 'Werkbon afronden' }).click();
await p.waitForTimeout(400);
const dlg = await p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  return d ? d.textContent : null;
});
console.log('Dialog text:', dlg);

// confirm
await p.getByRole('button', { name: /alles afvinken en afronden/i }).click().catch(e=>console.log('no confirm btn'));
await p.waitForTimeout(700);

// after: stage should be done, check the checkbox state of the regel
const after = await p.evaluate(() => {
  const cb = document.querySelector('button[role=checkbox]');
  const badge = Array.from(document.querySelectorAll('[data-slot=badge]')).map(b=>b.textContent.trim());
  return { checkboxState: cb ? cb.getAttribute('data-state') : 'none', badges: badge };
});
console.log('After confirm:', JSON.stringify(after));
await b.close();
