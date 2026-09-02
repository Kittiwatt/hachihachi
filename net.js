// net.js — Session de jeu : hôte-arbitre (moteur local) et invités, sur Trystero (P2P WebRTC).
// Protocole (JSON, hôte-autoritaire) :
//   hello  invité → tous  {name, token, playerId?}      j'arrive / je reviens
//   lobby  hôte → tous    {hostPeer, players, settings, started}
//   view   hôte → un pair {view}                         vue filtrée (viewFor)
//   act    invité → hôte  {action}                       action de jeu
//   cmd    invité → hôte  {cmd, ...}                     commandes de salon (rename)
//   err    hôte → un pair {msg}
//   chat   tous → tous    {name, text}
// Migration : si l'hôte disparaît, le pair connecté au plus petit selfId reconstruit la partie
// à partir de la dernière vue publique et redistribue la manche en cours (scores conservés).
import * as H from './core.js?v=202609022110';
import { botAction } from './bot.js?v=202609022110';

export const APP_ID = 'anofelis-hachihachi-v1';
// ---------------------------------------------------------------- TURN
// Ordre : config.js (URL de credentials Metered ou liste explicite) puis repli Open Relay en
// authentification statique : identifiants temporaires dérivés du secret publié (12 h).
const STATIC_AUTH = { host: 'staticauth.openrelay.metered.ca', secret: 'openrelayprojectsecret' };
export async function iceServers() {
  let cfg = {};
  try { cfg = await import('./config.js?v=202609022110'); } catch (e) { /* pas de config.js */ }
  if (cfg.TURN_CREDENTIALS_URL) {
    try {
      const r = await fetch(cfg.TURN_CREDENTIALS_URL, { cache: 'no-store' });
      if (r.ok) { const list = await r.json(); if (Array.isArray(list) && list.length) return { servers: list, source: 'config-url' }; }
    } catch (e) { console.warn('TURN_CREDENTIALS_URL injoignable, repli', e); }
  }
  if (Array.isArray(cfg.TURN_SERVERS) && cfg.TURN_SERVERS.length) return { servers: cfg.TURN_SERVERS, source: 'config-list' };
  return { servers: await staticAuthServers(), source: 'openrelay-static' };
}
export async function staticAuthServers(ttlSeconds = 12 * 3600, now = Date.now()) {
  const username = `${Math.floor(now / 1000) + ttlSeconds}:hachihachi`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(STATIC_AUTH.secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(username)));
  const credential = btoa(String.fromCharCode(...sig));
  const h = STATIC_AUTH.host;
  return [{ urls: [`turn:${h}:80`, `turn:${h}:443`, `turn:${h}:80?transport=tcp`, `turn:${h}:443?transport=tcp`, `turns:${h}:443`], username, credential }];
}
// Diagnostic : collecte de candidats ICE avec les serveurs donnés. relay = un TURN répond.
export function diagnose(servers, ms = 8000) {
  return new Promise(resolve => {
    const t0 = Date.now(), types = new Set(), errors = [];
    let pc;
    try { pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }, ...servers] }); }
    catch (e) { return resolve({ ok: false, host: false, srflx: false, relay: false, errors: [String(e)], ms: 0 }); }
    const done = () => { pc.close(); resolve({ ok: types.has('relay'), host: types.has('host'), srflx: types.has('srflx'), relay: types.has('relay'), errors, ms: Date.now() - t0 }); };
    pc.onicecandidate = e => { if (e.candidate) { types.add(e.candidate.type); if (types.has('relay') && types.has('srflx')) done(); } else done(); };
    pc.onicecandidateerror = e => { if (e.errorCode >= 700 || e.errorCode === 401) errors.push(`${e.url || ''} ${e.errorCode} ${e.errorText || ''}`.trim()); };
    pc.createDataChannel('diag');
    pc.createOffer().then(o => pc.setLocalDescription(o)).catch(e => { errors.push(String(e)); done(); });
    setTimeout(done, ms);
  });
}
const explainJoinError = d => {
  const raw = (d && d.error && d.error.message) || (d && d.error) || 'inconnu';
  if (/after exchanging SDP|TURN/i.test(raw)) return "Impossible d'établir la liaison avec un joueur : un des deux réseaux bloque le pair-à-pair et le relais TURN n'a pas suffi. Utilisez « Tester ma connexion » sur l'accueil (chacun de son côté), essayez un autre réseau (partage 4G), ou configurez un relais TURN dans config.js (voir README).";
  return 'Connexion impossible : ' + raw;
};

export const makeCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const rndToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export class Session {
  constructor({ code, name, isHost, settings, onView, onLobby, onStatus, onError, onChat, trystero, local = false, ice = [] }) {
    this.ice = ice;
    this.code = code; this.name = name; this.isHost = isHost; this.local = local;
    this.onView = onView; this.onLobby = onLobby; this.onStatus = onStatus; this.onError = onError; this.onChat = onChat;
    this.settings = settings || {};
    this.token = localStorage.getItem('hh_token_' + code) || rndToken();
    localStorage.setItem('hh_token_' + code, this.token);
    this.me = null;                 // mon playerId
    this.game = null;               // hôte seulement
    this.lobby = { hostPeer: null, players: [], settings: this.settings, started: false };
    this.tokens = {};               // hôte : token -> playerId
    this.peerOf = {};               // hôte : playerId -> peerId
    this.lastView = null; this.botTimer = null; this.hostPeer = null; this.migrating = false;
    if (!local) this._connect(trystero);
    if (isHost) this._hostInit();
  }

  // ------------------------------------------------------------ transport
  _connect(T) {
    this.T = T;
    this.room = T.joinRoom({ appId: APP_ID, turnConfig: this.ice }, this.code, {
      onJoinError: d => this.onError && this.onError(explainJoinError(d)),
    });
    this.selfId = T.selfId;
    const mk = n => this.room.makeAction(n);
    this.A = { hello: mk('hello'), lobby: mk('lobby'), view: mk('view'), act: mk('act'), cmd: mk('cmd'), err: mk('err'), chat: mk('chat'), seat: mk('seat') };
    this.A.seat.onMessage = d => { this.me = d.playerId; };
    this.A.hello.onMessage = (d, { peerId }) => this._onHello(d, peerId);
    this.A.lobby.onMessage = (d, { peerId }) => this._onLobby(d, peerId);
    this.A.view.onMessage = (d, { peerId }) => { this.hostPeer = peerId; this.lastView = d.view; this.me = d.view.me; this.onView && this.onView(d.view); };
    this.A.act.onMessage = (d, { peerId }) => this._onAct(d, peerId);
    this.A.cmd.onMessage = (d, { peerId }) => this._onCmd(d, peerId);
    this.A.err.onMessage = d => this.onError && this.onError(d.msg);
    this.A.chat.onMessage = d => this.onChat && this.onChat(d);
    this.room.onPeerJoin = peerId => {
      this.onStatus && this.onStatus('Un joueur se connecte…');
      if (this.isHost) this._broadcastLobby();
      else this.A.hello.send({ name: this.name, token: this.token, playerId: this.me }, { target: peerId });
    };
    this.room.onPeerLeave = peerId => this._onPeerLeave(peerId);
    if (!this.isHost) { this.onStatus && this.onStatus('Recherche de la table ' + this.code + '…'); }
  }
  peers() { return this.room ? Object.keys(this.room.getPeers()) : []; }
  leave() { clearTimeout(this.botTimer); if (this.room) this.room.leave(); }

  // ---------------------------------------------------------------- hôte
  _hostInit() {
    this.hostPeer = this.selfId || 'local';
    this.me = 'p1';
    this.tokens[this.token] = 'p1';
    this.lobby = { hostPeer: this.hostPeer, settings: this.settings, started: false,
      players: [{ id: 'p1', name: this.name, bot: false, connected: true }] };
    this.onLobby && this.onLobby(this.lobby);
  }
  _seatFor(peerId, name, token, claimed) {
    const L = this.lobby;
    if (this.tokens[token]) {                       // retour d'un joueur connu
      const pid = this.tokens[token]; const p = L.players.find(x => x.id === pid);
      if (p) { p.connected = true; p.name = name || p.name; this.peerOf[pid] = peerId; return pid; }
    }
    if (claimed) {                                  // après migration : reprise du siège annoncé
      const p = L.players.find(x => x.id === claimed && !x.bot);
      if (p && (!p.connected || !this.peerOf[claimed])) { p.connected = true; p.name = name || p.name; this.tokens[token] = claimed; this.peerOf[claimed] = peerId; return claimed; }
    }
    if (L.started) {                                // partie en cours : remplacer un bot ? un déconnecté ?
      const free = L.players.find(x => !x.bot && !x.connected) || L.players.find(x => x.bot);
      if (!free) return null;
      free.connected = true; free.bot = false; free.name = name; this.tokens[token] = free.id; this.peerOf[free.id] = peerId;
      if (this.game) { const gp = this.game.players.find(x => x.id === free.id); gp.bot = false; gp.name = name; }
      return free.id;
    }
    if (L.players.length >= 6) return null;
    const id = 'p' + (Math.max(0, ...L.players.map(x => +x.id.slice(1))) + 1);
    L.players.push({ id, name, bot: false, connected: true });
    this.tokens[token] = id; this.peerOf[id] = peerId;
    return id;
  }
  _onHello(d, peerId) {
    if (!this.isHost) return;
    const pid = this._seatFor(peerId, d.name, d.token, d.playerId);
    if (!pid) { this.A.err.send({ msg: 'Table complète (6 joueurs).' }, { target: peerId }); return; }
    this.A.seat.send({ playerId: pid }, { target: peerId });
    this._broadcastLobby();
    if (this.game) this._sendView(pid);
  }
  _onCmd(d, peerId) {
    if (!this.isHost) return;
    const pid = Object.keys(this.peerOf).find(k => this.peerOf[k] === peerId); if (!pid) return;
    if (d.cmd === 'rename' && d.name) { const p = this.lobby.players.find(x => x.id === pid); if (p) p.name = String(d.name).slice(0, 20); if (this.game) this.game.players.find(x => x.id === pid).name = p.name; this._broadcastLobby(); this._pushViews(); }
  }
  _onAct(d, peerId) {
    if (!this.isHost || !this.game) return;
    const pid = Object.keys(this.peerOf).find(k => this.peerOf[k] === peerId);
    if (!pid) return;
    try { this.act(pid, d.action); } catch (e) { this.A.err.send({ msg: e.message }, { target: peerId }); }
  }
  _broadcastLobby() {
    if (!this.isHost) return;
    this.lobby.hostPeer = this.hostPeer;
    this.onLobby && this.onLobby(this.lobby);
    if (this.room) this.A.lobby.send(this.lobby);
  }
  addBot() {
    const L = this.lobby; if (L.players.length >= 6) return;
    const id = 'p' + (Math.max(0, ...L.players.map(x => +x.id.slice(1))) + 1);
    const names = ['Kiku', 'Momiji', 'Sakura', 'Fuji', 'Ayame', 'Matsu'];
    L.players.push({ id, name: names[L.players.length % names.length] + ' (bot)', bot: true, connected: true });
    this._broadcastLobby();
  }
  removePlayer(pid) {
    if (this.lobby.started || pid === this.me) return;
    this.lobby.players = this.lobby.players.filter(p => p.id !== pid);
    Object.keys(this.tokens).forEach(t => { if (this.tokens[t] === pid) delete this.tokens[t]; });
    delete this.peerOf[pid];
    this._broadcastLobby();
  }
  setSettings(s) { this.lobby.settings = this.settings = s; this._broadcastLobby(); }
  start(seed) {
    if (!this.isHost) throw new Error('Seul l’hôte lance la partie');
    const L = this.lobby;
    if (L.players.length < 2) throw new Error('Il faut au moins deux joueurs');
    this.game = H.newGame({ players: L.players.map(p => ({ id: p.id, name: p.name, bot: p.bot })), settings: this.settings, seed: seed || (Date.now() & 0x7fffffff) });
    H.startRound(this.game);
    L.started = true;
    this._broadcastLobby();
    this._pushViews();
  }
  nextRound() {
    if (!this.isHost || !this.game || this.game.finished) return;
    if (this.game.round && this.game.round.phase !== 'end') return;
    H.startRound(this.game); this._pushViews();
  }
  act(pid, action) {
    if (!this.isHost) { this.A.act.send({ action }, { target: this.hostPeer }); return; }
    H.applyAction(this.game, pid, action);
    this._pushViews();
  }
  _sendView(pid) {
    const v = H.viewFor(this.game, pid);
    v.hostPeer = this.hostPeer; v.connected = Object.fromEntries(this.lobby.players.map(p => [p.id, p.connected]));
    if (pid === this.me) { const snap = structuredClone(v); this.lastView = snap; this.onView && this.onView(snap); }   // copie : la vue locale ne doit pas partager l'état vivant du moteur
    else if (this.peerOf[pid] && this.room) this.A.view.send({ view: v }, { target: this.peerOf[pid] });
  }
  _pushViews() {
    if (!this.game) return;
    for (const p of this.game.players) if (!p.bot) this._sendView(p.id);
    this._scheduleBots();
  }
  _scheduleBots() {
    clearTimeout(this.botTimer);
    const g = this.game; if (!g || g.finished) return;
    const r = g.round; if (!r) return;
    if (r.phase === 'end') {
      // manche suivante automatique si tous les humains sont... non : bouton de l'hôte. Sauf partie 100 % bots.
      if (g.players.every(p => p.bot || p.id === this.me) && g.players.filter(p => !p.bot).length === 1 && this.autoNext) this.botTimer = setTimeout(() => this.nextRound(), 4000);
      return;
    }
    const pid = r.phase === 'dropout' ? r.dropout.order[r.dropout.idx] : r.turn.pid;
    const p = g.players.find(x => x.id === pid);
    const disconnected = !p.bot && this.lobby.players.find(x => x.id === pid) && !this.lobby.players.find(x => x.id === pid).connected;
    if (!p.bot && !disconnected) return;
    this.botTimer = setTimeout(() => {
      try { const a = botAction(H.viewFor(g, pid)); if (a) this.act(pid, a); } catch (e) { console.error(e); }
    }, disconnected ? 15000 : 1800);
  }

  // -------------------------------------------------------------- invité
  _onLobby(d, peerId) {
    this.hostPeer = peerId; this.lobby = d;
    if (!this.me) { const mine = d.players.find(p => p.name === this.name && p.connected && !p.bot); this.me = mine ? mine.id : this.me; }
    this.onStatus && this.onStatus('');
    this.onLobby && this.onLobby(d);
  }
  rename(name) { this.name = name; if (this.isHost) { const p = this.lobby.players.find(x => x.id === this.me); p.name = name; if (this.game) this.game.players.find(x => x.id === this.me).name = name; this._broadcastLobby(); this._pushViews(); } else this.A.cmd.send({ cmd: 'rename', name }, { target: this.hostPeer }); }
  chat(text) { const m = { name: this.name, text: String(text).slice(0, 300) }; this.onChat && this.onChat(m); if (this.room) this.A.chat.send(m); }

  // --------------------------------------------- départs & migration
  _onPeerLeave(peerId) {
    if (this.isHost) {
      const pid = Object.keys(this.peerOf).find(k => this.peerOf[k] === peerId);
      if (pid) { const p = this.lobby.players.find(x => x.id === pid); if (p) p.connected = false; delete this.peerOf[pid]; this._broadcastLobby(); this._scheduleBots(); }
      return;
    }
    if (peerId !== this.hostPeer) return;
    this.onStatus && this.onStatus("L'hôte a quitté la table… reprise dans quelques secondes.");
    setTimeout(() => this._maybeTakeOver(peerId), 4000);
  }
  _maybeTakeOver(oldHost) {
    if (this.isHost || this.hostPeer !== oldHost || !this.lastView) return;
    const alive = this.peers();
    const candidates = [this.selfId, ...alive].sort();
    if (candidates[0] !== this.selfId) { this.onStatus && this.onStatus('Un autre joueur reprend l’arbitrage…'); return; }
    // je deviens l'hôte : reconstruction depuis la dernière vue publique
    const v = this.lastView;
    this.isHost = true; this.hostPeer = this.selfId; this.migrating = true;
    this.lobby = { hostPeer: this.selfId, settings: v.settings, started: true,
      players: v.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, connected: p.bot || p.id === this.me })) };
    this.tokens = { [this.token]: this.me }; this.peerOf = {};
    const g = H.newGame({ players: v.players.map(p => ({ id: p.id, name: p.name, bot: p.bot })), settings: v.settings, seed: Date.now() & 0x7fffffff });
    Object.assign(g.scores, v.scores); g.month = v.round && v.round.phase !== 'end' ? v.round.month : v.month;
    g.dealer = v.round && v.round.phase !== 'end' ? v.round.dealer : v.dealer; g.carry = v.carry.slice(); g.history = v.history.slice(); g.log = v.log.slice();
    g.pot = (v.round && v.round.phase !== 'end' ? v.round.pot : v.pot) || 0;
    // les pénalités d'abandon déjà versées restent au pot ; les mains sont perdues : on redonne
    g.log.push({ n: g.log.length, month: g.month, kind: 'warn', text: `L'hôte a disparu : ${this.name} reprend l'arbitrage et redonne la manche ${g.month}.` });
    this.game = g;
    if (!g.finished) H.startRound(g);
    this.onStatus && this.onStatus('Vous êtes maintenant l’hôte.');
    this._broadcastLobby();
    this._pushViews();
  }
}
