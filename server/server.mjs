// server.mjs — the online room server for 霜烬之争 (V3).
//
//   node server/server.mjs            → http://<this machine>:8790/      the game itself (dist/frostember.html)
//                                       ws://<this machine>:8790/ws      rooms and matches
//
// How online play works: every player's machine runs the whole match. The server never simulates anything; it seats people,
// picks the bots, hands everyone the same seed and lineup, and then every 50 ms sends out a "turn": the commands every player
// gave since the last one. Each machine applies a turn's commands and then takes three steps of 1/60 s, so all of them play
// out exactly the same match (see src/dmath.js and G.step in src/game.js). Every two seconds the machines send a fingerprint
// of the match; if two ever differ the room is told (and it is written to the log), which should never happen.
//
// A player who drops keeps their seat: their cultivator plays itself (a "bot" command) until they come back, and coming back
// replays the match so far from the turn log in a few seconds. Rooms with nobody left in them close after two minutes.
import http from 'node:http'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { HEROES, HERO_ORDER, MODES, SEATS, SEAT_FIT, T } from '../src/config.js';

// the page it hands out: FROSTEMBER_HTML when set (the server app carries its own copy), else this checkout's build
const HTML_PATH = process.env.FROSTEMBER_HTML || path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'dist/frostember.html');
const PORT = +process.env.PORT || 8790, HOST = process.env.HOST || undefined, TURN_MS = 50, TPT = 3, HASH_EVERY = 40;
// open to the public (behind a proxy that sets X-Forwarded-For, e.g. Caddy): TRUST_PROXY=1. Limits keep one person from
// filling the machine: connections per address, messages per second per connection, rooms in all, rooms opened per minute.
const TRUST_PROXY = process.env.TRUST_PROXY === '1', MAX_CONN_PER_IP = 8, MAX_ROOMS = 400, MSG_RATE = 60, MSG_BURST = 150;
const perIp = new Map();                                   // address → { conns, made: [times rooms were opened], misses: [times a code was wrong] }
const ipOf = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
const ipRec = ip => { let r = perIp.get(ip); if (!r) perIp.set(ip, r = { conns: 0, made: [], misses: [] }); return r; };
const recent = (list, ms) => { const now = Date.now(); while (list.length && now - list[0] > ms) list.shift(); return list.length; };
const log = (...a) => console.log(new Date().toISOString().slice(5, 19), ...a);

// ---------------- the page ----------------
let page = null, pageAt = 0;
const html = () => { const f = HTML_PATH; try { const m = fs.statSync(f).mtimeMs; if (m !== pageAt) { page = fs.readFileSync(f); pageAt = m; } } catch { page = null; } return page; };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(`ok ${rooms.size} rooms`); return; }
  if (u.pathname === '/' || u.pathname === '/index.html') {
    const b = html(); if (!b) { res.writeHead(503); res.end('build first: node build.mjs'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); res.end(b); return;
  }
  res.writeHead(404); res.end();
});

// ---------------- rooms ----------------
const rooms = new Map(), byCid = new Map();          // code → room; cid → { ws, name, room }
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += CODE[crypto.randomInt(CODE.length)]; if (!rooms.has(c)) return c; } };
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const sizeOf = mode => MODES[mode].team;
const blankSeats = mode => [0, 1].map(() => Array.from({ length: sizeOf(mode) }, () => ({ cid: null, hero: null, ready: false })));

function makeRoom(mode, host) {
  const r = { code: newCode(), mode, diff: 'normal', host, members: new Map(), seats: blankSeats(mode), state: 'lobby', game: null, emptyAt: 0, made: Date.now() };
  rooms.set(r.code, r); log('room', r.code, mode); return r;
}
const seatOf = (r, cid) => { for (let t = 0; t < 2; t++) for (let i = 0; i < r.seats[t].length; i++) if (r.seats[t][i].cid === cid) return [t, i]; return null; };
// who may take a cultivator: in 一路 nobody twice in the whole match, in 三路 nobody twice on one side
const taken = (r, hero, team, except) => r.seats.some((side, t) => (r.mode === 'single' || t === team) && side.some(q => q !== except && q.hero === hero));
function roomView(r) {
  return { t: 'room', code: r.code, mode: r.mode, diff: r.diff, host: r.host, state: r.state,
    members: [...r.members.values()].map(m => ({ cid: m.cid, name: m.name, online: !!m.ws })),
    seats: r.seats.map(side => side.map(q => ({ cid: q.cid, hero: q.hero, ready: q.ready, name: q.cid ? (r.members.get(q.cid) || {}).name || '' : '' }))) };
}
const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
const toRoom = (r, m, filter) => { const s = JSON.stringify(m); for (const x of r.members.values()) if (x.ws && x.ws.readyState === 1 && (!filter || filter(x))) x.ws.send(s); };
const update = r => toRoom(r, roomView(r));

function leave(cid, quiet) {
  const c = byCid.get(cid), r = c && c.room; if (!r) return; c.room = null;
  if (r.state === 'playing') { const m = r.members.get(cid); if (m) m.ws = null; dropped(r, cid); }
  else { r.members.delete(cid); const s = seatOf(r, cid); if (s) r.seats[s[0]][s[1]] = { cid: null, hero: null, ready: false }; }
  if (r.host === cid) { const next = [...r.members.values()].find(m => m.ws); if (next) r.host = next.cid; }
  if (!quiet) update(r);
}

// ---------------- a match ----------------
function fillBots(r) {   // empty seats get bots, chosen the way the single-player game draws its sides
  const N = sizeOf(r.mode), pick = (team, i) => {
    const free = HERO_ORDER.filter(k => !taken(r, k, team));
    if (r.mode === 'tri') { const best = free.filter(k => SEAT_FIT[k][0] === i), fit = free.filter(k => SEAT_FIT[k].includes(i)); const pool = best.length ? best : fit.length ? fit : free; return pool[crypto.randomInt(pool.length)]; }
    const hasFront = r.seats[team].some(q => q.hero && !HEROES[q.hero].ranged), melee = free.filter(k => !HEROES[k].ranged);
    const pool = !hasFront && melee.length ? melee : free; return pool[crypto.randomInt(pool.length)];
  };
  for (let t = 0; t < 2; t++) for (let i = 0; i < N; i++) { const q = r.seats[t][i]; if (!q.hero) q.hero = pick(t, i); }
}
function startMatch(r) {
  fillBots(r);
  const lineup = []; for (let t = 0; t < 2; t++) r.seats[t].forEach((q, i) => lineup.push({ team: t, slot: i, hero: q.hero, human: !!q.cid, name: q.cid ? r.members.get(q.cid).name : '', cid: q.cid }));
  const g = r.game = { seed: crypto.randomInt(2 ** 31), lineup, n: 0, log: [], bucket: [], hashes: new Map(), overAt: 0, desync: false, started: Date.now() };
  r.state = 'playing';
  for (const m of r.members.values()) sendStart(r, m);
  g.timer = setInterval(() => turn(r), TURN_MS);
  log('start', r.code, r.mode, lineup.map(q => (q.human ? q.name + ':' : '') + q.hero).join(' '));
  update(r);
}
function sendStart(r, m) {
  const g = r.game, me = g.lineup.findIndex(q => q.cid === m.cid);
  send(m.ws, { t: 'start', seed: g.seed, mode: r.mode, diff: r.diff, lineup: g.lineup.map(({ cid, ...q }) => q), me, tpt: TPT, turnMs: TURN_MS, hashEvery: HASH_EVERY, at: g.n, log: g.log });
}
function turn(r) {
  const g = r.game; g.n++; const c = g.bucket; g.bucket = []; g.log.push(c);
  toRoom(r, { t: 'turn', n: g.n, c });
  if (g.overAt && Date.now() - g.overAt > 12000) endMatch(r, 'over');
  else if (Date.now() - g.started > 75 * 60000) endMatch(r, 'time');          // nobody plays this long: something is stuck
}
function endMatch(r, why) {
  const g = r.game; if (!g) return; clearInterval(g.timer); r.game = null; r.state = 'lobby';
  for (const side of r.seats) for (const q of side) { q.ready = false; if (!q.cid) q.hero = null; }            // bots are drawn again next time
  for (const [cid, m] of r.members) if (!m.ws) { r.members.delete(cid); const s = seatOf(r, cid); if (s) r.seats[s[0]][s[1]] = { cid: null, hero: null, ready: false }; }
  log('end', r.code, why, g.n, 'turns', g.desync ? 'DESYNC' : '');
  update(r);
}
function dropped(r, cid) {   // their cultivator plays itself until they come back
  const g = r.game, li = g ? g.lineup.findIndex(q => q.cid === cid) : -1; if (li >= 0) g.bucket.push([li, { c: 'bot', on: true }]);
}

// what a command may look like; anything else is dropped
const NUM = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e4;
const CMD = {
  move: q => NUM(q.x) && NUM(q.z), amove: q => NUM(q.x) && NUM(q.z), atk: q => Number.isInteger(q.id), dir: q => NUM(q.dx) && NUM(q.dz), stop: () => true,
  recall: () => true, sig: q => ['gather', 'attack', 'retreat'].includes(q.type) && NUM(q.x) && NUM(q.z) && Number.isInteger(q.id), rally: q => typeof q.on === 'boolean',
  cast: q => [0, 1, 2, 3].includes(q.i) && NUM(q.x) && NUM(q.z), buy: q => typeof q.id === 'string' && q.id.length < 24, learn: q => [0, 1, 2, 3].includes(q.i), ins: q => q.k === 0 || q.k === 1,
  bot: q => typeof q.on === 'boolean',                                   // 托管: a player hands their cultivator to the bot, or takes it back
};
const KEEP = { move: ['c', 'x', 'z'], amove: ['c', 'x', 'z'], atk: ['c', 'id'], dir: ['c', 'dx', 'dz'], stop: ['c'], recall: ['c'], sig: ['c', 'type', 'x', 'z', 'id'], rally: ['c', 'on'], cast: ['c', 'i', 'x', 'z'], buy: ['c', 'id'], learn: ['c', 'i'], ins: ['c', 'k'], bot: ['c', 'on'] };
const r2 = v => Math.round(v * 100) / 100;

// ---------------- messages ----------------
function onMessage(ws, m) {
  const cid = ws.cid, c = cid && byCid.get(cid), r = c && c.room;
  if (m.t === 'hello') {
    const id = /^[a-z0-9]{8,32}$/.test(m.cid) ? m.cid : crypto.randomBytes(8).toString('hex'); ws.cid = id;
    const old = byCid.get(id); if (old && old.ws && old.ws !== ws) { send(old.ws, { t: 'err', msg: '这个身份在别处登录了' }); old.ws.close(); }
    const me = old || { room: null }; me.ws = ws; me.name = clean(m.name, 12) || '无名修士'; byCid.set(id, me);
    send(ws, { t: 'welcome', cid: id });
    if (me.room) {                                                       // back from a drop: same room, same seat
      const rr = me.room, mm = rr.members.get(id); if (mm) { mm.ws = ws; mm.name = me.name; }
      if (rr.state === 'playing' && rr.game) { sendStart(rr, mm); const li = rr.game.lineup.findIndex(q => q.cid === id); if (li >= 0) rr.game.bucket.push([li, { c: 'bot', on: false }]); }
      update(rr);
    }
    return;
  }
  if (!c) return;
  if (m.t === 'ping') { send(ws, { t: 'pong', c: m.c }); return; }
  if (m.t === 'create') {
    const ip = ipRec(ws.ip); if (rooms.size >= MAX_ROOMS || recent(ip.made, 60000) >= 5) { send(ws, { t: 'err', msg: '开房太频繁了，等一会儿再试' }); return; } ip.made.push(Date.now());
    if (r) leave(cid); if (!MODES[m.mode]) return;
    const rr = makeRoom(m.mode, cid); rr.members.set(cid, { cid, name: c.name, ws }); c.room = rr; rr.seats[0][0].cid = cid; update(rr); return;
  }
  if (m.t === 'join') {
    const ip = ipRec(ws.ip); if (recent(ip.misses, 60000) >= 12) { send(ws, { t: 'err', msg: '试错太多次了，等一会儿再试' }); return; }
    const rr = rooms.get(clean(m.code, 8).toUpperCase()); if (!rr) { ip.misses.push(Date.now()); send(ws, { t: 'err', msg: '没有这个房间' }); return; }
    if (rr === r) { update(rr); return; } if (r) leave(cid);
    if (rr.state === 'playing') { send(ws, { t: 'err', msg: '这一局已经开打了，等打完再进' }); return; }
    if (rr.members.size >= sizeOf(rr.mode) * 2 + 4) { send(ws, { t: 'err', msg: '房间满了' }); return; }
    rr.members.set(cid, { cid, name: c.name, ws }); c.room = rr;
    const free = rr.seats.flatMap((side, t) => side.map((q, i) => [t, i, q])).filter(x => !x[2].cid).sort((a, b) => rr.seats[a[0]].filter(q => q.cid).length - rr.seats[b[0]].filter(q => q.cid).length)[0];
    if (free) free[2].cid = cid;                                         // sit down on the emptier side; anyone can move later
    update(rr); return;
  }
  if (!r) return;
  const host = r.host === cid, mySeat = seatOf(r, cid), q = mySeat && r.seats[mySeat[0]][mySeat[1]];
  switch (m.t) {
    case 'leave': leave(cid); send(ws, { t: 'left' }); return;
    case 'chat': { const text = clean(m.text, 120); if (!text) return; const team = r.state === 'playing' && m.team && mySeat ? mySeat[0] : -1; toRoom(r, { t: 'chat', from: c.name, cid, text, team }, x => team < 0 || (seatOf(r, x.cid) || [-1])[0] === team); return; }
    case 'cmd': {
      const g = r.game, li = g ? g.lineup.findIndex(x => x.cid === cid) : -1; if (li < 0 || !m.q || !CMD[m.q.c] || !CMD[m.q.c](m.q)) return;
      const out = {}; for (const k of KEEP[m.q.c]) out[k] = typeof m.q[k] === 'number' && k !== 'id' && k !== 'i' && k !== 'k' ? r2(m.q[k]) : m.q[k];
      if (out.c === 'move' || out.c === 'dir' || out.c === 'amove') { const j = g.bucket.findIndex(([l, x]) => l === li && x.c === out.c); if (j >= 0) g.bucket.splice(j, 1); }   // only the latest of these counts within a turn
      if (g.bucket.filter(([l]) => l === li).length < 20) g.bucket.push([li, out]);
      return;
    }
    case 'hash': {
      const g = r.game; if (!g || !Number.isInteger(m.k)) return; const was = g.hashes.get(m.k);
      if (was === undefined) { g.hashes.set(m.k, m.h); if (g.hashes.size > 64) g.hashes.delete(g.hashes.keys().next().value); }
      else if (was !== m.h && !g.desync) { g.desync = true; log('DESYNC', r.code, 'turn', m.k, was, m.h, c.name); toRoom(r, { t: 'desync', k: m.k }); }
      return;
    }
    case 'over': { const g = r.game; if (g && !g.overAt) { g.overAt = Date.now(); log('over', r.code, 'winner', m.w, 'turn', g.n); } return; }
  }
  if (r.state !== 'lobby') return;
  switch (m.t) {
    case 'seat': {                                                       // sit in an empty seat (keeping your cultivator if it is allowed there)
      const t = m.team, i = m.slot, to = r.seats[t] && r.seats[t][i]; if (!to || to.cid) return;
      const hero = q ? q.hero : null; if (q) { q.cid = null; q.hero = null; q.ready = false; }
      to.cid = cid; to.hero = hero && !taken(r, hero, t, to) ? hero : null; to.ready = false; break;
    }
    case 'hero': if (q && HEROES[m.id] && !taken(r, m.id, mySeat[0], q)) { q.hero = m.id; q.ready = false; } break;
    case 'ready': if (q && q.hero) q.ready = !!m.on; break;
    case 'mode': if (host && MODES[m.mode] && m.mode !== r.mode) {   // everyone keeps their side and cultivator where they can
      const keep = r.seats.flatMap((side, t) => side.filter(x => x.cid).map(x => [t, x])); r.mode = m.mode; r.seats = blankSeats(m.mode);
      for (const [t, x] of keep) { const side = r.seats[t], free = side.find(s => !s.cid) || r.seats[1 - t].find(s => !s.cid); if (!free) { const mm = r.members.get(x.cid); continue; } free.cid = x.cid; const tt = side.includes(free) ? t : 1 - t; free.hero = x.hero && !taken(r, x.hero, tt, free) ? x.hero : null; }
    } break;
    case 'diff': if (host && T.difficulty[m.diff]) r.diff = m.diff; break;
    case 'kick': if (host && m.cid !== cid && r.members.has(m.cid)) { const k = byCid.get(m.cid); leave(m.cid, true); if (k) send(k.ws, { t: 'left', msg: '你被请出了房间' }); } break;
    case 'start': {
      if (!host) return; const people = r.seats.flat().filter(x => x.cid);
      const notReady = people.filter(x => x.cid !== cid && !(x.ready && x.hero)); if (notReady.length) { send(ws, { t: 'err', msg: '还有人没选好或没准备' }); return; }
      if (q && !q.hero) { send(ws, { t: 'err', msg: '先选一位修士' }); return; }
      startMatch(r); return;
    }
    default: return;
  }
  update(r);
}

// ---------------- sockets ----------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws, req) => {
  ws.ip = ipOf(req); const ip = ipRec(ws.ip);
  if (ip.conns >= MAX_CONN_PER_IP) { ws.close(1013, 'too many'); return; }
  ip.conns++; ws.on('close', () => { if (--ip.conns <= 0 && !ip.made.length && !ip.misses.length) perIp.delete(ws.ip); });
  let tokens = MSG_BURST, at = Date.now();                             // messages per second, with a little slack for bursts
  ws.alive = true; ws.on('pong', () => { ws.alive = true; });
  ws.on('message', d => { const now = Date.now(); tokens = Math.min(MSG_BURST, tokens + (now - at) / 1000 * MSG_RATE); at = now; if (--tokens < 0) { if (tokens < -MSG_BURST) ws.terminate(); return; } let m; try { m = JSON.parse(d); } catch { return; } if (m && typeof m.t === 'string') try { onMessage(ws, m); } catch (e) { log('error', e.stack); } });
  ws.on('close', () => {
    const c = ws.cid && byCid.get(ws.cid); if (!c || c.ws !== ws) return; c.ws = null;
    const r = c.room; if (!r) { byCid.delete(ws.cid); return; }
    const m = r.members.get(ws.cid); if (m) m.ws = null;
    if (r.state === 'playing') dropped(r, ws.cid); else leave(ws.cid);   // in the lobby a drop is a leave
    update(r);
  });
});
setInterval(() => {                                                      // dead sockets, empty rooms
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  const now = Date.now();
  for (const r of rooms.values()) {
    const anyone = [...r.members.values()].some(m => m.ws);
    if (anyone) r.emptyAt = 0; else if (!r.emptyAt) r.emptyAt = now; else if (now - r.emptyAt > 120000) { if (r.game) clearInterval(r.game.timer); rooms.delete(r.code); for (const m of r.members.keys()) { const c = byCid.get(m); if (c && c.room === r) { c.room = null; if (!c.ws) byCid.delete(m); } } log('closed', r.code); }
  }
}, 15000);
server.listen(PORT, HOST, () => {
  log(`霜烬之争 server on :${PORT}`);
  const ips = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log('\n  用浏览器打开（手机、电脑都行），点「联机对战」：');
  console.log(`    本机        http://localhost:${PORT}/`);
  console.log(`    这台机器    http://${os.hostname().replace(/\.local$/, '')}:${PORT}/`);
  for (const ip of ips) console.log(`    ${ip.startsWith('100.') ? 'Tailscale ' : '局域网    '}  http://${ip}:${PORT}/`);
  console.log('\n  关掉这个窗口，服务器就停了。\n');
});
