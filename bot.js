// bot.js — Bot simple pour compléter une table ou jouer seul.
// Ne reçoit que la vue filtrée (viewFor) : il ne triche pas.
import { CARDS } from './cards.js?v=202609021955';
import { detectTeyaku, detectDekiyaku, YAKU_SETS, cardPoints } from './core.js?v=202609021955';

const card = id => CARDS[id];

// bonus d'un yaku en cours de construction : plus on est proche, plus la carte vaut
function yakuBonus(id, myCaps, oppCaps, variants) {
  const c = card(id); let bonus = 0;
  for (const [key, y] of Object.entries(YAKU_SETS)) {
    if (key === 'inoshikachou' && !variants.inoshikachou) continue;
    if (!y.test(c)) continue;
    const have = myCaps.filter(x => y.test(card(x))).length;
    const lost = oppCaps.filter(x => y.test(card(x))).length;
    if (lost > 0 && key !== 'gokou') continue;             // un adversaire a déjà une carte du set
    bonus += y.value * (have + 1) / y.need * 2;
  }
  if (c.type === 'ribbon' && c.tag !== 'willowRibbon') {
    const have = myCaps.filter(x => card(x).type === 'ribbon' && card(x).tag !== 'willowRibbon').length;
    if (have >= 3) bonus += have;                          // vers Sept Rubans
  }
  return bonus;
}
function captureValue(played, fieldCards, view) {
  const r = view.round, me = view.me;
  const oppCaps = r.active.filter(p => p !== me).flatMap(p => r.captures[p]);
  const all = [played, ...fieldCards];
  return all.reduce((s, id) => s + card(id).pts + yakuBonus(id, r.captures[me], oppCaps, view.settings.variants), 0);
}
// une carte adverse est-elle à une carte d'un yaku que je pourrais nourrir ?
function feeds(id, view) {
  const r = view.round, c = card(id);
  for (const p of r.active) {
    if (p === view.me) continue;
    for (const [key, y] of Object.entries(YAKU_SETS)) {
      if (!y.test(c)) continue;
      if (r.captures[p].filter(x => y.test(card(x))).length === y.need - 1) return true;
    }
  }
  return false;
}
function closeToYaku(view) {
  const r = view.round, me = view.me, mine = r.captures[me];
  const oppCaps = r.active.filter(p => p !== me).flatMap(p => r.captures[p]);
  for (const [key, y] of Object.entries(YAKU_SETS)) {
    if (key === 'inoshikachou' && !view.settings.variants.inoshikachou) continue;
    const have = mine.filter(x => y.test(card(x))).length;
    if (have === y.need - 1 && !oppCaps.some(x => y.test(card(x)))) return true;
  }
  return false;
}

export function botAction(view, rnd = Math.random) {
  const legal = view.legal; if (!legal.length) return null;
  const r = view.round, me = view.me;
  const t = legal[0].type;
  if (t === 'dropout') {
    const hand = r.hand, tey = detectTeyaku(hand).total;
    const strength = cardPoints(hand) + tey * 12 + hand.filter(id => card(id).type === 'bright').length * 10;
    const canDrop = legal.some(a => a.choice === 'drop');
    const play = !canDrop || strength >= 44 || rnd() < 0.15;
    return legal.find(a => a.choice === (play ? 'play' : 'drop'));
  }
  if (t === 'choose') {
    return legal.map(a => ({ a, v: captureValue(r.turn.pending.card, [a.card], view) })).sort((x, y) => y.v - x.v)[0].a;
  }
  if (t === 'shoubu' || t === 'sage') {
    const total = r.dekiyaku[me].total, handLeft = r.hand.length;
    const oppClose = r.active.some(p => p !== me && closeToYaku({ ...view, me: p }));
    const sage = handLeft >= 3 && total <= 10 && closeToYaku(view) && !oppClose && rnd() < 0.7;
    return legal.find(a => a.type === (sage ? 'sage' : 'shoubu'));
  }
  // step 'hand' : éventuellement annuler un sage devenu mauvais
  if (legal.some(a => a.type === 'cancel')) {
    const oppClose = r.active.some(p => p !== me && closeToYaku({ ...view, me: p }));
    if (r.hand.length <= 2 || oppClose) return legal.find(a => a.type === 'cancel');
  }
  const plays = legal.filter(a => a.type === 'play');
  const scored = plays.map(a => {
    const m = r.field.filter(f => card(f).month === card(a.card).month);
    let v;
    if (m.length === 0) v = -card(a.card).pts - (feeds(a.card, view) ? 25 : 0) - yakuBonus(a.card, r.captures[me], [], view.settings.variants) * 0.5;
    else if (m.length === 3) v = captureValue(a.card, m, view);
    else v = Math.max(...m.map(f => captureValue(a.card, [f], view)));
    return { a, v: v + rnd() * 0.5 };
  });
  return scored.sort((x, y) => y.v - x.v)[0].a;
}
