// test_core.mjs — tests du moteur. Usage : node test_core.mjs
import assert from 'node:assert/strict';
import { CARDS } from '../cards.js';
import * as H from '../core.js';

const C = code => { const c = CARDS.find(x => x.code === code); if (!c) throw new Error('code ' + code); return c.id; };
const ids = (...codes) => codes.map(C);
let n = 0; const ok = (name, f) => { f(); n++; console.log('  ok', name); };

console.log('Teyaku');
ok('shisou 20 (carré + brelan)', () => {
  const t = H.detectTeyaku(ids('01-pin-lumiere-grue','01-pin-ruban-poeme','01-pin-normale-1','01-pin-normale-2','05-iris-animal-pont','05-iris-ruban-rouge','05-iris-normale-1'));
  assert.equal(t.A.key, 'shisou'); assert.equal(t.A.value, 20); assert.equal(t.A.hasFour, true); assert.deepEqual(t.A.tripletMonths, [5]);
});
ok('ichinishi 8 (carré + paire + seule, 7 cartes montrées)', () => {
  const t = H.detectTeyaku(ids('01-pin-lumiere-grue','01-pin-ruban-poeme','01-pin-normale-1','01-pin-normale-2','02-abricotier-normale-1','02-abricotier-normale-2','08-susuki-lumiere-lune'));
  assert.equal(t.A.key, 'ichinishi'); assert.equal(t.A.cards.length, 7);
});
ok('teshi 6', () => {
  const t = H.detectTeyaku(ids('01-pin-lumiere-grue','01-pin-ruban-poeme','01-pin-normale-1','01-pin-normale-2','02-abricotier-normale-1','03-cerisier-normale-1','08-susuki-lumiere-lune'));
  assert.equal(t.A.key, 'teshi'); assert.equal(t.A.value, 6);
});
ok('kuttsuki 4 (trois paires)', () => {
  const t = H.detectTeyaku(ids('01-pin-normale-1','01-pin-normale-2','02-abricotier-normale-1','02-abricotier-normale-2','03-cerisier-normale-1','03-cerisier-normale-2','08-susuki-lumiere-lune'));
  assert.equal(t.A.key, 'kuttsuki');
});
ok('haneken 7 (brelan + deux paires)', () => {
  const t = H.detectTeyaku(ids('01-pin-normale-1','01-pin-normale-2','01-pin-ruban-poeme','02-abricotier-normale-1','02-abricotier-normale-2','03-cerisier-normale-1','03-cerisier-normale-2'));
  assert.equal(t.A.key, 'haneken'); assert.deepEqual(t.A.tripletMonths, [1]);
});
ok('futatatesanbon 8 / sanbontatesanbon 7 / futasanbon 6', () => {
  assert.equal(H.detectTeyaku(ids('04-glycine-animal-coucou','04-glycine-ruban-rouge','04-glycine-normale-1','05-iris-animal-pont','05-iris-ruban-rouge','05-iris-normale-1','08-susuki-lumiere-lune')).A.key, 'futatatesanbon');
  assert.equal(H.detectTeyaku(ids('01-pin-lumiere-grue','01-pin-ruban-poeme','01-pin-normale-1','05-iris-animal-pont','05-iris-ruban-rouge','05-iris-normale-1','08-susuki-lumiere-lune')).A.key, 'sanbontatesanbon');
  assert.equal(H.detectTeyaku(ids('01-pin-lumiere-grue','01-pin-ruban-poeme','01-pin-normale-1','02-abricotier-normale-1','02-abricotier-normale-2','02-abricotier-ruban-poeme','08-susuki-lumiere-lune')).A.key, 'futasanbon');
});
ok('brelan debout Paulownia = 3 écailles seulement', () => {
  assert.equal(H.detectTeyaku(ids('12-paulownia-normale-1','12-paulownia-normale-2','12-paulownia-normale-3-jaune','01-pin-lumiere-grue','02-abricotier-animal-bouscarle','03-cerisier-lumiere-rideau','08-susuki-lumiere-lune')).A.key, 'tatesanbon');
  assert.equal(H.detectTeyaku(ids('12-paulownia-normale-1','12-paulownia-normale-2','12-paulownia-lumiere-phoenix','01-pin-lumiere-grue','02-abricotier-animal-bouscarle','03-cerisier-lumiere-rideau','08-susuki-lumiere-lune')).A.key, 'sanbon');
});
ok('groupe B : karasu / pikaichi / toichi / tanichi / aka, Saule = écaille', () => {
  assert.equal(H.detectTeyaku(ids('01-pin-normale-1','02-abricotier-normale-1','03-cerisier-normale-1','04-glycine-normale-1','05-iris-normale-1','06-pivoine-normale-1','11-saule-ruban-rouge')).B.key, 'karasu');
  assert.equal(H.detectTeyaku(ids('01-pin-normale-1','02-abricotier-normale-1','03-cerisier-normale-1','04-glycine-normale-1','05-iris-normale-1','11-saule-lumiere-homme-au-parapluie','08-susuki-lumiere-lune')).B.key, 'pikaichi');
  assert.equal(H.detectTeyaku(ids('01-pin-normale-1','02-abricotier-normale-1','03-cerisier-normale-1','04-glycine-normale-1','05-iris-normale-1','11-saule-animal-hirondelle','10-erable-animal-cerf')).B.key, 'toichi');
  assert.equal(H.detectTeyaku(ids('01-pin-normale-1','02-abricotier-normale-1','03-cerisier-normale-1','04-glycine-normale-1','05-iris-normale-1','11-saule-ruban-rouge','06-pivoine-ruban-bleu')).B.key, 'tanichi');
  assert.equal(H.detectTeyaku(ids('01-pin-normale-1','02-abricotier-normale-1','03-cerisier-normale-1','04-glycine-normale-1','05-iris-normale-1','09-chrysantheme-ruban-bleu','06-pivoine-ruban-bleu')).B.key, 'aka');
  assert.equal(H.detectTeyaku(ids('01-pin-normale-1','02-abricotier-normale-1','03-cerisier-normale-1','04-glycine-normale-1','05-iris-animal-pont','09-chrysantheme-ruban-bleu','06-pivoine-ruban-bleu')).B, null);
});
ok('la combinaison unique : Quatre-trois + Main vide = 24 kan', () => {
  const t = H.detectTeyaku(ids('11-saule-lumiere-homme-au-parapluie','11-saule-animal-hirondelle','11-saule-ruban-rouge','11-saule-normale-foudre','12-paulownia-normale-1','12-paulownia-normale-2','12-paulownia-normale-3-jaune'));
  assert.equal(t.A.key, 'shisou'); assert.equal(t.B.key, 'karasu'); assert.equal(t.total, 24);
});
ok('aucun teyaku', () => {
  const t = H.detectTeyaku(ids('01-pin-lumiere-grue','02-abricotier-animal-bouscarle','03-cerisier-lumiere-rideau','04-glycine-animal-coucou','05-iris-animal-pont','06-pivoine-animal-papillons','07-lespedeza-animal-sanglier'));
  assert.equal(t.total, 0);
});

console.log('Dekiyaku');
const BR = ['01-pin-lumiere-grue','03-cerisier-lumiere-rideau','08-susuki-lumiere-lune','12-paulownia-lumiere-phoenix','11-saule-lumiere-homme-au-parapluie'];
ok('gokou 12, shikou 10, 4 lumières avec la Pluie = rien', () => {
  assert.deepEqual(H.detectDekiyaku(ids(...BR)).list.map(y => y.key), ['gokou']);
  assert.deepEqual(H.detectDekiyaku(ids(...BR.slice(0, 4))).list.map(y => y.key), ['shikou']);
  assert.equal(H.detectDekiyaku(ids(BR[0], BR[1], BR[2], BR[4])).total, 0);
});
const RIB = ['01-pin-ruban-poeme','02-abricotier-ruban-poeme','03-cerisier-ruban-poeme','04-glycine-ruban-rouge','05-iris-ruban-rouge','06-pivoine-ruban-bleu','07-lespedeza-ruban-rouge','09-chrysantheme-ruban-bleu','10-erable-ruban-bleu','11-saule-ruban-rouge'];
ok('nanatan : 7 hors Saule ; Saule ne compte pas ; variante +1', () => {
  assert.equal(H.detectDekiyaku(ids(...RIB.slice(0, 7))).list.find(y => y.key === 'nanatan').value, 10);
  assert.equal(H.detectDekiyaku(ids(...RIB.slice(0, 6), RIB[9])).list.some(y => y.key === 'nanatan'), false);
  assert.equal(H.detectDekiyaku(ids(...RIB.slice(0, 7), RIB[9]), { nanatanPlus: true }).list.find(y => y.key === 'nanatan').value, 11);
  assert.equal(H.detectDekiyaku(ids(...RIB.slice(0, 7), RIB[9])).list.find(y => y.key === 'nanatan').value, 10);
});
ok('akatan + aotan cumulés (14), inoshikachou seulement en variante', () => {
  const d = H.detectDekiyaku(ids(...RIB.slice(0, 3), RIB[5], RIB[7], RIB[8]));
  assert.equal(d.total, 14);
  const isc = ids('07-lespedeza-animal-sanglier','10-erable-animal-cerf','06-pivoine-animal-papillons');
  assert.equal(H.detectDekiyaku(isc).total, 0);
  assert.equal(H.detectDekiyaku(isc, { inoshikachou: true }).total, 7);
});
ok('compensation de main (oikomi)', () => {
  // brelan de pin (2 kan) + 2 lumières hors teyaku + ruban bleu
  const c = H.handCompensation(ids('01-pin-lumiere-grue','01-pin-normale-1','01-pin-normale-2','03-cerisier-lumiere-rideau','08-susuki-lumiere-lune','06-pivoine-ruban-bleu','04-glycine-normale-1'));
  assert.equal(c.teyakuHalfKan, 1); assert.equal(c.dekiHalfKan, 0); assert.equal(c.contribCards, 3);
});

console.log('Scoring (états construits)');
function mk(N, seed = 7, settings = {}) {
  const g = H.newGame({ players: Array.from({ length: N }, (_, i) => ({ id: 'p' + (i + 1), name: 'J' + (i + 1) })), settings, seed });
  H.startRound(g);
  if (N >= 4) { g.round.dropout.order.forEach((p, i) => { if (i < 3) H.applyAction(g, p, { type: 'dropout', choice: 'play' }); }); }
  return g;
}
function setCaptures(g, caps, mult = 1) {
  const r = g.round; r.mult = mult;
  for (const p of r.active) { r.hands[p] = []; r.captures[p] = caps[p] ? ids(...caps[p]) : []; r.teyaku = {}; }
  r.active.forEach(p => { r.dekiyaku[p] = H.detectDekiyaku(r.captures[p], g.settings.variants); });
}
const CH = ['01-pin-normale-1','01-pin-normale-2','02-abricotier-normale-1','02-abricotier-normale-2','03-cerisier-normale-1','03-cerisier-normale-2','04-glycine-normale-1','04-glycine-normale-2','05-iris-normale-1','05-iris-normale-2','06-pivoine-normale-1','06-pivoine-normale-2','07-lespedeza-normale-1','07-lespedeza-normale-2','08-susuki-normale-1','08-susuki-normale-2','09-chrysantheme-normale-1','09-chrysantheme-normale-2','10-erable-normale-1','10-erable-normale-2','12-paulownia-normale-1','12-paulownia-normale-2','12-paulownia-normale-3-jaune','11-saule-normale-foudre'];
ok('sans dekiyaku : (pts − 88) × mult, vainqueur = plus de points', () => {
  const g = mk(3);
  // p1 : 2 lumières + 3 animaux + 4 rubans (2 poèmes, 2 bleus) + 10 écailles = 100 ; p2 : 3 lum. + 2 anim. + 8 éc. = 88 ; p3 : 4 anim. + 6 rubans + 6 éc. = 76
  setCaptures(g, { p1: [BR[0], BR[1], '02-abricotier-animal-bouscarle','04-glycine-animal-coucou','05-iris-animal-pont', RIB[0], RIB[1], RIB[5], RIB[7], ...CH.slice(0, 10)],
                   p2: [BR[2], BR[3], BR[4], '07-lespedeza-animal-sanglier','08-susuki-animal-oies', ...CH.slice(10, 18)],
                   p3: ['06-pivoine-animal-papillons','09-chrysantheme-animal-coupe-de-sake','10-erable-animal-cerf','11-saule-animal-hirondelle', RIB[2], RIB[3], RIB[4], RIB[6], RIB[8], RIB[9], ...CH.slice(18, 24)] }, 2);
  const before = { ...g.scores };
  H._t.endRound(g, 'exhausted', null);
  const r = g.round;
  assert.equal(r.result.pts.p1, 100); assert.equal(r.result.pts.p2, 88); assert.equal(r.result.pts.p3, 76);
  assert.equal(g.scores.p1 - before.p1, 24); assert.equal(g.scores.p3 - before.p3, -24); assert.equal(g.scores.p2, before.p2);
  assert.equal(r.result.winner, 'p1'); assert.equal(g.dealer, 0);
});
ok('Tous-les-Huit : le donneur encaisse 10 kan de chacun', () => {
  const g = mk(3);
  setCaptures(g, { p1: [BR[0], BR[1], '02-abricotier-animal-bouscarle','04-glycine-animal-coucou', RIB[3], ...CH.slice(0, 3)],       // 40+20+5+3 = 68 ... on ajuste
                   p2: [], p3: [] });
  const r = g.round;
  // 88 exactement pour chacun : 1 lumière + 4 animaux + 4 rubans + 8 écailles = 20+40+20+8
  r.captures.p1 = ids(BR[0], '02-abricotier-animal-bouscarle','04-glycine-animal-coucou','05-iris-animal-pont','06-pivoine-animal-papillons', RIB[0], RIB[1], RIB[2], RIB[3], ...CH.slice(0, 8));
  r.captures.p2 = ids(BR[1], '07-lespedeza-animal-sanglier','08-susuki-animal-oies','09-chrysantheme-animal-coupe-de-sake','10-erable-animal-cerf', RIB[4], RIB[5], RIB[6], RIB[7], ...CH.slice(8, 16));
  r.captures.p3 = ids(BR[2], BR[3], BR[4], '11-saule-animal-hirondelle', RIB[8], RIB[9], ...CH.slice(16, 24)); // 60+10+10+8 = 88
  r.active.forEach(p => { r.dekiyaku[p] = { list: [], total: 0 }; });
  const dealer = r.roundDealer;
  H._t.endRound(g, 'exhausted', null);
  assert.equal(r.result.special, 'Tous-les-Huit');
  assert.equal(g.scores[dealer], 200);
});
ok('Double-Huit : 10 kan + 1 par point au-delà de 168', () => {
  const g = mk(3);
  // 4 lumières AVEC la Pluie (pas de Quatre Lumières) + 9 animaux = 80 + 90 = 170, aucun dekiyaku
  setCaptures(g, { p1: [BR[0], BR[1], BR[2], BR[4], '02-abricotier-animal-bouscarle','04-glycine-animal-coucou','05-iris-animal-pont','06-pivoine-animal-papillons','07-lespedeza-animal-sanglier','08-susuki-animal-oies','09-chrysantheme-animal-coupe-de-sake','10-erable-animal-cerf','11-saule-animal-hirondelle'], p2: [], p3: [] });
  H._t.endRound(g, 'exhausted', null);
  assert.equal(g.round.result.special, 'Double-Huit'); assert.equal(g.scores.p1, 240); assert.equal(g.scores.p2, -120);
});
ok('Seize Écailles : 12 kan + 2 par écaille au-delà (Saule compte)', () => {
  const g = mk(3);
  setCaptures(g, { p1: [...CH.slice(0, 16), '11-saule-ruban-rouge'], p2: [], p3: [] });   // 17 écailles B
  H._t.endRound(g, 'exhausted', null);
  assert.equal(g.round.result.special, 'Seize Écailles'); assert.equal(g.scores.p1, 280);
});
ok('shoubu : total des dekiyaku payé par chacun ; sage adverse paie double, l’autre rien', () => {
  const g = mk(3);
  setCaptures(g, { p1: [...BR.slice(0, 4), ...RIB.slice(0, 3)], p2: [RIB[5]], p3: [] }, 2);   // shikou 10 + akatan 7 = 17
  g.round.sage.p2 = 3;
  H._t.endRound(g, 'shoubu', 'p1');
  assert.equal(g.scores.p1, 17 * 10 * 2 * 2); assert.equal(g.scores.p2, -680); assert.equal(g.scores.p3, 0);
});
ok('annulation : moitié de chacun ; mains épuisées : moitié pour tous, vainqueur = premier sage', () => {
  let g = mk(3);
  setCaptures(g, { p1: [...RIB.slice(0, 3)], p2: [], p3: [] });
  H._t.endRound(g, 'cancel', 'p1');
  assert.equal(g.scores.p1, 70); assert.equal(g.scores.p2, -35);
  g = mk(3);
  setCaptures(g, { p1: [...RIB.slice(0, 3)], p2: [RIB[5], RIB[7], RIB[8]], p3: [] });
  g.round.firstSage = 'p2'; g.round.sage = { p2: 1, p1: 4 };
  H._t.endRound(g, 'exhausted', null);
  assert.equal(g.scores.p1, 35); assert.equal(g.scores.p2, 35); assert.equal(g.scores.p3, -70); assert.equal(g.round.result.winner, 'p2');
});
ok('deux joueurs : différence de points × mult, pas de cas spéciaux', () => {
  const g = mk(2);
  setCaptures(g, { p1: [...CH.slice(0, 16), '11-saule-ruban-rouge'], p2: [BR[0]] }, 4);   // 21 vs 20 -> pas de Seize Écailles
  H._t.endRound(g, 'exhausted', null);
  assert.equal(g.round.result.special, null); assert.equal(g.scores.p1, 4); assert.equal(g.scores.p2, -4);
});
ok('teyaku payés en fin de manche + Plongeon + Évasion', () => {
  const g = mk(3);
  setCaptures(g, { p1: ['01-pin-lumiere-grue','01-pin-ruban-poeme','01-pin-normale-1','01-pin-normale-2', ...CH.slice(2, 10)],
                   p2: [BR[1], BR[2], BR[3], BR[4], '02-abricotier-animal-bouscarle', RIB[3], ...CH.slice(10, 14)],   // 80+10+5+4 = 99
                   p3: [] });
  const r = g.round;
  r.teyaku.p1 = { A: { key: 'sanbon', name: 'Brelan', value: 2, hasFour: false, tripletMonths: [1], cards: [] }, B: null, total: 2 };
  r.teyaku.p2 = { A: null, B: { key: 'karasu', name: 'Main vide', value: 4, cards: [] }, total: 4 };
  H._t.endRound(g, 'exhausted', null);
  const labels = r.payments.map(p => p.label);
  assert.ok(labels.includes('Plongeon') && labels.includes('Évasion'));
  // p1 : +2 kan ×2 (teyaku) +1 kan ×2 (plongeon) −4 (teyaku p2) −1 (évasion) ; points : p1 32, p2 99, p3 0 → deltas −56, +11, −88... p3 reçoit rien
  assert.equal(g.scores.p1 + g.scores.p2 + g.scores.p3, 0);
});

console.log('Phase d’abandon');
ok('pénalités 1 / 1,5 / 2 kan × mult au pot ; le vainqueur ramasse ; OYA = premier volontaire', () => {
  const g = mk(5);  // mk fait jouer les 3 premiers
  assert.equal(g.round.phase, 'play'); assert.equal(g.round.active.length, 3);
  assert.deepEqual(g.round.dropout.forced, g.round.dropout.order.slice(3));
  const g2 = H.newGame({ players: [1,2,3,4,5].map(i => ({ id: 'p' + i, name: 'J' + i })), seed: 3 });
  H.startRound(g2); g2.round.mult = 2;
  const o = g2.round.dropout.order;
  H.applyAction(g2, o[0], { type: 'dropout', choice: 'drop' });
  H.applyAction(g2, o[1], { type: 'dropout', choice: 'drop' });
  H.applyAction(g2, o[2], { type: 'dropout', choice: 'play' });
  H.applyAction(g2, o[3], { type: 'dropout', choice: 'play' });
  H.applyAction(g2, o[4], { type: 'dropout', choice: 'play' });
  assert.equal(g2.round.pot, (1 + 1.5) * 10 * 2); assert.equal(g2.scores[o[0]], -20); assert.equal(g2.scores[o[1]], -30);
  assert.equal(g2.round.roundDealer, o[2]); assert.equal(g2.round.order[0], o[2]);
  assert.equal(g2.round.draw.length, 48 - 21 - 6);
});
ok('un seul volontaire rafle le pot, personne = fausse donne', () => {
  let g = H.newGame({ players: [1,2,3,4].map(i => ({ id: 'p' + i, name: 'J' + i })), seed: 11 });
  H.startRound(g); g.round.mult = 1;
  const o = g.round.dropout.order;
  H.applyAction(g, o[0], { type: 'dropout', choice: 'drop' }); H.applyAction(g, o[1], { type: 'dropout', choice: 'drop' });
  H.applyAction(g, o[2], { type: 'dropout', choice: 'drop' }); H.applyAction(g, o[3], { type: 'dropout', choice: 'play' });
  assert.equal(g.round.phase, 'end'); assert.equal(g.scores[o[3]], 45); assert.equal(g.month, 2);
  g = H.newGame({ players: [1,2,3,4].map(i => ({ id: 'p' + i, name: 'J' + i })), seed: 12 });
  H.startRound(g); g.round.mult = 1;
  g.round.dropout.order.forEach(p => H.applyAction(g, p, { type: 'dropout', choice: 'drop' }));
  assert.equal(g.round.phase, 'dropout'); assert.equal(g.month, 1); assert.equal(g.round.pot, 70);
});
ok('forcedThree : impossible de passer quand il ne reste que trois', () => {
  const g = H.newGame({ players: [1,2,3,4].map(i => ({ id: 'p' + i, name: 'J' + i })), seed: 5, settings: { variants: { forcedThree: true } } });
  H.startRound(g);
  const o = g.round.dropout.order;
  H.applyAction(g, o[0], { type: 'dropout', choice: 'drop' });
  assert.deepEqual(H.legalActions(g, o[1]).map(a => a.choice), ['play']);
  assert.throws(() => H.applyAction(g, o[1], { type: 'dropout', choice: 'drop' }));
});

console.log('Simulations complètes (actions légales aléatoires)');
function rnd(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
for (const N of [2, 3, 4, 5, 6]) {
  ok(`${N} joueurs × 20 parties : somme nulle, 48 cartes, fin de partie`, () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = H.newGame({ players: Array.from({ length: N }, (_, i) => ({ id: 'p' + (i + 1), name: 'J' + (i + 1) })), seed, settings: { rounds: 6, variants: { liability: seed % 2 === 0, inoshikachou: seed % 3 === 0, nanatanPlus: true } } });
      const R = rnd(seed * 31 + N); let steps = 0;
      while (!g.finished) {
        if (!g.round || g.round.phase === 'end') H.startRound(g);
        const r = g.round;
        if (r.phase === 'end') continue;
        const pid = r.phase === 'dropout' ? r.dropout.order[r.dropout.idx] : r.turn.pid;
        const acts = H.legalActions(g, pid);
        assert.ok(acts.length > 0, 'aucune action légale');
        H.applyAction(g, pid, acts[Math.floor(R() * acts.length)]);
        const total = Object.values(g.scores).reduce((a, b) => a + b, 0) + (g.round.pot || 0) + (g.pot || 0);
        assert.equal(total, 0, 'somme non nulle');
        if (g.round.phase === 'play') {
          const all = [...g.round.field, ...g.round.draw, ...Object.values(g.round.hands).flat(), ...Object.values(g.round.captures).flat(), ...(g.round.turn.pending ? [g.round.turn.pending.card] : [])];
          assert.equal(all.length, 48); assert.equal(new Set(all).size, 48);
        }
        if (++steps > 5000) throw new Error('boucle');
      }
      assert.equal(g.history.length, 6);
      for (const p of g.players) { const v = H.viewFor(g, p.id); assert.ok(Array.isArray(v.round.hand) && !('hands' in v.round)); }
    }
  });
}
ok('vue filtrée : pas les mains des autres ni la pioche', () => {
  const g = mk(3); const v = H.viewFor(g, 'p2');
  assert.equal(v.round.hand.length, 7); assert.equal(v.round.handCounts.p1, 7); assert.equal(v.round.drawCount, 21);
  assert.ok(!('hands' in v.round) && !('draw' in v.round));
});
console.log(`\n${n} tests OK`);
