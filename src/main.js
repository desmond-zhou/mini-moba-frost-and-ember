// main.js — boot, match lifecycle, camera, frame loop.
import { createRender, pickQuality, QUALITY } from './render.js';
import { createFx } from './fx.js';
import { createWorld } from './world.js';
import { createModels } from './models.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
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
  const INTRO = 2.8; let intro = 0;                                  // the camera starts wide over your own 阵眼 and comes down to you

  const focus = { x: 0, z: 0 }, cam = R.camera;
  let lastPick = ['mage', 'normal'];
  function start(hero, difficulty, mode = MODE.id, seat = -1) {
    lastPick = [hero, difficulty, mode, seat]; ui.toggleMenu(false);
    if (MODES[mode] && mode !== MODE.id) { W.dispose(); setMode(mode); W = createWorld(R); R.sun = W.sun; W.setShadowSize(R.quality.shadow); }   // other ground: build that world
    M.reset(); fx.reset();
    G = createGame(R, W, M, fx, audio, ui, { hero, difficulty, seat });
    G.autoPlay = qs.get('bot') === '1'; input.G = G; ui.bind(G, input); state = 'playing'; audio.init(); intro = qs.get('auto') ? 0 : INTRO; { const c = G.structs[G.player.team].core; focus.x = c.x; focus.z = c.z; }
    focus.x = G.focus.x; focus.z = G.focus.z;
  }
  const toTitle = () => { state = 'title'; G = null; input.G = null; M.reset(); fx.reset(); ui.showTitle(start); };
  ui.onMenu = { restart: () => start(lastPick[0], lastPick[1], lastPick[2], lastPick[3]), quit: () => toTitle() };
  ui.showTitle(start);
  if (qs.get('auto')) { ui.el.title.hidden = true; start(qs.get('auto'), qs.get('diff') || 'normal', MODE.id, qs.has('seat') ? +qs.get('seat') : -1); }

  function frame(now) {
    const raw = now - last; last = now;
    let dt = Math.min(0.05, raw / 1000);
    if (fx.stopT > 0) { fx.stopT -= dt; dt *= 0.06; }
    else if (fx.slowT > 0) { const k = fx.slowT / fx.slowDur; fx.slowT -= dt; dt *= k > 0.35 ? fx.slowK : fx.slowK + (1 - fx.slowK) * (1 - k / 0.35); }   // a killing blow lingers   // hit-stop: big impacts freeze the world for a few frames
    const paused = state === 'playing' && ui.menuOpen; if (paused) dt = 0;            // the menu stops the world; the picture and the music carry on
    time += dt; uTime.value = time;
    audio.intensity = 0;
    let dusk = 0, hurt = 0, sat = 1.06, shake = fx.shakeAmt, zoom = input.zoom * (cam.aspect < 1.25 ? Math.min(1.55, 1.18 / Math.sqrt(cam.aspect)) : 1);
    if (state === 'title') {
      const L = LANES[MID], q = L.at((L.s0 + L.s1) / 2 + Math.sin(time * 0.045) * (L.s1 - L.s0) * 0.405, 0); focus.x = q.x; focus.z = q.z; zoom = 0.82;
    } else {
      if (!paused) { G.update(dt, time); input.update(); ui.update(dt); }
      if (intro > 0) { intro -= raw / 1000; const q = Math.max(0, intro / INTRO); zoom *= 1 + 0.75 * q * q; }
      if (G.over) zoom *= 1 - 0.2 * Math.min(1, G.overT / 1.6);
      dusk = G.tribK || 0; zoom *= 1 + 0.16 * dusk; sat -= 0.3 * dusk;      // 雷劫 nearby: the camera draws back and the light goes          // closing in on the 阵眼 as it breaks
      const k = 1 - Math.exp(-dt * (G.over ? 2 : intro > 0 ? 1.6 : 9));
      focus.x += ((G.focus.tx ?? focus.x) - focus.x) * k; focus.z += ((G.focus.tz ?? focus.z) - focus.z) * k;
      G.focus.x = focus.x; G.focus.z = focus.z; audio.listener.x = focus.x; audio.listener.z = focus.z;
      const p = G.player; audio.intensity = p.alive && p.combatT < 4.5 && !G.over ? 1 : 0; audio.mood = (G.tribK || 0) > 0.2 ? 'trib' : G.structs.some(s => s.core.alive && s.core.hp < s.core.maxHp * 0.6) || G.t > 900 ? 'end' : 'calm'; hurt = Math.max(G.hurtFlash || 0, p.alive ? Math.max(0, 0.35 - p.hp / p.maxHp) * 1.6 : 0); if (!p.alive && !G.over) sat = 0.2;
      if (G.over && G.overT > 3 && state !== 'end') { state = 'end'; audio.play(G.winner === p.team ? 'level' : 'death'); ui.showEnd(toTitle); }
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
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { audio.pause(document.hidden); last = performance.now(); });

  // debug / automated-test handle
  window.__moba = { get G() { return G; }, R, fx, start, input, audio, sim(sec, step = 1 / 30) { for (let t = 0; t < sec && G && !G.over; t += step) { time += step; G.update(step, time); fx.update(step); } return G ? { t: G.t, units: G.units.length, kills: G.kills, over: G.over } : null; } };
}
try { boot(); } catch (e) { fatal.textContent = '启动失败：' + (e && e.stack || e); throw e; }
