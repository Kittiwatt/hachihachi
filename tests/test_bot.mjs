// test_bot.mjs — le bot termine des parties complètes de 2 à 6 joueurs, jamais d'action illégale.
import assert from 'node:assert/strict';
import * as H from '../core.js';
import { botAction } from '../bot.js';
function rnd(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
let games = 0, rounds = 0, t0 = Date.now();
const wins = {};
for (const N of [2, 3, 4, 5, 6]) for (let seed = 1; seed <= 12; seed++) {
  const g = H.newGame({ players: Array.from({ length: N }, (_, i) => ({ id: 'p' + (i + 1), name: 'Bot ' + (i + 1), bot: true })), seed, settings: { rounds: 12, variants: { liability: seed % 2 === 0, inoshikachou: seed % 3 === 0 } } });
  const R = rnd(seed * 7 + N); let steps = 0;
  while (!g.finished) {
    if (!g.round || g.round.phase === 'end') { H.startRound(g); continue; }
    const r = g.round;
    const pid = r.phase === 'dropout' ? r.dropout.order[r.dropout.idx] : r.turn.pid;
    const a = botAction(H.viewFor(g, pid), R);
    assert.ok(a, 'le bot ne propose rien');
    H.applyAction(g, pid, a);
    assert.equal(Object.values(g.scores).reduce((x, y) => x + y, 0) + g.round.pot + g.pot, 0);
    if (++steps > 20000) throw new Error('boucle');
  }
  games++; rounds += g.history.length;
  const hows = {}; g.history.forEach(h => hows[h.how] = (hows[h.how] || 0) + 1);
  if (seed === 1) console.log(`${N} joueurs :`, JSON.stringify(hows), '| scores', Object.values(g.scores).join(' '));
}
console.log(`${games} parties, ${rounds} manches en ${Date.now() - t0} ms — OK`);
