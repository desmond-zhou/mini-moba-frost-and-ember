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
import http from 'node:http'; import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createHub } from './hub.mjs';

// the page it hands out: FROSTEMBER_HTML when set (the server app carries its own copy), else this checkout's build
const HTML_PATH = process.env.FROSTEMBER_HTML || path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'dist/frostember.html');
const PORT = +process.env.PORT || 8790, HOST = process.env.HOST || undefined;
// behind a proxy that sets X-Forwarded-For (e.g. Caddy): TRUST_PROXY=1, so the per-address limits see the real address
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const ipOf = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
const log = (...a) => console.log(new Date().toISOString().slice(5, 19), ...a);
// play metrics: one JSON line per player hello, room opened, match started and match ended (METRICS_FILE), read back by /stats.
// /stats only answers requests that did not come through the public proxy (no X-Forwarded-For): on the server itself or over
// Tailscale, never from the internet.
const METRICS = process.env.METRICS_FILE || '';
const event = e => { if (METRICS) fs.appendFile(METRICS, JSON.stringify({ at: Date.now(), ...e }) + '\n', () => {}); };
const hub = createHub({ log, event });
function stats() {
  let lines = []; try { lines = fs.readFileSync(METRICS, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { /* none yet */ }
  const day = t => new Date(t).toISOString().slice(0, 10), days = {}, heroes = {}, players = new Map(), wins = [0, 0];
  const D = k => days[k] || (days[k] = { day: k, players: new Set(), rooms: 0, matches: 0, finished: 0, minutes: 0, single: 0, tri: 0, desync: 0 });
  for (const e of lines) {
    const d = D(day(e.at));
    if (e.e === 'hello') { d.players.add(e.cid); const p = players.get(e.cid) || { name: e.name, first: e.at, last: e.at, matches: 0 }; p.name = e.name; p.last = e.at; players.set(e.cid, p); }
    else if (e.e === 'room') d.rooms++;
    else if (e.e === 'start') { d.matches++; d[e.mode] = (d[e.mode] || 0) + 1; for (const q of e.players) if (q.cid) { heroes[q.hero] = (heroes[q.hero] || 0) + 1; const p = players.get(q.cid); if (p) p.matches++; } }
    else if (e.e === 'end') { if (e.why === 'over') { d.finished++; if (e.winner >= 0) wins[e.winner]++; } d.minutes += e.secs / 60; if (e.desync) d.desync++; }
  }
  const list = Object.values(days).sort((a, b) => (a.day < b.day ? 1 : -1)).map(d => ({ ...d, players: d.players.size, minutes: Math.round(d.minutes) }));
  return { now: { online: hub.online, rooms: hub.rooms.size, playing: [...hub.rooms.values()].filter(r => r.state === 'playing').length },
    totals: { players: players.size, matches: list.reduce((s, d) => s + d.matches, 0), finished: list.reduce((s, d) => s + d.finished, 0), hours: Math.round(list.reduce((s, d) => s + d.minutes, 0) / 6) / 10, desync: list.reduce((s, d) => s + d.desync, 0), frostWins: wins[0], emberWins: wins[1] },
    days: list.slice(0, 30), heroes: Object.entries(heroes).sort((a, b) => b[1] - a[1]),
    players: [...players.values()].sort((a, b) => b.last - a.last).slice(0, 50).map(p => ({ ...p, first: new Date(p.first).toISOString().slice(0, 16), last: new Date(p.last).toISOString().slice(0, 16) })) };
}
const statsPage = st => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>霜烬之争 · 对局统计</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;background:#0c111b;color:#ece6d8}table{border-collapse:collapse;margin:8px 0 20px}td,th{padding:4px 10px;border-bottom:1px solid #333;text-align:left}th{color:#dfbd78}h1,h2{color:#dfbd78;font-weight:600}</style>
<h1>霜烬之争 · 对局统计</h1><p>现在：${st.now.online} 人在线，${st.now.rooms} 个房间，${st.now.playing} 局在打 · 累计 ${st.totals.players} 位玩家，${st.totals.matches} 局（打完 ${st.totals.finished}），共 ${st.totals.hours} 小时 · 霜方胜 ${st.totals.frostWins}，烬方胜 ${st.totals.emberWins} · 不同步 ${st.totals.desync}</p>
<h2>按天</h2><table><tr><th>日期</th><th>玩家</th><th>开房</th><th>对局</th><th>打完</th><th>一路</th><th>三路</th><th>分钟</th><th>不同步</th></tr>${st.days.map(d => `<tr><td>${d.day}</td><td>${d.players}</td><td>${d.rooms}</td><td>${d.matches}</td><td>${d.finished}</td><td>${d.single || 0}</td><td>${d.tri || 0}</td><td>${d.minutes}</td><td>${d.desync}</td></tr>`).join('')}</table>
<h2>真人选的修士</h2><table>${st.heroes.map(([h, n]) => `<tr><td>${h}</td><td>${n}</td></tr>`).join('')}</table>
<h2>玩家</h2><table><tr><th>名字</th><th>对局</th><th>第一次</th><th>最近</th></tr>${st.players.map(p => `<tr><td>${String(p.name).replace(/[<&]/g, '')}</td><td>${p.matches}</td><td>${p.first}</td><td>${p.last}</td></tr>`).join('')}</table>`;

// ---------------- the page ----------------
let page = null, pageAt = 0;
const html = () => { const f = HTML_PATH; try { const m = fs.statSync(f).mtimeMs; if (m !== pageAt) { page = fs.readFileSync(f); pageAt = m; } } catch { page = null; } return page; };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/stats' || u.pathname === '/stats.json') {
    if (req.headers['x-forwarded-for']) { res.writeHead(404); res.end(); return; }   // only on the server itself or over Tailscale
    const st = stats(); if (u.pathname === '/stats.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(st)); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(statsPage(st)); return;
  }
  if (u.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }); res.end(`ok ${hub.rooms.size} rooms`); return; }
  if (u.pathname === '/' || u.pathname === '/index.html') {
    const b = html(); if (!b) { res.writeHead(503); res.end('build first: node build.mjs'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); res.end(b); return;
  }
  res.writeHead(404); res.end();
});

// ---------------- sockets ----------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws, req) => {
  if (!hub.open(ws, ipOf(req))) { ws.close(1013, 'too many'); return; }
  ws.alive = true; ws.on('pong', () => { ws.alive = true; });
  ws.on('message', d => hub.message(ws, String(d)));
  ws.on('close', () => hub.close(ws));
});
setInterval(() => {                                                      // dead sockets, empty rooms
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
  hub.sweep();
}, 15000);
server.listen(PORT, HOST, () => {
  log(`霜烬之争 server on :${PORT}`);
  const ips = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log('\n  用浏览器打开（手机、电脑都行），点「联机对战」：');
  console.log(`    本机        http://localhost:${PORT}/`);
  console.log(`    这台机器    http://${os.hostname().replace(/\.local$/, '')}:${PORT}/`);
  for (const ip of ips) console.log(`    ${ip.startsWith('100.') ? 'Tailscale ' : '局域网    '}  http://${ip}:${PORT}/`);
  if (process.stdout.isTTY) console.log('\n  关掉这个窗口，服务器就停了。\n');
});
