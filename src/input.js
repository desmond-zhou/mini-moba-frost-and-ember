// input.js — mouse + keyboard and touch.
// Aimed abilities are hold-to-aim: hold the key (or drag from the button on touch) to see where it will go, release to cast,
// right-click / Esc to cancel. Abilities that act on yourself fire at once. A quick tap on a touch button auto-aims.
import * as THREE from 'three';
import { clamp } from './util.js';
import { MAP } from './config.js';

const SELF = s => s.kind === 'shield' || s.kind === 'haste' || s.kind === 'nova' || s.kind === 'taunt' || ((s.kind === 'heal' || s.kind === 'zone') && !s.range);
const POINT = s => s.kind === 'zone' || s.kind === 'leap' || s.kind === 'heal' || s.kind === 'blink' || s.kind === 'strike' || s.kind === 'dash';

export function createInput(R, fx, ui, audio, isTouch) {
  const { camera } = R, canvas = R.renderer.domElement;
  const I = { G: null, zoom: 1, mouse: { x: innerWidth / 2, y: innerHeight / 2 }, stick: { x: 0, z: 0, on: false } };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function ground(cx, cy, planeY = 0) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, t = (planeY - o.y) / d.y;
    return { x: o.x + d.x * t, z: o.z + d.z * t };
  }
  const live = () => I.G && !I.G.over && I.G.player.alive;
  let lastMove = 0, steer = false;        // steer: the button is held from an ordinary move click, so dragging keeps re-issuing the move
  function act(cx, cy, quiet) {
    const G = I.G; if (!live()) return;
    const body = ground(cx, cy, 1.6), t = G.pick(body.x, body.z, 1.6) || (() => { const g0 = ground(cx, cy); return G.pick(g0.x, g0.z, 1.0); })();
    if (t) { G.cmdAttack(t); if (!quiet) fx.decal({ mode: 1, x: t.x, z: t.z, size: t.r * 2 + 3, size0: t.r * 2 + 5, color: [1.6, 0.25, 0.15], dur: 0.3 }); }
    else { const p = ground(cx, cy); G.cmdMove(p.x, p.z); if (!quiet) fx.decal({ mode: 1, x: p.x, z: p.z, size: 0.6, size0: 3.2, color: [0.3, 1.3, 0.55], dur: 0.32 }); }
  }

  // ---- aiming ----
  const aim = { i: -1, x: 0, z: 0, touch: false, dx: 0, dy: 0, key: '' };
  let amove = false;                       // A was pressed: the next left click is an attack-move
  const cancelAim = () => { aim.i = -1; amove = false; canvas.style.cursor = ''; fx.aimHide(); };
  function beginAim(i, touch) {
    const G = I.G; if (!live()) return false;
    const s = G.player.def.skills[i];
    if (!G.canCast(i)) { G.castAt(i, G.player.x, G.player.z); return false; }           // lets the game say why not
    if (SELF(s)) { G.castAt(i, G.player.x, G.player.z); return false; }
    aim.i = i; aim.touch = touch; aim.dx = aim.dy = 0; return true;
  }
  function aimPoint() {
    const p = I.G.player, s = p.def.skills[aim.i];
    if (!aim.touch) return ground(I.mouse.x, I.mouse.y);
    const len = Math.hypot(aim.dx, aim.dy);
    if (len < 12) { const t = s.kind === 'heal' ? null : I.G.nearestEnemy((s.range || 8) + (s.radius || 0) * 0.5); if (t) return { x: t.x, z: t.z }; return { x: p.x + Math.cos(p.facing) * (s.range || 6) * 0.8, z: p.z + Math.sin(p.facing) * (s.range || 6) * 0.8 }; }
    const k = POINT(s) ? Math.min(1, len / 78) * (s.range || 8) : (s.range || 8);
    return { x: p.x + aim.dx / len * k, z: p.z + aim.dy / len * k };
  }
  function releaseAim(castIt) {
    if (aim.i < 0) return; const i = aim.i, pt = live() && castIt ? aimPoint() : null; cancelAim();
    if (pt) I.G.castAt(i, pt.x, pt.z);
  }
  I.update = () => {
    if (amove && aim.i < 0) { if (!live()) { cancelAim(); return; } const p = I.G.player; fx.aimShow({ x: p.x, z: p.z, range: p.range + p.r, hostile: true }); return; }
    if (aim.i < 0) return; const G = I.G;
    if (!live() || !G.canCast(aim.i)) { cancelAim(); return; }
    const p = G.player, s = p.def.skills[aim.i], pt = aimPoint();
    let dx = pt.x - p.x, dz = pt.z - p.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const o = { x: p.x, z: p.z, facing: Math.atan2(dz, dx) }, cd = Math.min(d, s.range || 0);
    switch (s.kind) {
      case 'proj': o.shape = 'arrow'; o.len = s.range; o.width = Math.max(1.4, s.width * 2.3); break;
      case 'backdash': o.shape = 'arrow'; o.len = s.projRange; o.width = 1.6; break;
      case 'dash': o.shape = 'arrow'; o.len = clamp(d, 4, s.range); o.width = 2.6; o.range = s.range; break;
      case 'fan': o.shape = 'sector'; o.range = s.range; o.arc = s.spread * (s.n - 1) / 2 + 0.12; break;
      case 'cone': o.shape = 'sector'; o.range = s.range; o.arc = s.angle * Math.PI / 360; break;
      case 'blink': o.range = s.range; o.tx = p.x + dx * cd; o.tz = p.z + dz * cd; o.radius = 1.4; break;
      case 'strike': { o.range = s.range; const v = G.strikeTarget(aim.i, pt.x, pt.z); if (v) { o.tx = v.x; o.tz = v.z; o.radius = v.r + 1.4; o.hostile = true; } break; }
      default: o.range = s.range; o.tx = p.x + dx * cd; o.tz = p.z + dz * cd; o.radius = s.radius; o.heal = s.kind === 'heal';
    }
    fx.aimShow(o);
  };

  // ---- mouse / keyboard ----
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    audio.init();
    if (e.pointerType === 'touch') return touchDown(e);
    if (ui.shopOpen) { ui.toggleShop(false); return; }
    if (aim.i >= 0) { if (e.button === 2) cancelAim(); else if (e.button === 0) releaseAim(true); return; }
    if (amove) {
      if (e.button === 0 && live()) { const body = ground(e.clientX, e.clientY, 1.6), t = I.G.pick(body.x, body.z, 1.6), p = ground(e.clientX, e.clientY); if (t) I.G.cmdAttack(t); else I.G.cmdAttackMove(p.x, p.z); fx.decal({ mode: 1, x: t ? t.x : p.x, z: t ? t.z : p.z, size: 0.8, size0: 3.6, color: [1.7, 0.3, 0.15], dur: 0.34 }); }
      cancelAim(); steer = false; return;                             // an attack-move click must not turn into a drag-move
    }
    if (e.button === 0 || e.button === 2) { act(e.clientX, e.clientY); lastMove = performance.now(); steer = true; canvas.setPointerCapture(e.pointerId); }
  });
  addEventListener('pointermove', e => { if (e.pointerType !== 'touch') { I.mouse.x = e.clientX; I.mouse.y = e.clientY; } });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return touchMove(e);
    if (steer && aim.i < 0 && !amove && (e.buttons & 3) && performance.now() - lastMove > 90) { lastMove = performance.now(); act(e.clientX, e.clientY, true); }
  });
  const up = e => { if (e.pointerType === 'touch') touchUp(e); else steer = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); I.zoom = clamp(I.zoom + Math.sign(e.deltaY) * 0.08, 0.7, 1.3); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); if (I.G && !ui.menuOpen) ui.showScore(true); return; }
    if (e.repeat || !I.G || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase(), i = k.length === 1 ? 'qwer'.indexOf(k) : -1;
    if (ui.menuOpen && k !== 'escape' && k !== 'm') return;
    if (i >= 0) { if (aim.i >= 0 && aim.i !== i) cancelAim(); if (beginAim(i, false)) aim.key = k; }
    else if (k >= '1' && k <= '4' && k.length === 1) I.G.learn(+k - 1);
    else if (k === '5' || k === '6') I.G.chooseInsight(+k - 5);
    else if (k === 'a') { cancelAim(); if (live()) { amove = true; canvas.style.cursor = 'crosshair'; } }
    else if (k === 's') { cancelAim(); I.G.cmdStop(); }
    else if (k === 'z' || k === 'x' || k === 'c') I.signal(k === 'z' ? 'gather' : k === 'x' ? 'attack' : 'retreat', true);
    else if (k === 'v') I.G.setRally();
    else if (k === 'b') { cancelAim(); I.G.recall(); }
    else if (k === 'p') ui.toggleShop();
    else if (k === 'escape') { if (aim.i >= 0 || amove) cancelAim(); else if (ui.shopOpen) ui.toggleShop(false); else ui.toggleMenu(); }
    else if (k === 'm') ui.el.muteBtn.click();
    else return;
    e.preventDefault();
  });
  addEventListener('keyup', e => { if (e.key === 'Tab') ui.showScore(false); if (aim.i >= 0 && !aim.touch && e.key.toLowerCase() === aim.key) releaseAim(true); });
  addEventListener('blur', () => { cancelAim(); ui.showScore(false); if (I.G) I.G.peek = null; });

  // ---- signals. From the keys they go where the mouse points (and at what it points at, for 进攻); from the buttons they are
  //      about you: come to me, hit what I am hitting, fall back from here. ----
  I.signal = (type, atCursor) => {
    const G = I.G; if (!G || G.over) return; const p = G.player;
    if (atCursor) { const g0 = ground(I.mouse.x, I.mouse.y), body = ground(I.mouse.x, I.mouse.y, 1.6), u = type === 'attack' ? G.pick(body.x, body.z, 2.2) || G.pick(g0.x, g0.z, 2.2) : null; G.signal(type, u ? u.x : g0.x, u ? u.z : g0.z, u); return; }
    if (type === 'attack') { const u = (p.order && p.order.type === 'attack' && p.order.target && p.order.target.alive ? p.order.target : null) || G.nearestEnemy(18); if (u) G.signal(type, u.x, u.z, u); else G.signal(type, p.x + Math.cos(p.facing) * 10, p.z + Math.sin(p.facing) * 10); }
    else G.signal(type, p.x, p.z);
  };
  // ---- minimap: hold to look, right-click to walk there, Alt/Ctrl-click (or a quick tap on touch) to ping ----
  const mini = ui.el.mini; let mpid = -1, mT = 0, mX = 0, mY = 0;
  const miniPt = e => { const r = mini.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1) * MAP.hx, z: clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1) * MAP.hz }; };
  mini.addEventListener('contextmenu', e => e.preventDefault());
  mini.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); audio.init(); const G = I.G; if (!G || G.over) return; const p = miniPt(e);
    if (e.button === 2) { if (live()) G.cmdMove(p.x, p.z); return; }
    if (e.altKey || e.ctrlKey || e.metaKey) { G.ping(p.x, p.z); return; }
    mpid = e.pointerId; mT = performance.now(); mX = e.clientX; mY = e.clientY; G.peek = p; try { mini.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  mini.addEventListener('pointermove', e => { if (e.pointerId === mpid && I.G) I.G.peek = miniPt(e); });
  const miniUp = e => {
    if (e.pointerId !== mpid) return; mpid = -1; const G = I.G; if (!G) return; G.peek = null;
    if (e.pointerType === 'touch' && performance.now() - mT < 280 && Math.hypot(e.clientX - mX, e.clientY - mY) < 10) { const p = miniPt(e); G.ping(p.x, p.z); }
  };
  mini.addEventListener('pointerup', miniUp); mini.addEventListener('pointercancel', miniUp);

  // ---- touch: a stick that appears where the left thumb lands; a tap elsewhere moves / attacks ----
  const stickEl = document.getElementById('stick'), knob = stickEl.firstElementChild, home = { left: stickEl.style.left, top: stickEl.style.top };
  let sid = -1, sx0 = 0, sy0 = 0, tapId = -1, tapX = 0, tapY = 0;
  function touchDown(e) {
    if (ui.shopOpen) { ui.toggleShop(false); return; }
    if (sid < 0 && e.clientX < innerWidth * 0.5 && e.clientY > innerHeight * 0.3) {
      sid = e.pointerId; sx0 = e.clientX; sy0 = e.clientY; stickEl.style.left = sx0 + 'px'; stickEl.style.top = sy0 + 'px'; canvas.setPointerCapture(e.pointerId);
    } else { tapId = e.pointerId; tapX = e.clientX; tapY = e.clientY; }
  }
  function touchMove(e) {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - sx0, dy = e.clientY - sy0; const d = Math.hypot(dx, dy), m = 46;
    if (d > m) { dx *= m / d; dy *= m / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    if (d > 10) { I.stick.on = true; I.stick.x = dx / Math.hypot(dx, dy); I.stick.z = dy / Math.hypot(dx, dy); if (live()) I.G.cmdDir(I.stick.x, I.stick.z); }
    else if (I.stick.on) { I.stick.on = false; if (I.G) I.G.cmdDir(0, 0); }
  }
  function touchUp(e) {
    if (e.pointerId === sid) { sid = -1; I.stick.on = false; knob.style.transform = ''; stickEl.style.left = home.left; stickEl.style.top = home.top; if (I.G) I.G.cmdDir(0, 0); }
    else if (e.pointerId === tapId) { tapId = -1; if (Math.hypot(e.clientX - tapX, e.clientY - tapY) < 14) act(e.clientX, e.clientY); }
  }
  const atk = document.getElementById('atkBtn');
  atk.addEventListener('pointerdown', e => { e.preventDefault(); audio.init(); if (!live()) return; const G = I.G, t = G.nearestEnemy(G.player.range + 7); if (t) { G.cmdAttack(t); fx.decal({ mode: 1, x: t.x, z: t.z, size: t.r * 2 + 3, size0: t.r * 2 + 5, color: [1.6, 0.25, 0.15], dur: 0.3 }); } });

  // ---- skill buttons: press, drag to aim, release to cast; a tap (no drag) aims for you ----
  let bx0 = 0, by0 = 0, bid = -1;
  I.skillDown = (i, e) => { audio.init(); if (aim.i >= 0) cancelAim(); if (!beginAim(i, true)) return; bid = e.pointerId; bx0 = e.clientX; by0 = e.clientY; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
  I.skillMove = (i, e) => { if (aim.i === i && e.pointerId === bid) { aim.dx = e.clientX - bx0; aim.dy = e.clientY - by0; } };
  I.skillUp = (i, e, cancelled) => { if (aim.i === i && e.pointerId === bid) { bid = -1; releaseAim(!cancelled); } };
  return I;
}
