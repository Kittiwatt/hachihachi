import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:8765/');
await page.fill('form[data-form=create] input[name=name]', 'Léaxel');
await page.click('[data-act=solo]');
await page.waitForSelector('.seats');
await page.screenshot({ path: '/tmp/s1_lobby.png' });
await page.click('[data-act=start]');
await page.waitForSelector('.table');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/s2_table.png' });
// jouer automatiquement quelques manches : cliquer la première action disponible
let clicks = 0, rounds = 0;
for (let i = 0; i < 400 && rounds < 3; i++) {
  const next = await page.$('[data-act=next]');
  if (next) { rounds++; await page.screenshot({ path: `/tmp/s3_result_${rounds}.png` }); await next.click({ force: true }); await page.waitForTimeout(300); continue; }
  const sel = ['[data-act^="drop:play"]', '[data-act="shoubu"]', '.river .card.choice', '.hand .card.playable'];
  let done = false;
  for (const s of sel) { const el = await page.$(s); if (el) { await el.click({ force: true }); clicks++; done = true; break; } }
  await page.waitForTimeout(done ? 250 : 400);
}
await page.screenshot({ path: '/tmp/s4_end.png' });
console.log('clics', clicks, 'manches', rounds, 'erreurs', errors.length); [...new Set(errors)].slice(0, 8).forEach(e => console.log(' ', e));
await browser.close();
