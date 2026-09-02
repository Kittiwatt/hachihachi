import { chromium } from 'playwright';
const browser = await chromium.launch();
const A = await (await browser.newContext()).newPage({ viewport: { width: 1300, height: 800 } });
const B = await (await browser.newContext()).newPage({ viewport: { width: 1300, height: 800 } });
const errs = { A: [], B: [] };
A.on('pageerror', e => errs.A.push(e.message)); B.on('pageerror', e => errs.B.push(e.message));
A.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.A.push('console ' + m.text().slice(0, 160)); });
const t0 = Date.now();
await A.goto('http://localhost:8765/');
await A.fill('form[data-form=create] input[name=name]', 'Alice');
await A.click('[data-act=create]');
await A.waitForSelector('.code', { timeout: 30000 });
const code = (await A.textContent('.code')).trim();
console.log('code', code, 'après', Date.now() - t0, 'ms');
await B.goto('http://localhost:8765/#' + code);
await B.fill('form[data-form=join] input[name=name]', 'Bob');
await B.click('[data-act=join]');
try {
  await A.waitForFunction(() => document.querySelectorAll('.seats li').length >= 2, null, { timeout: 60000 });
  console.log('Bob est dans le salon de Alice après', Date.now() - t0, 'ms');
  await B.waitForSelector('.seats', { timeout: 30000 });
  console.log('Bob voit le salon :', (await B.textContent('.seats')).replace(/\s+/g, ' ').trim());
  await A.click('[data-act=addbot]');
  await A.waitForFunction(() => document.querySelectorAll('.seats li').length >= 3);
  await A.click('[data-act=start]');
  await A.waitForSelector('.table'); await B.waitForSelector('.table', { timeout: 20000 });
  console.log('table chez les deux après', Date.now() - t0, 'ms');
  // jouer quelques tours : chacun clique quand c'est à lui
  let steps = 0;
  for (let i = 0; i < 60 && steps < 12; i++) {
    for (const [nm, P] of [['A', A], ['B', B]]) {
      for (const s of ['[data-act^="drop:play"]', '[data-act="shoubu"]', '.river .card.choice', '.hand .card.playable']) {
        const el = await P.$(s); if (el) { await el.click({ force: true }); steps++; break; }
      }
    }
    await A.waitForTimeout(400);
  }
  const state = await B.evaluate(() => { const r = window.HH.view.round; return { turnNo: r.turnNo, me: window.HH.view.me, hand: r.hand.length, caps: Object.fromEntries(Object.entries(r.captures).map(([k, v]) => [k, v.length])) }; });
  console.log('état vu par Bob :', JSON.stringify(state), 'coups', steps);
  await B.fill('.chat input', 'coucou'); await B.press('.chat input', 'Enter');
  await A.waitForFunction(() => document.querySelector('.chat .msgs') && document.querySelector('.chat .msgs').textContent.includes('coucou'), null, { timeout: 10000 });
  console.log('chat OK');
  await A.screenshot({ path: '/tmp/p2p_A.png' }); await B.screenshot({ path: '/tmp/p2p_B.png' });
} catch (e) { console.log('ÉCHEC :', e.message.split('\n')[0]); await A.screenshot({ path: '/tmp/p2p_A_fail.png' }); await B.screenshot({ path: '/tmp/p2p_B_fail.png' }); }
console.log('erreurs A', errs.A.slice(0, 4), 'erreurs B', errs.B.slice(0, 4));
await browser.close();
