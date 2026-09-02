// core.js — Moteur de règles du Hachi-Hachi (八八). Anofelis, 2026.
// Pur : aucune dépendance DOM ou réseau. Déterministe (RNG à graine).
// Tourne dans le navigateur de l'hôte (arbitre) et dans Node (tests).
// Règles : https://fudawiki.org/en/hanafuda/games/hachi-hachi
import { CARDS } from './cards.js';

export const VERSION = '1.0.0';
export const DEFAULT_SETTINGS = {
  kan: 10,               // 1 kan = 10 pts (décimal) ou 12 (duodécimal)
  rounds: 12,            // nombre de manches (mois)
  variants: {
    inoshikachou: false, // Sanglier-Cerf-Papillons 7 kan (leaflet Nintendo)
    nanatanPlus: false,  // Sept Rubans : +1 kan par ruban supplémentaire (Saule compris)
    liability: false,    // règle de responsabilité (double / rien)
    stackMult: false,    // multiplicateurs cumulés (×32 !) au lieu du report
    forcedThree: false,  // il faut toujours trois joueurs (fin de la phase d'abandon)
    twoPlayerFallback: 'play', // 2 volontaires à 4+ : 'play' (duel) ou 'split' (partage du pot)
  },
};

const BRIGHT4 = ['crane', 'curtain', 'moon', 'phoenix'];
const STANDING_MONTHS = [4, 5, 7];
export const card = id => CARDS[id];
const month = id => CARDS[id].month;
const byId = ids => ids.map(id => CARDS[id]);

// ------------------------------------------------------------------ RNG
function rngNext(g) {                     // mulberry32
  g.rngState = (g.rngState + 0x6D2B79F5) | 0;
  let t = g.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(g, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(g) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------- valeurs & comptes
export function cardPoints(ids) { return byId(ids).reduce((s, c) => s + c.pts, 0); }
// écailles au sens des teyaku B / Seize Écailles : tout le Saule compte écaille
export const isChaffB = c => c.type === 'chaff' || c.month === 11;
export function chaffCountB(ids) { return byId(ids).filter(isChaffB).length; }

// ------------------------------------------------------------- teyaku
export function detectTeyaku(ids) {
  const cards = byId(ids);
  const byMonth = {};
  for (const c of cards) (byMonth[c.month] ||= []).push(c);
  const groups = Object.values(byMonth).map(cs => ({ m: cs[0].month, n: cs.length, cards: cs }));
  const standing = gr => gr.n === 3 && (STANDING_MONTHS.includes(gr.m)
    || (gr.m === 12 && gr.cards.every(c => c.type === 'chaff')));
  const fours = groups.filter(gr => gr.n === 4);
  const trips = groups.filter(gr => gr.n === 3);
  const pairs = groups.filter(gr => gr.n === 2);
  let A = null;
  const setA = (key, name, value, used, extra) => {
    if (!A || value > A.value) A = { key, name, value, cards: used.map(c => c.id), hasFour: false, tripletMonths: [], ...extra };
  };
  const ids4 = fours.flatMap(f => f.cards), ids3 = trips.flatMap(t => t.cards), ids2 = pairs.flatMap(p => p.cards);
  if (fours.length && trips.length) setA('shisou', 'Quatre-trois', 20, [...ids4, ...ids3], { hasFour: true, tripletMonths: trips.map(t => t.m) });
  if (fours.length && pairs.length) setA('ichinishi', 'Un-deux-quatre', 8, cards, { hasFour: true });
  if (trips.length === 2) {
    const st = trips.filter(standing).length;
    if (st === 2) setA('futatatesanbon', 'Deux brelans debout', 8, ids3, { tripletMonths: trips.map(t => t.m) });
    else if (st === 1) setA('sanbontatesanbon', 'Brelan et brelan debout', 7, ids3, { tripletMonths: trips.map(t => t.m) });
    else setA('futasanbon', 'Deux brelans', 6, ids3, { tripletMonths: trips.map(t => t.m) });
  }
  if (trips.length === 1 && pairs.length === 2) setA('haneken', 'Brelan et deux paires', 7, [...ids3, ...ids2], { tripletMonths: [trips[0].m] });
  if (fours.length) setA('teshi', 'Carré', 6, ids4, { hasFour: true });
  if (pairs.length === 3) setA('kuttsuki', 'Trois paires', 4, ids2);
  if (trips.length === 1) {
    if (standing(trips[0])) setA('tatesanbon', 'Brelan debout', 3, ids3, { tripletMonths: [trips[0].m] });
    else setA('sanbon', 'Brelan', 2, ids3, { tripletMonths: [trips[0].m] });
  }
  // Groupe B : tout le Saule est écaille
  const chaff = cards.filter(isChaffB);
  const rib = cards.filter(c => c.type === 'ribbon' && c.month !== 11);
  const ani = cards.filter(c => c.type === 'animal' && c.month !== 11);
  const bri = cards.filter(c => c.type === 'bright' && c.month !== 11);
  let B = null;
  const setB = (key, name, value) => { if (!B || value > B.value) B = { key, name, value, cards: chaff.map(c => c.id) }; };
  if (cards.length === 7) {
    if (chaff.length === 7) setB('karasu', 'Main vide', 4);
    if (bri.length === 1 && chaff.length === 6) setB('pikaichi', 'Une lumière', 4);
    if (ani.length === 1 && chaff.length === 6) setB('toichi', 'Un animal', 3);
    if (rib.length === 1 && chaff.length === 6) setB('tanichi', "Un ruban", 3);
    if (rib.length >= 2 && rib.length + chaff.length === 7) setB('aka', 'Rouge', 2);
  }
  return { A, B, total: (A ? A.value : 0) + (B ? B.value : 0) };
}

// ----------------------------------------------------------- dekiyaku
export const YAKU_SETS = {
  gokou: { name: 'Cinq Lumières', value: 12, test: c => c.type === 'bright', need: 5 },
  shikou: { name: 'Quatre Lumières', value: 10, test: c => BRIGHT4.includes(c.tag), need: 4 },
  akatan: { name: 'Rubans-poèmes', value: 7, test: c => c.tag === 'poetry', need: 3 },
  aotan: { name: 'Rubans bleus', value: 7, test: c => c.tag === 'blue', need: 3 },
  inoshikachou: { name: 'Sanglier-Cerf-Papillons', value: 7, test: c => ['boar', 'deer', 'butterfly'].includes(c.tag), need: 3 },
};
export function detectDekiyaku(ids, variants = {}) {
  const cards = byId(ids);
  const list = [];
  const cnt = key => cards.filter(YAKU_SETS[key].test).length;
  if (cnt('gokou') === 5) list.push({ key: 'gokou', name: YAKU_SETS.gokou.name, value: 12 });
  else if (cnt('shikou') === 4) list.push({ key: 'shikou', name: YAKU_SETS.shikou.name, value: 10 });
  const ribbons = cards.filter(c => c.type === 'ribbon');
  const nonWillow = ribbons.filter(c => c.tag !== 'willowRibbon');
  if (nonWillow.length >= 7) list.push({ key: 'nanatan', name: 'Sept Rubans', value: 10 + (variants.nanatanPlus ? ribbons.length - 7 : 0) });
  if (cnt('akatan') === 3) list.push({ key: 'akatan', name: YAKU_SETS.akatan.name, value: 7 });
  if (cnt('aotan') === 3) list.push({ key: 'aotan', name: YAKU_SETS.aotan.name, value: 7 });
  if (variants.inoshikachou && cnt('inoshikachou') === 3) list.push({ key: 'inoshikachou', name: YAKU_SETS.inoshikachou.name, value: 7 });
  return { list, total: list.reduce((s, y) => s + y.value, 0) };
}

// compensation de main (oikomi) pour un joueur forcé dehors
export function handCompensation(ids, variants = {}) {
  const t = detectTeyaku(ids), d = detectDekiyaku(ids, variants);
  const used = new Set();
  if (t.A) t.A.cards.forEach(id => used.add(id));
  if (t.B) ids.forEach(id => used.add(id));          // toute la main est la combinaison
  for (const y of d.list) for (const c of byId(ids)) if (YAKU_SETS[y.key] && YAKU_SETS[y.key].test(c)) used.add(c.id);
  const contrib = byId(ids).filter(c => !used.has(c.id) && (c.type === 'bright' || c.tag === 'poetry' || c.tag === 'blue'
    || (variants.inoshikachou && YAKU_SETS.inoshikachou.test(c)))).length;
  return { teyakuHalfKan: t.total / 2, dekiHalfKan: d.total / 2, contribCards: contrib, teyaku: t, dekiyaku: d };
}

// -------------------------------------------------------- partie / état
export function newGame({ players, settings = {}, seed = 1 }) {
  if (players.length < 2 || players.length > 6) throw new Error('2 à 6 joueurs');
  const s = { ...DEFAULT_SETTINGS, ...settings, variants: { ...DEFAULT_SETTINGS.variants, ...(settings.variants || {}) } };
  const g = {
    version: VERSION, settings: s,
    players: players.map((p, i) => ({ id: p.id, name: p.name, bot: !!p.bot, seat: i })),
    scores: Object.fromEntries(players.map(p => [p.id, 0])),
    month: 1, dealer: 0, carry: [], pot: 0, round: null, history: [], log: [],
    finished: false, final: null, rngState: seed | 0,
    gameId: Math.random().toString(36).slice(2, 10), eventSeq: 0,
  };
  return g;
}
export const playerName = (g, pid) => (g.players.find(p => p.id === pid) || { name: '?' }).name;
const log = (g, text, kind = 'info') => { g.log.push({ n: g.log.length, month: g.month, kind, text }); if (g.log.length > 400) g.log.shift(); };
const kanPts = (g, k) => Math.round(k * g.settings.kan * g.round.mult);
function transfer(g, from, to, pts, label) {
  if (pts <= 0 || from === to) return;
  g.scores[from] -= pts; g.scores[to] += pts;
  g.round.payments.push({ from, to, pts, label });
}
export function fmtKan(g, pts) {          // 35 -> "3 kan 5"
  const K = g.settings.kan, sign = pts < 0 ? '−' : '', a = Math.abs(pts);
  const k = Math.floor(a / K), p = a % K;
  if (k === 0) return `${sign}${p} pt${p > 1 ? 's' : ''}`;
  return `${sign}${k} kan${p ? ' ' + p : ''}`;
}

// ------------------------------------------------------------- donne
function deal(g) {
  const r = g.round, N = g.players.length;
  for (let attempt = 0; ; attempt++) {
    const deck = shuffle(g, CARDS.map(c => c.id));
    r.hands = {}; let k = 0;
    for (let i = 0; i < N; i++) { const p = g.players[(r.dealer + 1 + i) % N]; r.hands[p.id] = deck.slice(k, k + 7); k += 7; }
    r.field = deck.slice(k, k + 6); k += 6;
    r.draw = deck.slice(k);
    const cnt = {}; r.field.forEach(id => cnt[month(id)] = (cnt[month(id)] || 0) + 1);
    if (!Object.values(cnt).some(n => n === 4)) break;
    log(g, 'Fausse donne : quatre cartes du même mois en rivière, on redonne.', 'warn');
  }
  r.fieldMeta = {};
}
function computeMultiplier(g) {
  const r = g.round;
  const ms = byId(r.field).filter(c => c.type === 'bright').map(c => (c.tag === 'rain' || c.tag === 'phoenix') ? 4 : 2).sort((a, b) => b - a);
  r.fieldBrights = ms.slice();
  if (g.settings.variants.stackMult) { r.mult = ms.reduce((a, b) => a * b, 1); r.carried = false; }
  else if (g.carry.length) { r.mult = g.carry.shift(); r.carried = true; g.carry.push(...ms); g.carry.sort((a, b) => b - a); }
  else { r.mult = ms[0] || 1; r.carried = false; g.carry.push(...ms.slice(1)); }
  r.carryAfter = g.carry.slice();
  const nom = { 1: 'petit champ (×1)', 2: 'grand champ (×2)', 4: 'champ suprême (×4)' }[r.mult] || `×${r.mult}`;
  log(g, `Multiplicateur : ${nom}${r.carried ? ' (reporté)' : ''}${g.carry.length ? ' · en report : ' + g.carry.map(m => '×' + m).join(' ') : ''}.`);
}

export function startRound(g) {
  if (g.finished) throw new Error('Partie terminée');
  const N = g.players.length;
  const r = g.round = {
    month: g.month, dealer: g.dealer, roundDealer: g.players[g.dealer].id, phase: 'deal',
    pot: g.pot || 0, payments: [], captures: Object.fromEntries(g.players.map(p => [p.id, []])),
    teyaku: {}, dekiyaku: {}, sage: {}, firstSage: null, liabilities: [], divingLiab: {},
    turnNo: 0, turn: null, active: [], order: [], ended: null, result: null, twoPlayer: false,
    lastTurnOf: {}, turnCaptures: [], turnEvents: [], lastTurnEvents: [],
  };
  g.pot = 0;
  log(g, `— Manche ${g.month} · donneur (OYA) : ${playerName(g, r.roundDealer)} —`, 'title');
  deal(g);
  computeMultiplier(g);
  if (N >= 4) {
    r.phase = 'dropout';
    const order = []; for (let i = 0; i < N; i++) order.push(g.players[(g.dealer + i) % N].id);
    r.dropout = { order, idx: 0, decisions: {}, playing: [], dropCount: 0, fees: [], forced: [], comps: [] };
    log(g, "Phase d'abandon : chacun annonce « je joue » ou « je passe », en commençant par l'OYA.");
  } else {
    beginPlay(g, g.players.map(p => p.id));
  }
  return g;
}

function beginPlay(g, activeIds) {
  const r = g.round, N = g.players.length;
  const dealerSeat = g.players.find(p => p.id === r.roundDealer).seat;
  r.active = activeIds.slice().sort((a, b) => ((seat(g, a) - dealerSeat + N) % N) - ((seat(g, b) - dealerSeat + N) % N));
  r.order = r.active.slice();
  r.twoPlayer = r.active.length === 2;
  // mains inactives -> pioche remélangée
  const inactive = g.players.map(p => p.id).filter(id => !r.active.includes(id));
  if (inactive.length) {
    r.draw = shuffle(g, [...r.draw, ...inactive.flatMap(id => r.hands[id])]);
    inactive.forEach(id => { r.hands[id] = []; });
  }
  // teyaku (réclamés automatiquement)
  for (const id of r.active) {
    r.dekiyaku[id] = { list: [], total: 0 };
    const t = detectTeyaku(r.hands[id]);
    if (t.total > 0) {
      r.teyaku[id] = t;
      const parts = [t.A && `${t.A.name} (${t.A.value} kan)`, t.B && `${t.B.name} (${t.B.value} kan)`].filter(Boolean);
      log(g, `${playerName(g, id)} annonce ${parts.join(' + ')}.`, 'yaku');
    }
  }
  r.phase = 'play';
  r.turn = { pid: r.order[0], step: 'hand', pending: null, drawn: null };
  r.turnCaptures = [];
  log(g, `${r.twoPlayer ? 'Manche à deux joueurs. ' : ''}${playerName(g, r.turn.pid)} commence.`);
}
const seat = (g, pid) => g.players.find(p => p.id === pid).seat;

// ----------------------------------------------------- phase d'abandon
function dropoutDecision(g, pid, choice) {
  const r = g.round, d = r.dropout;
  if (d.order[d.idx] !== pid) throw new Error("Ce n'est pas à vous d'annoncer");
  const remaining = d.order.length - d.idx;
  if (choice === 'drop') {
    if (g.settings.variants.forcedThree && d.playing.length + remaining <= 3) throw new Error('Il faut trois joueurs : vous devez jouer');
    d.dropCount++;
    const feeKan = 1 + 0.5 * (d.dropCount - 1);
    const pts = kanPts(g, feeKan);
    g.scores[pid] -= pts; r.pot += pts;
    d.fees.push({ pid, kan: feeKan, pts });
    r.payments.push({ from: pid, to: 'pot', pts, label: `Pénalité d'abandon (${feeKan} kan)` });
    log(g, `${playerName(g, pid)} passe et verse ${fmtKan(g, pts)} au pot.`);
  } else {
    d.playing.push(pid);
    log(g, `${playerName(g, pid)} joue.`);
  }
  d.decisions[pid] = choice; d.idx++;
  if (d.playing.length === 3 || d.idx === d.order.length) finishDropout(g);
}
function finishDropout(g) {
  const r = g.round, d = r.dropout, V = g.settings.variants;
  d.forced = d.order.slice(d.idx);
  if (d.playing.length) r.roundDealer = d.playing[0];
  if (d.playing.length === 3 && d.forced.length) {
    const payers = d.playing.filter(p => p !== r.roundDealer);
    for (const f of d.forced) {
      d.decisions[f] = 'forced';
      const c = handCompensation(r.hands[f], V);
      const pts = kanPts(g, c.teyakuHalfKan + c.dekiHalfKan) + 3 * c.contribCards * r.mult;
      d.comps.push({ pid: f, pts, detail: c });
      if (pts > 0) { payers.forEach(p => transfer(g, p, f, pts, `Compensation de main de ${playerName(g, f)}`)); }
      log(g, `${playerName(g, f)} est forcé dehors${pts ? ` et reçoit ${fmtKan(g, pts)} de chacun des deux actifs non-OYA` : ''}.`);
    }
  }
  if (d.playing.length === 3) return beginPlay(g, d.playing);
  if (d.playing.length === 2) {
    if (V.twoPlayerFallback === 'split') {
      const half = Math.floor(r.pot / 2), rest = r.pot - 2 * half;
      d.playing.forEach((p, i) => { g.scores[p] += half + (i === 0 ? rest : 0); });
      r.payments.push({ from: 'pot', to: d.playing[0], pts: half + rest, label: 'Partage du pot' });
      r.payments.push({ from: 'pot', to: d.playing[1], pts: half, label: 'Partage du pot' });
      log(g, `Deux volontaires seulement : ils se partagent le pot (${fmtKan(g, r.pot)}).`);
      r.pot = 0;
      return closeRound(g, { how: 'split', winner: null, keepDealer: true });
    }
    log(g, 'Deux volontaires seulement : duel à deux pour le pot.');
    return beginPlay(g, d.playing);
  }
  if (d.playing.length === 1) {
    log(g, `${playerName(g, d.playing[0])} est seul volontaire : il rafle le pot.`);
    return closeRound(g, { how: 'solo', winner: d.playing[0] });
  }
  log(g, 'Personne ne joue : fausse donne, on redonne (le pot reste).', 'warn');
  g.pot = r.pot;
  return startRound(g);
}

// ------------------------------------------------------------- tours
function handSize(g, pid) { return g.round.hands[pid].length; }
function placeOnField(g, pid, cardId, source) {
  const r = g.round;
  r.field.push(cardId);
  r.fieldMeta[cardId] = { by: pid, fromHand: source === 'hand', turn: r.turnNo,
    lastTurn: source === 'hand' && handSize(g, pid) === 0 };
  r.turnEvents.push({ seq: g.eventSeq++, turnNo: r.turnNo, pid, card: cardId, source, captured: [] });
}
function capture(g, pid, played, fieldCards, source) {
  const r = g.round;
  r.field = r.field.filter(id => !fieldCards.includes(id));
  r.captures[pid].push(played, ...fieldCards);
  r.turnCaptures.push({ played, fieldCards, source, meta: fieldCards.map(id => r.fieldMeta[id]) });
  r.turnEvents.push({ seq: g.eventSeq++, turnNo: r.turnNo, pid, card: played, source, captured: fieldCards.slice() });
  fieldCards.forEach(id => delete r.fieldMeta[id]);
  log(g, `${playerName(g, pid)} ${source === 'draw' ? 'pioche' : 'joue'} ${card(played).name} et capture ${byId(fieldCards).map(c => c.name).join(' + ')}.`);
}
// joue une carte sur la rivière ; renvoie true si un choix est requis
function playToField(g, pid, cardId, source) {
  const r = g.round;
  const matches = r.field.filter(f => month(f) === month(cardId));
  if (matches.length === 2) {
    r.turn.step = 'choose'; r.turn.pending = { card: cardId, matches, source };
    return true;
  }
  if (matches.length === 0) {
    placeOnField(g, pid, cardId, source);
    log(g, `${playerName(g, pid)} ${source === 'draw' ? 'pioche' : 'joue'} ${card(cardId).name} : rien à prendre.`);
  } else {
    capture(g, pid, cardId, matches, source);
  }
  return false;
}
function drawStep(g, pid) {
  const r = g.round;
  r.turn.step = 'draw';
  if (!r.draw.length) return afterTurn(g, pid);
  const c = r.draw.shift();
  r.turn.drawn = c;
  if (!playToField(g, pid, c, 'draw')) afterTurn(g, pid);
}
function afterTurn(g, pid) {
  const r = g.round, V = g.settings.variants;
  const before = r.dekiyaku[pid], now = detectDekiyaku(r.captures[pid], V);
  const newKeys = now.list.filter(y => !before.list.some(b => b.key === y.key));
  const improved = now.total > before.total || newKeys.length > 0;
  if (V.liability) checkLiability(g, pid, before, now);
  checkDivingLiability(g, pid);
  r.lastTurnOf[pid] = r.turnNo;
  if (improved) {
    r.dekiyaku[pid] = now;
    r.turn.step = 'decide';
    log(g, `${playerName(g, pid)} forme ${now.list.map(y => `${y.name} (${y.value} kan)`).join(' + ')} : sage ou shoubu ?`, 'yaku');
    return;
  }
  nextTurn(g, pid);
}
function nextTurn(g, pid) {
  const r = g.round;
  r.lastTurnEvents = r.turnEvents; r.turnEvents = [];
  r.turnNo++;
  if (r.active.every(id => r.hands[id].length === 0)) return endRound(g, 'exhausted', null);
  const next = r.order[(r.order.indexOf(pid) + 1) % r.order.length];
  r.turn = { pid: next, step: 'hand', pending: null, drawn: null };
  r.turnCaptures = [];
}
// responsabilité (variante) : qui a servi la carte manquante ?
function checkLiability(g, pid, before, now) {
  const r = g.round;
  const captured = byId(r.captures[pid]);
  for (const y of now.list) {
    if (!YAKU_SETS[y.key] || before.list.some(b => b.key === y.key)) continue;
    const set = YAKU_SETS[y.key];
    const prevCount = captured.filter(c => set.test(c)).length - r.turnCaptures.flatMap(tc => [tc.played, ...tc.fieldCards]).filter(id => set.test(card(id))).length;
    if (prevCount !== set.need - 1) continue;                    // il ne manquait pas UNE carte
    for (const tc of r.turnCaptures) {
      const yakuCardIn = [tc.played, ...tc.fieldCards].some(id => set.test(card(id)));
      if (!yakuCardIn) continue;
      tc.meta.forEach(m => {
        if (m && m.by !== pid && m.fromHand && !m.lastTurn && m.turn > (r.lastTurnOf[pid] ?? -1))
          r.liabilities.push({ pid, yaku: y.key, responsible: m.by });
      });
    }
  }
}
function checkDivingLiability(g, pid) {
  const r = g.round, t = r.teyaku[pid];
  if (!t || !t.A || t.A.hasFour || !t.A.tripletMonths.length) return;
  for (const tc of r.turnCaptures) {
    if (!t.A.tripletMonths.includes(month(tc.played))) continue;
    tc.meta.forEach(m => {
      if (m && m.by !== pid && m.fromHand && !m.lastTurn && m.turn > (r.lastTurnOf[pid] ?? -1)) r.divingLiab[pid] = m.by;
    });
  }
}

// ------------------------------------------------------- fin de manche
function settle(g) {
  const r = g.round, V = g.settings.variants, mult = r.mult;
  const act = r.active, two = r.twoPlayer;
  const opps = p => act.filter(o => o !== p);
  const pts = {}, chaffN = {};
  act.forEach(p => { pts[p] = cardPoints(r.captures[p]); chaffN[p] = chaffCountB(r.captures[p]); });
  let winner = null, special = null; const achievements = [];
  const payTeyaku = () => act.forEach(p => { const t = r.teyaku[p]; if (t) opps(p).forEach(o => transfer(g, o, p, kanPts(g, t.total), `Teyaku de ${playerName(g, p)}`)); });
  const hasDeki = act.some(p => r.dekiyaku[p].total > 0);
  const how = r.ended.how;
  if (hasDeki) {
    payTeyaku();
    if (how === 'shoubu' || how === 'cancel') {
      const c = r.ended.by, half = how === 'cancel', os = opps(c);
      const factor = Object.fromEntries(os.map(o => [o, 1]));
      if (os.length === 2 && !half) {
        const s = os.filter(o => r.sage[o] !== undefined);
        if (s.length === 1) { factor[s[0]] = 2; factor[os.find(o => o !== s[0])] = 0; }
      }
      for (const y of r.dekiyaku[c].list) {
        const liab = r.liabilities.find(l => l.pid === c && l.yaku === y.key);
        os.forEach(o => {
          let f = factor[o]; if (liab) f = (o === liab.responsible) ? 2 : 0;
          transfer(g, o, c, kanPts(g, y.value * (half ? 0.5 : 1) * f), `${y.name}${half ? ' (annulation, moitié)' : ''}${liab && o === liab.responsible ? ' — responsabilité, double' : ''}${f === 2 && !liab ? ' — avait dit sage, double' : ''}`);
        });
      }
      winner = c;
    } else {
      act.forEach(p => { const d = r.dekiyaku[p]; if (d.total > 0) opps(p).forEach(o => transfer(g, o, p, kanPts(g, d.total / 2), `Dekiyaku de ${playerName(g, p)} (mains épuisées, moitié)`)); });
      winner = r.firstSage || r.order[0];
    }
  } else if (two) {
    payTeyaku();
    const [a, b] = r.order;
    winner = pts[b] > pts[a] ? b : a;
    const loser = opps(winner)[0];
    transfer(g, loser, winner, (pts[winner] - pts[loser]) * mult, 'Différence de points');
  } else {
    const all88 = act.every(p => pts[p] === 88);
    const big = act.find(p => pts[p] >= 168);
    const chaff16 = act.find(p => chaffN[p] >= 16);
    if (all88) { special = 'Tous-les-Huit'; winner = r.roundDealer; opps(winner).forEach(o => transfer(g, o, winner, kanPts(g, 10), 'Tous-les-Huit')); }
    else if (big) { special = 'Double-Huit'; winner = big; opps(big).forEach(o => transfer(g, o, big, kanPts(g, 10 + (pts[big] - 168)), `Double-Huit (${pts[big]} pts)`)); }
    else if (chaff16) { special = 'Seize Écailles'; winner = chaff16; opps(chaff16).forEach(o => transfer(g, o, chaff16, kanPts(g, 12 + 2 * (chaffN[chaff16] - 16)), `Seize Écailles (${chaffN[chaff16]})`)); }
    else {
      payTeyaku();
      const deltas = act.map(p => ({ p, v: (pts[p] - 88) * mult }));
      const recv = deltas.filter(d => d.v > 0).map(d => ({ ...d })), payers = deltas.filter(d => d.v < 0).map(d => ({ p: d.p, v: -d.v }));
      for (const pay of payers) for (const rc of recv) {
        if (pay.v === 0) break; if (rc.v === 0) continue;
        const a = Math.min(pay.v, rc.v); transfer(g, pay.p, rc.p, a, 'Points des cartes'); pay.v -= a; rc.v -= a;
      }
      winner = act.reduce((w, p) => (pts[p] > pts[w] || (pts[p] === pts[w] && r.order.indexOf(p) < r.order.indexOf(w))) ? p : w, act[0]);
    }
  }
  if (!special && !two) {
    for (const p of act) {
      const t = r.teyaku[p]; if (!t) continue;
      if (t.A && !t.A.hasFour && t.A.tripletMonths.some(m => r.captures[p].filter(id => month(id) === m).length === 4)) {
        const resp = r.divingLiab[p];
        if (V.liability && resp) { transfer(g, resp, p, kanPts(g, 2), 'Plongeon (responsabilité)'); }
        else opps(p).forEach(o => transfer(g, o, p, kanPts(g, 1), 'Plongeon'));
        achievements.push({ pid: p, name: 'Plongeon' });
      }
      if (t.B && t.B.key !== 'pikaichi' && pts[p] >= 89) {
        opps(p).forEach(o => transfer(g, o, p, kanPts(g, 1), 'Évasion'));
        achievements.push({ pid: p, name: 'Évasion' });
      }
    }
  }
  return { winner, special, achievements, pts, chaffN, how };
}
function endRound(g, how, by) {
  const r = g.round;
  if (r.turnEvents.length) { r.lastTurnEvents = r.turnEvents; r.turnEvents = []; }
  r.phase = 'end'; r.ended = { how, by };
  const nm = { shoubu: `${playerName(g, by)} dit shoubu.`, cancel: `${playerName(g, by)} annule son sage.`, exhausted: 'Mains épuisées.' }[how];
  log(g, nm, 'title');
  const res = settle(g);
  closeRound(g, { how, winner: res.winner, res });
}
function closeRound(g, { how, winner, res, keepDealer }) {
  const r = g.round;
  r.phase = 'end'; r.ended = r.ended || { how, by: null };
  if (r.pot > 0 && winner) { g.scores[winner] += r.pot; r.payments.push({ from: 'pot', to: winner, pts: r.pot, label: 'Pot des abandons' }); r.pot = 0; }
  r.result = { how, winner, special: res ? res.special : null, achievements: res ? res.achievements : [], pts: res ? res.pts : {},
    chaffN: res ? res.chaffN : {}, payments: r.payments.slice(), scores: { ...g.scores } };
  if (winner) g.dealer = seat(g, winner); else if (!keepDealer) { /* misdeal: inchangé */ }
  if (winner) log(g, `Vainqueur de la manche : ${playerName(g, winner)}${res && res.special ? ' — ' + res.special + ' !' : ''}.`, 'title');
  g.history.push({ month: g.month, ...r.result });
  g.month++;
  if (g.month > g.settings.rounds) {
    g.finished = true;
    const rank = g.players.map(p => ({ id: p.id, name: p.name, score: g.scores[p.id] })).sort((a, b) => b.score - a.score);
    g.final = rank;
    log(g, `Partie terminée. ${rank[0].name} l'emporte avec ${fmtKan(g, rank[0].score)}.`, 'title');
  }
}

// --------------------------------------------------------- API actions
export function legalActions(g, pid) {
  const r = g.round;
  if (!r || r.phase === 'end') return [];
  if (r.phase === 'dropout') {
    const d = r.dropout;
    if (d.order[d.idx] !== pid) return [];
    const remaining = d.order.length - d.idx;
    const canDrop = !(g.settings.variants.forcedThree && d.playing.length + remaining <= 3);
    return [{ type: 'dropout', choice: 'play' }, ...(canDrop ? [{ type: 'dropout', choice: 'drop' }] : [])];
  }
  if (r.phase !== 'play' || r.turn.pid !== pid) return [];
  const t = r.turn;
  if (t.step === 'hand') return [...(r.sage[pid] !== undefined ? [{ type: 'cancel' }] : []), ...r.hands[pid].map(c => ({ type: 'play', card: c }))];
  if (t.step === 'choose') return t.pending.matches.map(c => ({ type: 'choose', card: c }));
  if (t.step === 'decide') return [{ type: 'shoubu' }, { type: 'sage' }];
  return [];
}
export function applyAction(g, pid, a) {
  const r = g.round;
  if (!r || r.phase === 'end') throw new Error('Aucune manche en cours');
  if (r.phase === 'dropout') {
    if (a.type !== 'dropout') throw new Error("Phase d'abandon : annoncez « je joue » ou « je passe »");
    return dropoutDecision(g, pid, a.choice);
  }
  if (r.phase !== 'play') throw new Error('Phase invalide');
  const t = r.turn;
  if (t.pid !== pid) throw new Error("Ce n'est pas votre tour");
  if (t.step === 'hand') {
    if (a.type === 'cancel') {
      if (r.sage[pid] === undefined) throw new Error("Vous n'avez pas dit sage");
      return endRound(g, 'cancel', pid);
    }
    if (a.type !== 'play' || !r.hands[pid].includes(a.card)) throw new Error('Jouez une carte de votre main');
    r.hands[pid] = r.hands[pid].filter(c => c !== a.card);
    t.played = a.card;
    if (!playToField(g, pid, a.card, 'hand')) drawStep(g, pid);
    return;
  }
  if (t.step === 'choose') {
    if (a.type !== 'choose' || !t.pending.matches.includes(a.card)) throw new Error('Choisissez une des deux cartes proposées');
    const p = t.pending; t.pending = null;
    capture(g, pid, p.card, [a.card], p.source);
    if (p.source === 'hand') drawStep(g, pid); else afterTurn(g, pid);
    return;
  }
  if (t.step === 'decide') {
    if (a.type === 'shoubu') return endRound(g, 'shoubu', pid);
    if (a.type === 'sage') {
      if (r.sage[pid] === undefined) r.sage[pid] = r.turnNo;
      if (!r.firstSage) r.firstSage = pid;
      log(g, `${playerName(g, pid)} dit sage : on continue.`);
      return nextTurn(g, pid);
    }
    throw new Error('Sage ou shoubu ?');
  }
  throw new Error('Action inconnue');
}

// --------------------------------------------- vue filtrée par joueur
export function viewFor(g, pid) {
  const r = g.round;
  const v = {
    version: g.version, settings: g.settings, players: g.players, scores: g.scores, month: g.month,
    dealer: g.dealer, carry: g.carry, pot: g.pot, history: g.history, log: g.log.slice(-60),
    finished: g.finished, final: g.final, me: pid, legal: legalActions(g, pid), round: null, gameId: g.gameId,
  };
  if (r) {
    v.round = {
      month: r.month, dealer: r.dealer, roundDealer: r.roundDealer, phase: r.phase, mult: r.mult, carried: r.carried,
      fieldBrights: r.fieldBrights, pot: r.pot, field: r.field, drawCount: r.draw.length, captures: r.captures,
      handCounts: Object.fromEntries(Object.entries(r.hands).map(([k, h]) => [k, h.length])),
      hand: r.hands[pid] ? r.hands[pid].slice() : [], teyaku: r.teyaku, dekiyaku: r.dekiyaku, sage: r.sage,
      firstSage: r.firstSage, turnNo: r.turnNo, turn: r.turn, active: r.active, order: r.order, ended: r.ended,
      result: r.result, twoPlayer: r.twoPlayer, dropout: r.dropout || null, payments: r.payments,
      turnCaptures: r.turnCaptures.map(tc => ({ played: tc.played, fieldCards: tc.fieldCards, source: tc.source })),
      turnEvents: r.turnEvents, lastTurnEvents: r.lastTurnEvents,
    };
  }
  return v;
}

// exposé pour les tests uniquement
export const _t = { computeMultiplier, beginPlay, endRound, settle, deal, shuffle };
