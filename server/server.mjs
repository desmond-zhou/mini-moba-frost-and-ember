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
const hub = createHub({ log });

// ---------------- the page ----------------
let page = null, pageAt = 0;
const html = () => { const f = HTML_PATH; try { const m = fs.statSync(f).mtimeMs; if (m !== pageAt) { page = fs.readFileSync(f); pageAt = m; } } catch { page = null; } return page; };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(`ok ${hub.rooms.size} rooms`); return; }
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
  console.log('\n  关掉这个窗口，服务器就停了。\n');
});
