// main.js — boot, match lifecycle, camera, frame loop.
import { createRender, pickQuality, QUALITY } from './render.js';
import { createFx } from './fx.js';
import { createWorld } from './world.js';
import { createModels } from './models.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { createNet, serverUrl, SIM } from './net.js';
import { uTime } from './mat.js';
import { LANES, MID, RIVER, biomeX, MODE, MODES, setMode, POS, CAMPS, EMBER } from './config.js';

const fatal = document.getElementById('fatal');
addEventListener('error', e => { fatal.textContent = '出错了：' + (e.message || e.error); });

function boot() {
  const qs = new URLSearchParams(location.search);
  const isTouch = qs.get('touch') === '1' || (qs.get('touch') !== '0' && (matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900)));
  const R = createRender(document.getElementById('view'), qs.get('q') || pickQuality());
  if (MODES[qs.get('mode')]) setMode(qs.get('mode'));
  let W = createWorld(R); const fx = createFx(R), M = createModels(R, fx), audio = createAudio(isTouch), ui = createUI(isTouch, audio), input = createInput(R, fx, ui, audio, isTouch);
  R.sun = W.sun;
  if (qs.get('dyn') === '0') R.dyn.enabled = false;
  R.onQuality = q => { W.setShadowSize(q.shadow); ui.el.qBtn.textContent = '画质 ' + q.label; };
  ui.el.qBtn.textContent = '画质 ' + R.quality.label;
  ui.el.qBtn.onclick = () => { const order = ['low', 'medium', 'high']; R.setQuality(order[(order.indexOf(R.quality.name) + 1) % 3]); R.dyn.enabled = false; };

  let G = null, state = 'title', time = 0, last = performance.now(), frames = 0;
  const TICK = 1 / 60; let acc = 0;                                  // the match moves in fixed steps; the picture is drawn between them
  const INTRO = 2.8; let intro = 0;                                  // the camera starts wide over your own 阵眼 and comes down to you

  const focus = { x: 0, z: 0 }, cam = R.camera;
  let lastPick = ['mage', 'normal'];
  function start(hero, difficulty, mode = MODE.id, seat = -1, extra = {}) {   // extra: online — seed, lineup, me, net, send
    lastPick = [hero, difficulty, mode, seat]; ui.toggleMenu(false);
    if (MODES[mode] && mode !== MODE.id) { W.dispose(); setMode(mode); W = createWorld(R); R.sun = W.sun; W.setShadowSize(R.quality.shadow); }   // other ground: build that world
    M.reset(); fx.reset();
    G = createGame(R, W, M, fx, audio, ui, { hero, difficulty, seat, ...extra }); acc = 0;
    G.autoPlay = qs.get('bot') === '1'; input.G = G; ui.bind(G, input); state = 'playing'; audio.init(); intro = qs.get('auto') ? 0 : INTRO; { const c = G.structs[G.player.team].core; focus.x = c.x; focus.z = c.z; }
    focus.x = G.focus.x; focus.z = G.focus.z;
  }
  const backToRoom = () => { state = 'title'; if (net) net.end(); G = null; input.G = null; M.reset(); fx.reset(); netInfo.textContent = ''; ui.showTitle(start); if (net && net.room) ui.showRoom(net, roomAct); document.getElementById('title').scrollTop = 0; };
  const toTitle = () => { state = 'title'; G = null; input.G = null; M.reset(); fx.reset(); if (net) { net.end(); if (net.room) net.send({ t: 'leave' }); } ui.showTitle(start); };
  ui.onMenu = { restart: () => start(lastPick[0], lastPick[1], lastPick[2], lastPick[3]), quit: () => toTitle(), bot: () => { if (G && G.net) G.cmdBot(G.player.isPlayer); } };

  // ---------------- online (V3) ----------------
  // A room on the server (server/server.mjs): the title screen becomes the room; when the host starts, every machine gets the same
  // seed and lineup and plays the match turn by turn (net.js). Alone, nothing here runs.
  let net = null, pendingNet = null;
  const chatIn = document.getElementById('chatIn'), netInfo = document.getElementById('netInfo');
  const roomAct = {
    send: m => net.send(m),
    leave: () => { net.send({ t: 'leave' }); },
    invite: () => (/^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) && location.port !== '5179' ? `${location.origin}/?room=${net.room.code}` : `房间号 ${net.room.code}`),
  };
  const remember = code => { try { if (code) localStorage.setItem('frostember.room', code); else localStorage.removeItem('frostember.room'); } catch { /* private */ } };
  function ensureNet() {
    if (!net) {
      net = createNet(); net.url = serverUrl();
      net.on.status = t => { ui.netStatus(t); };
      net.on.open = () => { if (pendingNet) { const f = pendingNet; pendingNet = null; f(); } else if (net.room && net.room.state === 'lobby' && state === 'title') net.send({ t: 'join', code: net.room.code }); };   // a dropped connection in the room: sit back down
      net.on.err = m => { ui.toast(m.msg); ui.netStatus(m.msg); };
      net.on.left = m => { remember(null); if (m && m.msg) ui.toast(m.msg); if (state === 'title') { ui.showTitle(start); openNet(); } };   // out of the room: back in the lobby
      net.on.lobby = m => {
        if (state !== 'title' && G && G.net && net.match) { ui.toast('联机服务器重启了，这一局中断了'); toTitle(); return; }   // back from a drop and the server no longer has the match
        ui.lobby(m, SIM);
      };
      net.on.kicked = m => { ui.toast(m.msg); };
      net.on.lchat = m => ui.lobbyChat(m);
      net.on.room = m => { remember(m.code); if (state === 'title') ui.showRoom(net, roomAct); };
      net.on.chat = m => {
        const h = G && G.net ? G.heroes.find(x => x.pname === m.from) : null;
        if (h && state === 'playing') ui.chat(h, (m.team >= 0 ? '' : '〔全〕') + ui.esc(m.text), h.team !== G.player.team, 7000); else ui.roomChat(m.from, m.text);
      };
      net.on.desync = () => { window.__desync = (window.__desync || 0) + 1; ui.toast('联机对局出现不同步（已记录，请告诉作者）'); };
      net.on.start = m => {
        if (m.me < 0) { ui.toast('这一局没有你的位置'); return; }
        ui.netPane && (document.getElementById('netPane').hidden = true);
        document.getElementById('title').hidden = true;
        start(null, m.diff, m.mode, -1, { seed: m.seed, lineup: m.lineup, me: m.me, net: true, send: q => net.cmd(q) });
        G.autoPlay = false; G.cmdBot = on => net.send({ t: 'cmd', q: { c: 'bot', on } });
        net.begin(m, G); intro = m.log.length > 40 ? 0 : intro;
        if (m.log.length > 40) ui.toast('正在追上这一局…');
        if (qs.get('netbot') === '1') G.cmdBot(true);                // test: let the bot play this seat
      };
      net.on.turn = m => net.turn(m);
    }
  }
  function openNet(code) {
    ensureNet();
    const whenOpen = f => { if (net.open) f(); else { pendingNet = f; net.connect(); } };
    ui.netPane(net, {
      create: mode => whenOpen(() => net.send({ t: 'create', mode })),
      join: c => whenOpen(() => net.send({ t: 'join', code: c })),
      chat: text => whenOpen(() => net.send({ t: 'lchat', text })),
      rename: n => { if (net.open) net.send({ t: 'name', name: n }); },
      close: () => { if (!net.room) net.close(); },
    });
    // every game talks to the one room server (net.js serverUrl); if it does not answer, the lobby says so and who to ask
    if (net.open) return;
    ui.netStatus('连接中…');
    alive(net.url).then(ok => {
      if (!ok) { ui.netOffline(true); return; }
      ui.netStatus(''); net.connect();
      if (code) { document.getElementById('nCode').value = code; if (net.name) whenOpen(() => document.getElementById('nJoin').click()); }
    });
  }
  const alive = url => {                                               // the server answers /healthz with "ok …"
    const h = url.replace(/^ws/, 'http').replace(/\/ws$/, '/healthz'), ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000);
    return fetch(h, { cache: 'no-store', signal: ctl.signal }).then(r => (r.ok ? r.text() : '')).then(t => t.startsWith('ok')).catch(() => false);
  };
  ui.onNet = () => { if (net && net.room) { net.send({ t: 'leave' }); return; } openNet(); };
  addEventListener('keydown', e => {                                   // Enter: say something to your own side
    if (e.key !== 'Enter' || !G || !G.net || state !== 'playing' || document.activeElement === chatIn) return;
    e.preventDefault(); ui.onChat();
  });
  ui.onChat = () => { chatIn.hidden = false; chatIn.value = ''; chatIn.focus(); };
  chatIn.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Enter') { const t = chatIn.value.trim(); if (t && net) net.send({ t: 'chat', text: t, team: !e.shiftKey }); chatIn.blur(); }
    else if (e.key === 'Escape') chatIn.blur();
  };
  chatIn.onblur = () => { chatIn.hidden = true; };
  if (qs.get('room')) setTimeout(() => openNet(qs.get('room').toUpperCase().slice(0, 4)), 300);
  else { let was = null; try { was = localStorage.getItem('frostember.room'); } catch { /* private */ } if (was && serverUrl()) { ensureNet(); net.connect(); } }   // back after a reload or a crash: the server puts you back in your seat
  ui.showTitle(start);
  addEventListener('pointerdown', () => audio.init(), { capture: true });   // the first tap starts the audio (sounds render while the player is still choosing); later taps wake it if the phone suspended it
  if (qs.get('auto')) { ui.el.title.hidden = true; start(qs.get('auto'), qs.get('diff') || 'normal', MODE.id, qs.has('seat') ? +qs.get('seat') : -1); }

  function frame(now) { tick(now); requestAnimationFrame(frame); }
  function tick(now) {
    const raw = now - last; last = now;
    let dt = Math.min(0.05, raw / 1000);
    const online = !!(G && G.net && net && net.match && state !== 'title');
    if (online) { fx.stopT = 0; fx.slowT = 0; }                       // online the world cannot pause for one player's slow-motion
    if (fx.stopT > 0) { fx.stopT -= dt; dt *= 0.06; }
    else if (fx.slowT > 0) { const k = fx.slowT / fx.slowDur; fx.slowT -= dt; dt *= k > 0.35 ? fx.slowK : fx.slowK + (1 - fx.slowK) * (1 - k / 0.35); }   // a killing blow lingers   // hit-stop: big impacts freeze the world for a few frames
    const paused = state === 'playing' && !online && (ui.menuOpen || window.__moba.hold);   // hold: the test tools step the match themselves if (paused) dt = 0;            // the menu stops the world; the picture and the music carry on
    time += dt; uTime.value = time;
    audio.intensity = 0;
    let dusk = 0, hurt = 0, sat = 1.06, shake = fx.shakeAmt, zoom = input.zoom * (cam.aspect < 1.25 ? Math.min(1.55, 1.18 / Math.sqrt(cam.aspect)) : 1);
    if (state === 'title') {
      const L = LANES[MID], q = L.at((L.s0 + L.s1) / 2 + Math.sin(time * 0.045) * (L.s1 - L.s0) * 0.405, 0); focus.x = q.x; focus.z = q.z; zoom = 0.82;
    } else {
      if (online) {
        const r = net.advance(Math.min(0.25, raw / 1000), () => G.step(TICK)); audio.hush = r.behind > 30;
        G.draw(dt, time, r.alpha); input.update(); ui.update(dt); net.tick(dt);
        if ((netInfo.t = (netInfo.t || 0) - dt) <= 0) { netInfo.t = 0.5; const off = G.heroes.filter(h => h.pname && !h.isPlayer).map(h => h.pname); netInfo.textContent = (net.open ? `延迟 ${net.ping} ms` : '连接断了，正在重连…') + (r.behind > 30 ? ' · 追赶中' : '') + (off.length ? ' · 托管：' + off.join('、') : ''); }
      } else if (!paused) {
        acc += dt; let n = 0; while (acc >= TICK && n < 8) { G.step(TICK); acc -= TICK; n++; } if (n === 8) acc = 0;   // a long stall is not made up
        G.draw(dt, time, acc / TICK); input.update(); ui.update(dt);
      }
      if (intro > 0) { intro -= raw / 1000; const q = Math.max(0, intro / INTRO); zoom *= 1 + 0.75 * q * q; }
      if (G.over) zoom *= 1 - 0.2 * Math.min(1, G.overT / 1.6);
      dusk = G.tribK || 0; zoom *= 1 + 0.16 * dusk; sat -= 0.3 * dusk;      // 雷劫 nearby: the camera draws back and the light goes          // closing in on the 阵眼 as it breaks
      const k = 1 - Math.exp(-dt * (G.over ? 2 : intro > 0 ? 1.6 : 9));
      focus.x += ((G.focus.tx ?? focus.x) - focus.x) * k; focus.z += ((G.focus.tz ?? focus.z) - focus.z) * k;
      G.focus.x = focus.x; G.focus.z = focus.z; audio.listener.x = focus.x; audio.listener.z = focus.z;
      const p = G.player; audio.intensity = p.alive && p.combatT < 4.5 && !G.over ? 1 : 0; audio.mood = (G.tribK || 0) > 0.2 ? 'trib' : G.structs.some(s => s.core.alive && s.core.hp < s.core.maxHp * 0.6) || G.t > 900 ? 'end' : 'calm'; hurt = Math.max(G.hurtFlash || 0, p.alive ? Math.max(0, 0.35 - p.hp / p.maxHp) * 1.6 : 0); if (!p.alive && !G.over) sat = 0.2;
      if (G.over && G.overT > 3 && state !== 'end') { state = 'end'; audio.play(G.winner === p.team ? 'level' : 'death'); ui.showEnd(toTitle, online ? backToRoom : null); }
    }
    { const pl = (q, r) => Math.max(0, 1 - Math.hypot(focus.x - q.x, focus.z - q.z) / r), pit = CAMPS.find(c => c.kind === 'guardian');   // where the camera is: the blood array and the blood pit, the woods away from the lanes
      const blood = Math.max(pl(POS.core(EMBER), 30), pit ? pl(pit, 16) : 0), lane = Math.min(...LANES.map(L => L.dist(focus.x, focus.z)));
      audio.ambient(biomeX(focus.x, focus.z), focus.z, RIVER.signed(focus.x, focus.z), state === 'playing' && G.player.alive && G.player.hp / G.player.maxHp < 0.3, dt, { blood, forest: Math.max(0, Math.min(1, (lane - 7) / 10)) }); }
    fx.update(dt); W.update(focus); W.focusLight(focus.x, focus.z);
    const sx = (Math.random() - 0.5) * shake * 1.4, sy = (Math.random() - 0.5) * shake * 1.4;
    zoom *= 1 - 0.1 * Math.sin(Math.PI * fx.zoomK);                      // leaning in for an ultimate
    cam.position.set(focus.x + sx, 38 * zoom + sy, focus.z + 25 * zoom + 1.5);
    cam.lookAt(focus.x + sx, 0, focus.z - 1.5);
    const g = R.grade; g.uPunch.value = fx.punchAmt; g.uHurt.value += (hurt - g.uHurt.value) * Math.min(1, dt * 10); g.uSat.value += (sat - g.uSat.value) * Math.min(1, dt * 4); g.uDusk.value += (dusk - g.uDusk.value) * Math.min(1, dt * 3);
    R.render(time);
    if (state !== 'title') R.adapt(raw);
    if (++frames === 2) document.getElementById('boot').classList.add('done');
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { audio.pause(document.hidden); last = performance.now(); });
  // online, a player who switches away for more than a few seconds hands their cultivator to the bot, and takes it back on return
  let awayT = 0, awayBot = false;
  document.addEventListener('visibilitychange', () => {
    if (!G || !G.net || !net || !net.match) return;
    if (document.hidden) { clearTimeout(awayT); awayT = setTimeout(() => { if (document.hidden && G && G.net && G.player.isPlayer) { G.cmdBot(true); awayBot = true; } }, 8000); }
    else { clearTimeout(awayT); if (awayBot) { awayBot = false; G.cmdBot(false); ui.toast('你切走的时候电脑替你打了一会儿，现在交还给你'); } }
  });

  // debug / automated-test handle
  window.__moba = { hold: false, get G() { return G; }, R, fx, start, input, audio, frame: dt => tick(last + dt * 1000), sim(sec, step = TICK) { for (let t = 0; t < sec && G && !G.over; t += step) { time += step; G.step(step); fx.update(step); } if (G) G.draw(0, time); return G ? { t: G.t, units: G.units.length, kills: G.kills, over: G.over } : null; } };
}
try { boot(); } catch (e) { fatal.textContent = '启动失败：' + (e && e.stack || e); throw e; }
