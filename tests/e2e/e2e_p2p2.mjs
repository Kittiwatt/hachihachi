import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctxA = await browser.newContext(), ctxB = await browser.newContext();
const A = await ctxA.newPage({ viewport: { width: 1300, height: 800 } });
const B = await ctxB.newPage({ viewport: { width: 1300, height: 800 } });
const errs = []; for (const P of [A, B]) P.on('pageerror', e => errs.push(e.message));
const t0 = Date.now();
await A.goto('http://localhost:8765/'); await A.fill('form[data-form=create] input[name=name]', 'Alice'); await A.click('[data-act=create]');
await A.waitForSelector('.code'); const code = (await A.textContent('.code')).trim();
await B.goto('http://localhost:8765/#' + code); await B.fill('form[data-form=join] input[name=name]', 'Bob'); await B.click('[data-act=join]');
await A.waitForFunction(() => document.querySelectorAll('.seats li').length >= 2, null, { timeout: 60000 });
await A.click('[data-act=addbot]'); await A.waitForFunction(() => document.querySelectorAll('.seats li').length >= 3);
await A.click('[data-act=start]'); await B.waitForSelector('.table', { timeout: 20000 });
const play = async P => { for (const s of ['[data-act^="drop:play"]', '[data-act="shoubu"]', '.river .card.choice', '.hand .card.playable']) { const el = await P.$(s); if (el) { await el.click({ force: true }); return true; } } return false; };
for (let i = 0; i < 6; i++) { await play(A); await play(B); await A.waitForTimeout(400); }
const before = await B.evaluate(() => ({ me: window.HH.view.me, turnNo: window.HH.view.round.turnNo, hand: window.HH.view.round.hand.slice() }));
console.log('avant rechargement (Bob) :', JSON.stringify(before));
// 1) Bob recharge sa page et se reconnecte
await B.reload(); await B.waitForSelector('form[data-form=join]');
console.log('code prérempli :', await B.inputValue('form[data-form=join] input[name=code]'), '| pseudo :', await B.inputValue('form[data-form=join] input[name=name]'));
await B.click('[data-act=join]');
await B.waitForSelector('.table', { timeout: 60000 });
const after = await B.evaluate(() => ({ me: window.HH.view.me, turnNo: window.HH.view.round.turnNo, hand: window.HH.view.round.hand.slice() }));
console.log('après reconnexion (Bob) :', JSON.stringify(after), '→', before.me === after.me && before.hand.join() === after.hand.join() ? 'même siège, même main ✓' : 'DIFFÉRENT ✗', Date.now() - t0, 'ms');
const seatsA = await A.evaluate(() => window.HH.lobby.players.map(p => p.name + (p.connected ? '' : '(off)')).join(', '));
console.log('salon côté Alice :', seatsA);
// 2) Alice (hôte) ferme sa page : Bob doit reprendre l'arbitrage
await A.close();
await B.waitForFunction(() => window.HH.session && window.HH.session.isHost, null, { timeout: 30000 });
console.log('Bob est hôte après', Date.now() - t0, 'ms');
await B.waitForTimeout(1500);
const st = await B.evaluate(() => { const v = window.HH.view; return { month: v.round.month, phase: v.round.phase, players: v.players.map(p => p.name), scores: v.scores, log: v.log.slice(-3).map(l => l.text) }; });
console.log('état après migration :', JSON.stringify(st));
// Bob continue à jouer contre le bot (Alice est déconnectée : l'hôte joue pour elle après délai)
let played = 0; for (let i = 0; i < 30 && played < 6; i++) { if (await play(B)) played++; await B.waitForTimeout(500); }
const st2 = await B.evaluate(() => ({ turnNo: window.HH.view.round.turnNo, phase: window.HH.view.round.phase, connected: window.HH.view.connected }));
console.log('après quelques coups :', JSON.stringify(st2), 'coups de Bob', played);
await B.screenshot({ path: '/tmp/p2p_migr.png' });
console.log('erreurs', errs.slice(0, 4));
await browser.close();
