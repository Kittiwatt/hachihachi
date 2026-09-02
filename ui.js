// ui.js — Interface Hachi-Hachi (accueil, salon, table). Rendu par gabarits, événements délégués.
import { CARDS } from './cards.js';
import { DEFAULT_SETTINGS, detectTeyaku } from './core.js';
import { Session, makeCode } from './net.js';

const app = document.getElementById('app');
const S = {
  screen: 'home', session: null, lobby: null, view: null, status: '', error: '', chat: [], modal: null,
  name: localStorage.getItem('hh_name') || '', joinCode: (location.hash.slice(1) || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
  hover: null,
};
let trystero = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const K = () => (S.view ? S.view.settings.kan : (S.lobby ? S.lobby.settings.kan : 10)) || 10;
function fmt(pts, signed = false) {
  const k = K(), sign = pts < 0 ? '−' : (signed && pts > 0 ? '+' : ''), a = Math.abs(pts);
  const kan = Math.floor(a / k), p = a % k;
  if (!kan) return `${sign}${p} pt${p > 1 ? 's' : ''}`;
  return `${sign}${kan} kan${p ? ' ' + p : ''}`;
}
const cardEl = (id, cls = '', extra = '') => { const c = CARDS[id]; return `<div class="card ${cls}" data-id="${id}" ${extra}><img src="cards/${c.code}.jpg" alt="${esc(c.name)}" title="${esc(c.name)}" draggable="false"></div>`; };
const backEl = (cls = '') => `<div class="card back ${cls}"><img src="cards/dos.jpg" alt="" draggable="false"></div>`;
const pname = pid => { const v = S.view || S.lobby; const p = (v.players || []).find(x => x.id === pid); return p ? p.name : (pid === 'pot' ? 'le pot' : pid); };
const TYPES = ['bright', 'animal', 'ribbon', 'chaff'];
const capsEl = ids => `<div class="caps">${TYPES.map(t => `<div class="grp">${ids.filter(id => CARDS[id].type === t).map(id => cardEl(id)).join('')}</div>`).join('')}</div>`;

// ------------------------------------------------------------- session
function callbacks() {
  return {
    onView: v => { const wasEnd = S.view && S.view.round && S.view.round.phase === 'end' && S.view.round.month === (v.round && v.round.month); if (!wasEnd) S.modal = S.modal === 'closed' ? null : S.modal; S.view = v; if (v) S.screen = 'table'; S.error = ''; render(); },
    onLobby: l => { S.lobby = l; if (!S.view || !l.started) S.screen = l.started && S.view ? 'table' : 'lobby'; render(); },
    onStatus: t => { S.status = t; render(); },
    onError: m => { S.error = m; render(); setTimeout(() => { if (S.error === m) { S.error = ''; render(); } }, 6000); },
    onChat: m => { S.chat.push(m); if (S.chat.length > 80) S.chat.shift(); render(); },
  };
}
async function loadTrystero() {
  if (!trystero) { S.status = 'Chargement du module réseau…'; render(); trystero = await import('./vendor/trystero-nostr.min.js'); }
  return trystero;
}
function readSettings(form) {
  const f = new FormData(form);
  return { kan: +f.get('kan'), rounds: +f.get('rounds'),
    variants: { inoshikachou: !!f.get('inoshikachou'), nanatanPlus: !!f.get('nanatanPlus'), liability: !!f.get('liability'),
      stackMult: !!f.get('stackMult'), forcedThree: !!f.get('forcedThree'), twoPlayerFallback: f.get('twoPlayerFallback') || 'play' } };
}
function saveName(form) { const n = (new FormData(form).get('name') || '').toString().trim().slice(0, 20); if (!n) throw new Error('Choisissez un pseudo'); S.name = n; localStorage.setItem('hh_name', n); return n; }
async function create(form, local) {
  try {
    const name = saveName(form), settings = readSettings(form);
    const T = local ? null : await loadTrystero();
    S.session = new Session({ code: local ? 'SOLO' : makeCode(), name, isHost: true, settings, trystero: T, local, ...callbacks() });
    if (local) { S.session.addBot(); S.session.addBot(); }
    S.screen = 'lobby'; S.status = local ? '' : 'Table créée. Partagez le code ou le lien.'; render();
  } catch (e) { S.error = e.message; render(); }
}
async function join(form) {
  try {
    const name = saveName(form); const code = (new FormData(form).get('code') || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) throw new Error('Code de table invalide');
    const T = await loadTrystero();
    S.session = new Session({ code, name, isHost: false, trystero: T, ...callbacks() });
    S.screen = 'lobby'; S.lobby = null; render();
  } catch (e) { S.error = e.message; render(); }
}
function act(a) { try { S.session.act(S.view.me, a); } catch (e) { S.error = e.message; render(); } }
function leave() { if (S.session) S.session.leave(); S.session = null; S.view = null; S.lobby = null; S.screen = 'home'; S.chat = []; S.status = ''; location.hash = ''; render(); }

// -------------------------------------------------------------- écrans
function renderHome() {
  const s = DEFAULT_SETTINGS, v = s.variants;
  const settingsHtml = `
    <div class="settings">
      <label>Manches <select name="rounds"><option value="3">3 (une saison)</option><option value="6">6 (demi-année)</option><option value="12" selected>12 (l’année)</option></select></label>
      <label>1 kan = <select name="kan"><option value="10" selected>10 points (décimal)</option><option value="12">12 points (duodécimal)</option></select></label>
      <label class="chk"><input type="checkbox" name="inoshikachou"><span>Sanglier-Cerf-Papillons (7 kan)<small>variante du leaflet Nintendo</small></span></label>
      <label class="chk"><input type="checkbox" name="nanatanPlus"><span>Sept Rubans : +1 kan par ruban supplémentaire<small>Saule compris</small></span></label>
      <label class="chk"><input type="checkbox" name="liability"><span>Règle de responsabilité<small>servir la carte manquante : double, l’autre rien</small></span></label>
      <label class="chk"><input type="checkbox" name="stackMult"><span>Multiplicateurs cumulés<small>×32 possible, au lieu du report</small></span></label>
      <label class="chk"><input type="checkbox" name="forcedThree"><span>Toujours trois joueurs<small>les trois derniers ne peuvent plus passer</small></span></label>
      <label>À 4+, deux volontaires : <select name="twoPlayerFallback"><option value="play" selected>duel à deux pour le pot</option><option value="split">partage du pot</option></select></label>
    </div>`;
  return `<div class="home">
    <div class="hero"><h1>Hachi-Hachi · 八八</h1><div class="sub">Le hanafuda des joueurs, en ligne entre amis — 2 à 6 joueurs, règles arbitrées, sans compte ni serveur.</div></div>
    ${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}${S.status ? `<div class="status">${esc(S.status)}</div>` : ''}
    <div class="grid">
      <form class="panel" data-form="create">
        <h2>Créer une table</h2>
        <label>Votre pseudo <input type="text" name="name" value="${esc(S.name)}" maxlength="20" required placeholder="Pseudo"></label>
        <details ${S.joinCode ? '' : 'open'}><summary class="gold">Règles de la table</summary>${settingsHtml}</details>
        <div class="row" style="margin-top:.8em"><button class="btn primary" data-act="create">Créer une table en ligne</button><button class="btn" data-act="solo">Jouer seul contre des bots</button></div>
        <p class="small muted">En ligne : votre navigateur arbitre la partie (vous êtes l’hôte) ; les autres vous rejoignent par code ou par lien, en pair-à-pair.</p>
      </form>
      <form class="panel" data-form="join">
        <h2>Rejoindre une table</h2>
        <label>Votre pseudo <input type="text" name="name" value="${esc(S.name)}" maxlength="20" required placeholder="Pseudo"></label>
        <label>Code de la table <input type="text" name="code" value="${esc(S.joinCode)}" maxlength="6" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:.2em"></label>
        <div class="row" style="margin-top:.8em"><button class="btn gold" data-act="join">Rejoindre</button></div>
        <p class="small muted">Si vous revenez après une déconnexion, utilisez le même code : votre siège vous attend.</p>
      </form>
    </div>
    <p class="small muted" style="text-align:center;margin-top:2em"><a href="#" data-act="rules">Aide : combinaisons et déroulé</a> · Règles d’après <a href="https://fudawiki.org/en/hanafuda/games/hachi-hachi" target="_blank" rel="noopener">fudawiki</a> · Anofelis</p>
  </div>`;
}
function renderLobby() {
  const L = S.lobby, ses = S.session, isHost = ses && ses.isHost;
  const link = `${location.origin}${location.pathname}#${ses.code}`;
  if (!L) return `<div class="home"><div class="panel"><h2>Table ${esc(ses.code)}</h2><p class="status">${esc(S.status || 'Connexion à l’hôte…')}</p>${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}<p class="small muted">La mise en relation passe par des relais publics puis par WebRTC ; cela prend en général quelques secondes. Si rien ne vient, vérifiez le code et que l’hôte a bien la table ouverte.</p><button class="btn" data-act="leave">Retour</button></div></div>`;
  const st = L.settings || DEFAULT_SETTINGS, vv = st.variants || {};
  const varList = [vv.inoshikachou && 'Sanglier-Cerf-Papillons', vv.nanatanPlus && 'Sept Rubans +1', vv.liability && 'responsabilité', vv.stackMult && 'multiplicateurs cumulés', vv.forcedThree && 'toujours trois', vv.twoPlayerFallback === 'split' && 'partage du pot à deux'].filter(Boolean);
  return `<div class="home">
    ${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}${S.status ? `<div class="status">${esc(S.status)}</div>` : ''}
    <div class="grid">
      <div class="panel">
        <h2>${ses.local ? 'Partie solo' : 'Table'}</h2>
        ${ses.local ? '' : `<div class="code">${esc(ses.code)}</div><div class="row"><input type="text" readonly value="${esc(link)}" id="link" style="flex:1;min-width:0"><button class="btn small" data-act="copy">Copier le lien</button></div>`}
        <p class="small muted">${st.rounds} manches · 1 kan = ${st.kan} pts${varList.length ? ' · ' + varList.join(' · ') : ' · règles standard'}</p>
      </div>
      <div class="panel">
        <h2>Joueurs</h2>
        <ul class="seats">${L.players.map((p, i) => `<li><span class="dot ${p.bot ? 'bot' : (p.connected ? 'on' : '')}"></span><b>${i + 1}.</b> <span style="flex:1">${esc(p.name)}${p.id === ses.me ? ' <span class="muted">(vous)</span>' : ''}${p.bot ? '' : (p.connected ? '' : ' <span class="muted">— déconnecté</span>')}</span>${isHost && p.id !== ses.me ? `<button class="btn small danger" data-act="remove:${p.id}">retirer</button>` : ''}</li>`).join('')}</ul>
        ${isHost ? `<div class="row"><button class="btn" data-act="addbot" ${L.players.length >= 6 ? 'disabled' : ''}>+ Ajouter un bot</button><button class="btn primary" data-act="start" ${L.players.length < 2 ? 'disabled' : ''}>Lancer la partie</button></div>
          <p class="small muted">Les sièges se remplissent dans l’ordre d’arrivée ; le tour de jeu suit cet ordre (sens anti-horaire de la table). L’hôte est le premier OYA.</p>`
          : `<p class="status">En attente du lancement par l’hôte…</p>`}
        <div class="row" style="margin-top:.6em"><button class="btn small" data-act="leave">Quitter</button><a href="#" data-act="rules" class="small">Aide</a></div>
      </div>
    </div>
  </div>`;
}

function renderTable() {
  const v = S.view, r = v.round, me = v.me, ses = S.session;
  const P = v.players, st = v.settings;
  const active = new Set(r ? r.active : []);
  const turnPid = r && r.phase === 'play' ? r.turn.pid : (r && r.phase === 'dropout' ? r.dropout.order[r.dropout.idx] : null);
  const mult = r ? r.mult : 1;
  const carry = (v.carry || []).length ? ` <span class="muted small">report : ${v.carry.map(m => '×' + m).join(' ')}</span>` : '';
  const top = `<div class="topbar">
    <span class="title">HACHI-HACHI · 八八</span>
    <span>Manche <b>${r ? r.month : v.month}</b>/${st.rounds}</span>
    <span>OYA : <b>${r ? esc(pname(r.roundDealer)) : '—'}</b></span>
    <span class="mult x${mult}">×${mult}${r && r.carried ? ' (reporté)' : ''}</span>${carry}
    ${r && r.pot ? `<span>Pot : <b class="kan">${fmt(r.pot)}</b></span>` : ''}
    ${r ? `<span class="muted">Pioche : ${r.drawCount}</span>` : ''}
    <span style="flex:1"></span>
    <button class="btn small" data-act="history">Historique</button><button class="btn small" data-act="rules">Aide</button><button class="btn small" data-act="leave">Quitter</button>
  </div>`;

  const tagsOf = pid => {
    const t = [];
    if (r && r.roundDealer === pid && r.phase !== 'end') t.push('<span class="tag oya">OYA</span>');
    if (r && r.sage && r.sage[pid] !== undefined) t.push('<span class="tag sage">sage</span>');
    if (r && r.teyaku && r.teyaku[pid]) { const ty = r.teyaku[pid]; t.push(`<span class="tag yaku" title="teyaku">${[ty.A && ty.A.name, ty.B && ty.B.name].filter(Boolean).map(esc).join(' + ')} ${ty.total} kan</span>`); }
    if (r && r.dekiyaku && r.dekiyaku[pid] && r.dekiyaku[pid].total) t.push(`<span class="tag yaku">${r.dekiyaku[pid].list.map(y => esc(y.name)).join(' + ')} ${r.dekiyaku[pid].total} kan</span>`);
    if (r && r.phase !== 'deal' && r.dropout && r.dropout.decisions[pid] === 'drop') t.push('<span class="tag out">passe</span>');
    if (r && r.dropout && r.dropout.decisions[pid] === 'forced') t.push('<span class="tag out">forcé dehors</span>');
    if (v.connected && v.connected[pid] === false) t.push('<span class="tag off">déconnecté</span>');
    const pl = P.find(x => x.id === pid); if (pl && pl.bot) t.push('<span class="tag">bot</span>');
    return t.join('');
  };
  const left = `<div class="side left"><div class="panel players"><h3>Joueurs</h3>${P.map(p => `<div class="p ${p.id === me ? 'me' : ''} ${turnPid === p.id ? 'turn' : ''}"><span class="nm">${esc(p.name)}</span><span class="kan ${v.scores[p.id] > 0 ? 'pos' : (v.scores[p.id] < 0 ? 'neg' : '')}">${fmt(v.scores[p.id], true)}</span><span class="tags">${tagsOf(p.id)}</span></div>`).join('')}</div></div>`;

  let center = '';
  if (r) {
    const others = P.filter(p => p.id !== me && (r.phase === 'dropout' || active.has(p.id)));
    const opps = `<div class="opps">${others.map(p => `<div class="panel opp ${turnPid === p.id ? 'turn' : ''}"><div class="hd"><b>${esc(p.name)}</b><span class="handcount" title="${r.handCounts[p.id]} cartes en main">${'<i></i>'.repeat(r.handCounts[p.id] || 0)}</span></div>${r.teyaku[p.id] && r.handCounts[p.id] === 7 ? `<div class="shown"><span class="small muted">montre :</span> ${(r.teyaku[p.id].A ? r.teyaku[p.id].A.cards : []).concat(r.teyaku[p.id].B ? r.teyaku[p.id].B.cards : []).filter((x, i, a) => a.indexOf(x) === i).map(id => cardEl(id)).join('')}</div>` : ''}${capsEl(r.captures[p.id] || [])}</div>`).join('')}</div>`;

    const pending = r.phase === 'play' && r.turn.step === 'choose' && r.turn.pid === me ? r.turn.pending : null;
    const placed = new Set([r.turn && r.turn.played, r.turn && r.turn.drawn].filter(x => x != null && r.field.includes(x)));
    const hoverMonth = S.hover != null ? CARDS[S.hover].month : null;
    const byMonth = {}; r.field.forEach(id => (byMonth[CARDS[id].month] ||= []).push(id));
    const fieldCards = Object.values(byMonth).map(ids => {
      const els = ids.map(id => { let cls = ''; if (pending) cls = pending.matches.includes(id) ? 'choice' : 'dim'; else if (hoverMonth === CARDS[id].month) cls = 'match'; if (placed.has(id)) cls += ' new'; return cardEl(id, cls, pending && pending.matches.includes(id) ? `data-act="choose:${id}"` : ''); });
      return ids.length >= 3 ? `<div class="grp3">${els.join('')}</div>` : els.join('');
    }).join('');
    const field = `<div class="field"><div class="pile">${r.drawCount ? backEl() : '<div class="card" style="opacity:.2"></div>'}<div class="small muted">pioche · ${r.drawCount}</div></div><div class="river">${pending ? cardEl(pending.card, 'new') : ''}${fieldCards}</div></div>`;

    const legal = v.legal || [];
    const myTurn = turnPid === me;
    let prompt = '';
    if (r.phase === 'dropout') {
      const d = r.dropout, fee = 1 + 0.5 * d.dropCount;
      prompt = myTurn ? `<div class="prompt"><b>À vous d’annoncer.</b> Passer coûte <b>${fee} kan</b>${mult > 1 ? ` × ${mult}` : ''} au pot. ${d.playing.length} joueur(s) déjà en jeu.<div class="actions"><button class="btn primary" data-act="drop:play">Je joue</button>${legal.some(a => a.choice === 'drop') ? `<button class="btn" data-act="drop:drop">Je passe</button>` : ''}</div></div>`
        : `<div class="prompt">Phase d’abandon — ${esc(pname(turnPid))} annonce…</div>`;
    } else if (r.phase === 'play') {
      if (!active.has(me)) prompt = `<div class="prompt muted">Vous ne jouez pas cette manche. Au tour de ${esc(pname(turnPid))}.</div>`;
      else if (!myTurn) prompt = `<div class="prompt">Au tour de <b>${esc(pname(turnPid))}</b>${r.turn.step === 'decide' ? ' — sage ou shoubu ?' : ''}.</div>`;
      else if (r.turn.step === 'hand') prompt = `<div class="prompt"><b>À vous :</b> jouez une carte de votre main.${legal.some(a => a.type === 'cancel') ? ` <span class="muted">Vous aviez dit sage :</span> <button class="btn small" data-act="cancel">Annuler (arrêter pour moitié)</button>` : ''}</div>`;
      else if (r.turn.step === 'choose') prompt = `<div class="prompt"><b>Deux cartes correspondent :</b> cliquez celle que vous capturez.</div>`;
      else if (r.turn.step === 'decide') prompt = `<div class="prompt"><b>Vous formez ${r.dekiyaku[me].list.map(y => `${esc(y.name)} (${y.value} kan)`).join(' + ')}.</b><div class="actions"><button class="btn primary" data-act="shoubu">Shoubu — j’arrête, on paie</button><button class="btn" data-act="sage">Sage — je continue</button></div><div class="small muted">Sage : vous visez mieux, mais si un autre dit shoubu vous paierez double, et à mains épuisées chacun ne touche que moitié.</div></div>`;
    }
    const myTeyaku = r.hand.length === 7 && r.phase !== 'end' ? detectTeyaku(r.hand) : null;
    const mine = `<div class="panel mine"><div class="hd"><b>${esc(pname(me))}</b><span class="kan">${fmt(v.scores[me], true)}</span>${tagsOf(me)}${myTeyaku && myTeyaku.total && !r.teyaku[me] ? `<span class="small muted">main : ${[myTeyaku.A && myTeyaku.A.name, myTeyaku.B && myTeyaku.B.name].filter(Boolean).join(' + ')} (${myTeyaku.total} kan)</span>` : ''}</div>
      ${capsEl(r.captures[me] || [])}
      <div class="hand">${r.hand.map(id => cardEl(id, myTurn && r.phase === 'play' && r.turn.step === 'hand' ? 'playable' : '', myTurn && r.phase === 'play' && r.turn.step === 'hand' ? `data-act="play:${id}"` : '')).join('')}</div>
      ${prompt}</div>`;
    center = `<div class="center">${opps}${field}${mine}</div>`;
  } else {
    center = `<div class="center"><div class="panel">En attente de la manche…</div></div>`;
  }
  const right = `<div class="side right"><div class="panel log">${(v.log || []).map(l => `<div class="l ${l.kind}">${esc(l.text)}</div>`).join('')}</div>
    ${ses && !ses.local ? `<div class="panel chat"><div class="msgs">${S.chat.map(m => `<div><b>${esc(m.name)}</b> : ${esc(m.text)}</div>`).join('')}</div><form data-form="chat"><input type="text" name="text" placeholder="Message…" maxlength="300"><button class="btn small">Envoyer</button></form></div>` : ''}</div>`;
  return `<div class="table">${top}${left}${center}${right}</div>${S.error ? `<div class="err" style="position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:60">${esc(S.error)}</div>` : ''}${S.status ? `<div class="status" style="position:fixed;top:8px;left:50%;transform:translateX(-50%);background:#2a1a1d;padding:.3em 1em;border-radius:8px;z-index:60">${esc(S.status)}</div>` : ''}`;
}

function renderResult() {
  const v = S.view, r = v.round, res = r.result, ses = S.session;
  const howTxt = { shoubu: 'Shoubu', cancel: 'Annulation du sage', exhausted: 'Mains épuisées', solo: 'Un seul volontaire', split: 'Partage du pot' }[res.how] || res.how;
  const pts = r.active.length ? `<table><tr><th>Joueur</th><th class="v">Points</th><th class="v">Écailles</th><th>Dekiyaku</th></tr>${r.active.map(p => `<tr><td>${esc(pname(p))}</td><td class="v">${res.pts[p] ?? ''}</td><td class="v">${res.chaffN[p] ?? ''}</td><td>${(r.dekiyaku[p] && r.dekiyaku[p].list.map(y => esc(y.name)).join(', ')) || '—'}</td></tr>`).join('')}</table>` : '';
  const pays = res.payments.length ? `<table><tr><th>De</th><th>À</th><th>Motif</th><th class="v">Montant</th></tr>${res.payments.map(p => `<tr><td>${esc(pname(p.from))}</td><td>${esc(pname(p.to))}</td><td>${esc(p.label)}</td><td class="v kan">${fmt(p.pts)}</td></tr>`).join('')}</table>` : '<p class="muted">Aucun paiement.</p>';
  const scores = `<table><tr>${v.players.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr><tr>${v.players.map(p => `<td class="kan ${res.scores[p.id] > 0 ? 'pos' : (res.scores[p.id] < 0 ? 'neg' : '')}">${fmt(res.scores[p.id], true)}</td>`).join('')}</tr></table>`;
  const final = v.finished ? `<h2>Partie terminée</h2><ol>${v.final.map(p => `<li><b>${esc(p.name)}</b> — <span class="kan">${fmt(p.score, true)}</span></li>`).join('')}</ol>` : '';
  return `<div class="overlay"><div class="modal">
    <div class="row" style="justify-content:space-between"><h2 style="margin:0">Manche ${r.month} — ${howTxt}${res.special ? ` · <span class="gold">${esc(res.special)} !</span>` : ''}</h2><span class="row">${v.finished ? '' : (ses.isHost ? `<button class="btn primary small" data-act="next">Manche suivante</button>` : '')}<button class="btn small" data-act="closemodal">Voir la table</button></span></div>
    ${res.winner ? `<p>Vainqueur : <b>${esc(pname(res.winner))}</b>${res.achievements.length ? ' · ' + res.achievements.map(a => `${esc(a.name)} (${esc(pname(a.pid))})`).join(', ') : ''}. Multiplicateur ×${r.mult}.</p>` : ''}
    ${pts}<h3>Paiements</h3>${pays}<h3>Scores</h3>${scores}${final}
    <div class="actions">${v.finished ? (ses.isHost ? `<button class="btn primary" data-act="newgame">Nouvelle partie (mêmes joueurs)</button>` : '<span class="muted">L’hôte peut relancer une partie.</span>') : (ses.isHost ? `<button class="btn primary" data-act="next">Manche suivante</button>` : '<span class="status">En attente de l’hôte pour la manche suivante…</span>')}<button class="btn" data-act="closemodal">Voir la table</button></div>
  </div></div>`;
}
function renderHistory() {
  const v = S.view;
  return `<div class="overlay" data-act="closemodal"><div class="modal" onclick="event.stopPropagation()"><h2>Historique</h2>
    <table class="hist"><tr><th>Manche</th><th>Fin</th><th>Vainqueur</th>${v.players.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr>
    ${v.history.map(h => `<tr><td>${h.month}</td><td>${esc({ shoubu: 'shoubu', cancel: 'annulation', exhausted: 'épuisées', solo: 'solo', split: 'partage' }[h.how] || h.how)}${h.special ? ' · ' + esc(h.special) : ''}</td><td>${h.winner ? esc(pname(h.winner)) : '—'}</td>${v.players.map(p => `<td class="kan">${fmt(h.scores[p.id], true)}</td>`).join('')}</tr>`).join('')}</table>
    <div class="actions"><button class="btn" data-act="closemodal">Fermer</button></div></div></div>`;
}
function renderRules() {
  const T = (rows) => `<table>${rows.map(([v, n, d]) => `<tr><td class="v"><b>${v}</b></td><td><b>${n}</b>${d ? `<br><span class="muted">${d}</span>` : ''}</td></tr>`).join('')}</table>`;
  return `<div class="overlay" data-act="closemodal"><div class="modal ref" onclick="event.stopPropagation()">
    <h2>Aide de jeu</h2>
    <h3>Déroulé d’une manche</h3>
    <p>Donne : 7 cartes chacun, 6 en rivière. Le multiplicateur du champ dépend des lumières en rivière (Grue, Rideau, Lune : ×2 ; Pluie, Phénix : ×4 ; plusieurs : la plus forte maintenant, les autres reportées) et s’applique à <b>tous</b> les paiements. Les teyaku (combinaisons en main) sont annoncés automatiquement. Chacun à son tour joue une carte de sa main en rivière (même mois = capture obligatoire ; deux possibles : au choix ; trois : on prend tout) puis retourne la carte du dessus de la pioche et la joue pareil. Un dekiyaku formé ou amélioré impose de dire <b>sage</b> (continuer) ou <b>shoubu</b> (arrêter). Un joueur en sage peut annuler au début de son tour (moitié des points).</p>
    <p>Fin — shoubu : chaque adversaire paie le total des dekiyaku (un adversaire en sage paie double, l’autre rien) ; annulation : moitié ; mains épuisées : chacun touche la moitié de ses dekiyaku, le premier sage gagne. Sans dekiyaku : (points capturés − 88) × multiplicateur (à deux : la différence). Le vainqueur devient OYA.</p>
    <h3>Teyaku · groupe A (séries)</h3>${T([['2 kan', 'Brelan — sanbon', 'trois cartes d’un même mois'], ['3 kan', 'Brelan debout — tatesanbon', 'Glycine, Iris, Lespédèze, ou les trois écailles de Paulownia'], ['6 kan', 'Deux brelans — futasanbon'], ['7 kan', 'Brelan et brelan debout'], ['8 kan', 'Deux brelans debout'], ['4 kan', 'Trois paires — kuttsuki'], ['6 kan', 'Carré — teshi'], ['7 kan', 'Brelan et deux paires — haneken'], ['8 kan', 'Un-deux-quatre — ichinishi', 'carré + paire + seule'], ['20 kan', 'Quatre-trois — shisou', 'carré + brelan']])}
    <h3>Teyaku · groupe B (écailles — tout le Saule compte écaille)</h3>${T([['2 kan', 'Rouge — aka', 'deux rubans ou plus, le reste en écailles'], ['3 kan', 'Un ruban — tan’ichi'], ['3 kan', 'Un animal — toichi'], ['4 kan', 'Une lumière — pikaichi'], ['4 kan', 'Main vide — karasu', 'sept écailles']])}
    <p>Le meilleur de chaque groupe compte, A et B se cumulent, payés par chaque adversaire en fin de manche.</p>
    <h3>Dekiyaku (captures)</h3>${T([['12 kan', 'Cinq Lumières — gokou'], ['10 kan', 'Quatre Lumières — shikou', 'sans l’Homme à la pluie'], ['10 kan', 'Sept Rubans — nanatan', 'sans le ruban de Saule'], ['7 kan', 'Rubans-poèmes — akatan', 'Pin, Abricotier, Cerisier'], ['7 kan', 'Rubans bleus — aotan', 'Pivoine, Chrysanthème, Érable'], ['7 kan', 'Sanglier-Cerf-Papillons', 'variante']])}
    <h3>Valeurs et cas spéciaux (3 joueurs, sans dekiyaku)</h3>
    <p>Lumière 20 · Animal 10 · Ruban 5 · Écaille 1 — total 264, par 88. <b>Tous-les-Huit</b> (chacun 88) : l’OYA encaisse 10 kan de chacun. <b>Double-Huit</b> (168+) : 10 kan de chacun, +1 par point au-delà. <b>Seize Écailles</b> (16+, Saule compris) : 12 kan de chacun, +2 par écaille au-delà. Ces cas annulent tout le reste. Hauts faits (1 kan de chacun) : <b>Plongeon</b>, teyaku A avec brelan sans carré puis capture des quatre cartes du mois ; <b>Évasion</b>, teyaku B sauf Une lumière puis 89 points ou plus.</p>
    <h3>4 à 6 joueurs : phase d’abandon</h3>
    <p>Après la donne, en partant de l’OYA, chacun annonce « je joue » ou « je passe » jusqu’à trois joueurs. Passer coûte 1 kan, puis 1,5 · 2 · 2,5… au pot (× multiplicateur). Une fois trois joueurs en jeu, les suivants sont forcés dehors et reçoivent une compensation de main des deux actifs non-OYA (moitié des teyaku, moitié des dekiyaku complets, 3 pts par carte utile aux Cinq Lumières / Rubans-poèmes / Rubans bleus). Les mains inactives retournent dans la pioche. Le vainqueur de la manche ramasse le pot.</p>
    <div class="actions"><button class="btn" data-act="closemodal">Fermer</button></div></div></div>`;
}

function render() {
  let html = '';
  if (S.screen === 'home' || !S.session) html = renderHome();
  else if (S.screen === 'lobby') html = renderLobby();
  else html = renderTable();
  if (S.modal === 'rules') html += renderRules();
  else if (S.modal === 'history' && S.view) html += renderHistory();
  else if (S.screen === 'table' && S.view && S.view.round && S.view.round.phase === 'end' && S.modal !== 'closed') html += renderResult();
  app.innerHTML = html;
  const logEl = app.querySelector('.log'); if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

// ---------------------------------------------------------- événements
app.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const [cmd, arg] = t.dataset.act.split(':');
  if (t.tagName === 'A') e.preventDefault();
  const form = t.closest('form');
  switch (cmd) {
    case 'create': e.preventDefault(); if (form.reportValidity()) create(form, false); break;
    case 'solo': e.preventDefault(); if (form.reportValidity()) create(form, true); break;
    case 'join': e.preventDefault(); if (form.reportValidity()) join(form); break;
    case 'copy': { const i = app.querySelector('#link'); i.select(); navigator.clipboard && navigator.clipboard.writeText(i.value); S.status = 'Lien copié.'; render(); break; }
    case 'addbot': S.session.addBot(); break;
    case 'remove': S.session.removePlayer(arg); break;
    case 'start': try { S.modal = null; S.session.start(); } catch (err) { S.error = err.message; render(); } break;
    case 'play': act_(() => act({ type: 'play', card: +arg })); break;
    case 'choose': act_(() => act({ type: 'choose', card: +arg })); break;
    case 'sage': act_(() => act({ type: 'sage' })); break;
    case 'shoubu': act_(() => act({ type: 'shoubu' })); break;
    case 'cancel': if (confirm('Annuler votre sage et arrêter la manche pour la moitié de vos dekiyaku ?')) act_(() => act({ type: 'cancel' })); break;
    case 'drop': act_(() => act({ type: 'dropout', choice: arg })); break;
    case 'next': S.modal = null; S.session.nextRound(); break;
    case 'newgame': { S.modal = null; const ses = S.session; ses.lobby.started = false; ses.game = null; S.view = null; S.screen = 'lobby'; ses._broadcastLobby(); render(); break; }
    case 'rules': S.modal = 'rules'; render(); break;
    case 'history': S.modal = 'history'; render(); break;
    case 'closemodal': if (e.target !== t && t.classList.contains('overlay')) return; S.modal = (S.view && S.view.round && S.view.round.phase === 'end') ? 'closed' : null; render(); break;
    case 'leave': if (!S.session || S.screen !== 'table' || confirm('Quitter la table ?')) leave(); break;
  }
});
function act_(f) { S.hover = null; f(); }
app.addEventListener('submit', e => {
  const f = e.target; e.preventDefault();
  if (f.dataset.form === 'chat') { const text = f.text.value.trim(); if (text) S.session.chat(text); f.text.value = ''; }
  else if (f.dataset.form === 'create') create(f, false);
  else if (f.dataset.form === 'join') join(f);
});
app.addEventListener('mouseover', e => {
  const c = e.target.closest('.hand .card.playable'); const id = c ? +c.dataset.id : null;
  if (id !== S.hover) { S.hover = id; const v = S.view; if (v && v.round) { const m = id != null ? CARDS[id].month : null; app.querySelectorAll('.river .card').forEach(el => el.classList.toggle('match', m != null && CARDS[+el.dataset.id].month === m && !el.classList.contains('choice'))); } }
});
app.addEventListener('mouseleave', () => { S.hover = null; }, true);
window.addEventListener('beforeunload', () => { if (S.session) S.session.leave(); });
window.addEventListener('hashchange', () => { S.joinCode = location.hash.slice(1).toUpperCase(); if (S.screen === 'home') render(); });
S.cards = CARDS; window.HH = S;   // état exposé pour le débogage / les tests E2E
render();
