// net.js — the connection to the room server (server/server.mjs), and the clock of an online match.
//
// The server sends a "turn" every 50 ms: everyone's commands since the last one. This machine applies a turn's commands, then
// takes three fixed steps of the match. Turns are played at the pace they arrive, with about two of them kept in hand so a
// late packet does not stall the picture; if they pile up (a hiccup, or rejoining a match under way) they are played faster
// until the backlog is gone.
const store = { get(k, d) { try { return localStorage.getItem('frostember.' + k) || d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('frostember.' + k, v); } catch { /* private mode */ } } };

export const SIM = typeof __SIM__ !== 'undefined' ? __SIM__ : 'dev';   // the game-rules fingerprint (build.mjs); rooms only take pages that share it
export const SERVER = 'wss://server.moba.app.desmondzhou.com:37190/ws';   // the one room server everyone plays through (Lightsail, Oregon)
export function serverUrl() {
  const q = new URLSearchParams(location.search).get('server');      // for testing: ?server=ws://host:port/ws
  if (q) return q.startsWith('ws') ? q : 'ws://' + q + '/ws';
  if (location.port === '5179') return `ws://${location.hostname}:8790/ws`;   // developing: the server on this machine
  return SERVER;
}

export function createNet() {
  const N = { on: {}, ws: null, url: '', cid: store.get('cid', ''), name: store.get('name', ''), room: null, ping: 0, open: false, want: false };
  const emit = (k, v) => { const f = N.on[k]; if (f) f(v); };
  let tries = 0, pingT = 0;
  N.send = m => { if (N.ws && N.ws.readyState === 1) { N.ws.send(JSON.stringify(m)); return true; } return false; };
  N.connect = url => {
    N.want = true; if (url) N.url = url; if (!N.url) { emit('status', '没有服务器地址'); return; }
    if (N.ws && N.ws.readyState <= 1) return;
    emit('status', tries ? '重新连接中…' : '连接中…');
    let ws; try { ws = new WebSocket(N.url); } catch (e) { emit('status', '地址不对：' + N.url); return; }
    N.ws = ws;
    ws.onopen = () => { tries = 0; N.open = true; N.send({ t: 'hello', cid: N.cid, name: N.name, v: SIM }); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') { N.cid = m.cid; store.set('cid', m.cid); emit('status', ''); emit('open'); return; }
      if (m.t === 'pong') { N.ping = Math.round(performance.now() - m.c); return; }
      if (m.t === 'room') N.room = m; if (m.t === 'left') N.room = null;
      if (m.t === 'kicked') N.want = false;                          // opened in another page: this one stops reconnecting
      emit(m.t, m);
    };
    ws.onclose = () => {
      N.open = false; if (N.ws !== ws) return; N.ws = null; emit('close');
      if (!N.want) return; tries++; emit('status', '连接断了，正在重连…');
      setTimeout(() => { if (N.want) N.connect(); }, Math.min(8000, 400 * 2 ** Math.min(tries, 5)));
    };
    ws.onerror = () => { if (tries === 0) emit('status', '连不上服务器：' + N.url); };
  };
  N.close = () => { N.want = false; N.room = null; if (N.ws) { const w = N.ws; N.ws = null; w.close(); } };
  // commands: a steady stream (the stick, held right-click) is sent at most every 40 ms, latest value only; anything else goes
  // at once, after whatever of the stream is waiting, so the order a player gave things in is kept
  let held = null, heldT = 0;
  const flush = () => { if (heldT) { clearTimeout(heldT); heldT = 0; } if (held) { N.send({ t: 'cmd', q: held }); held = null; } };
  N.cmd = q => {
    if (q.c === 'dir' || q.c === 'move' || q.c === 'amove') { if (held && held.c !== q.c) flush(); held = q; if (!heldT) heldT = setTimeout(flush, 40); return; }
    flush(); N.send({ t: 'cmd', q });
  };
  N.setName = n => { N.name = n; store.set('name', n); };
  N.tick = dt => { if ((pingT -= dt) <= 0 && N.open) { pingT = 2; N.send({ t: 'ping', c: performance.now() }); } };

  // ---- an online match ----
  // queue: turns not yet played; cur: the turn being played and how many of its steps are left
  N.match = null;
  N.begin = (m, G) => { N.match = { G, tpt: m.tpt, every: m.hashEvery, queue: m.log.map((c, i) => ({ n: i + 1, c })), cur: null, left: 0, n: 0, acc: 0, over: false }; };
  N.turn = m => { if (N.match) N.match.queue.push({ n: m.n, c: m.c }); };
  N.end = () => { N.match = null; };
  // play the match forward by real time dt. Returns how far into the next step the picture is (0–1), and whether it is catching up.
  N.advance = (dt, step) => {
    const M = N.match; if (!M) return { alpha: 1, behind: 0 };
    const stock = M.queue.length * M.tpt + M.left, TICK = 1 / 60;
    M.acc += dt; let want = Math.floor(M.acc / TICK);
    const spare = stock - want;
    if (spare > M.tpt * 4) want += Math.min(3000, Math.ceil((spare - M.tpt * 2) / (spare > 600 ? 1 : 6)));   // behind: catch up (all at once when far behind)
    let done = 0;
    while (done < want) {
      if (!M.left) {
        const t = M.queue.shift(); if (!t) break;
        for (const [li, q] of t.c) M.G.exec(M.G.byLi[li], q);
        M.left = M.tpt; M.n = t.n;
      }
      step(); M.left--; done++;
      if (!M.left && M.n % M.every === 0) N.send({ t: 'hash', k: M.n, h: M.G.hash() });
      if (M.G.over && !M.over) { M.over = true; N.send({ t: 'over', w: M.G.winner }); }
    }
    M.acc -= done * TICK; if (M.acc > TICK || M.acc < 0) M.acc = Math.min(Math.max(M.acc, 0), TICK);   // starved: wait, do not bank time
    return { alpha: Math.min(1, M.acc / TICK), behind: M.queue.length * M.tpt + M.left };
  };
  return N;
}
