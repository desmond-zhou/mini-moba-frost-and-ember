// heroes.js — the nine cultivators. Each is a jointed figure (shoulders, elbows, hips, knees, neck, waist) dressed from
// coloured primitives, with a cloth cape that billows in the vertex shader. Poses are procedural: walk cycle with bending
// knees, and attack / cast motions that depend on the weapon style. Everything faces +Z; the right hand is at −X.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEAM_COL } from './config.js';
import { vcMat, part, build, G, K, kind } from './mat.js';

const PI = Math.PI, SKIN = '#c09a7c', WOOD = '#4d3524', LEATHER = '#33251a', BRASS = '#9c7a35', INK = '#14151b', STEEL = '#8b929c', HAIR = '#17130f';
const lathe = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
const newParts = () => ({ hips: [], chest: [], head: [], uaL: [], faL: [], uaR: [], faR: [], thL: [], shL: [], thR: [], shR: [], cape: [], orbit: [] });
const HAND = -0.57;

// ---- anatomy shared by everyone ----
function body(P, o) {
  const g = o.girth || 1, skin = o.skin || SKIN;
  kind(o.topK ?? K.cloth);
  part(P.chest, lathe([[0.01, 0], [0.25 * g, 0], [0.27 * g, 0.2], [0.34 * g, 0.5], [0.37 * g, 0.72], [0.27 * g, 0.86], [0.1, 0.95]]), o.top, 0, 0, 0, 0, 0, 0, 1, 1, 0.68);
  part(P.hips, lathe([[0.01, -0.24], [0.27 * g, -0.22], [0.31 * g, -0.05], [0.28 * g, 0.14], [0.25 * g, 0.26]]), o.hip || o.top, 0, 0, 0, 0, 0, 0, 1, 1, 0.72);
  kind(K.skin); part(P.chest, G.cyl(0.085, 0.1, 0.16, 10), skin, 0, 0.99, 0);
  part(P.head, G.sph(0.2, 18, 14), skin, 0, 0.27, 0.01, 0, 0, 0, 0.9, 1.12, 0.98); part(P.head, G.box(0.04, 0.07, 0.05), skin, 0, 0.25, 0.2);
  kind(K.paint); part(P.head, G.sph(0.022, 6, 5), '#120f0c', 0.07, 0.3, 0.176); part(P.head, G.sph(0.022, 6, 5), '#120f0c', -0.07, 0.3, 0.176);
  for (const [ua, fa] of [[P.uaL, P.faL], [P.uaR, P.faR]]) {
    kind(o.armK ?? o.topK ?? K.cloth); part(ua, G.sph(0.115 * g, 12, 9), o.arm || o.top, 0, 0, 0); part(ua, G.cyl(0.095 * g, 0.08 * g, 0.5, 10), o.arm || o.top, 0, -0.28, 0);
    part(fa, G.sph(0.082 * g, 10, 8), o.arm || o.top, 0, 0, 0);
    if (o.sleeve) part(fa, G.cyl(0.085, 0.2, 0.5, 12), o.sleeve, 0, -0.27, 0.02); else part(fa, G.cyl(0.078 * g, 0.06 * g, 0.48, 10), o.fore || o.arm || o.top, 0, -0.26, 0);
    kind(K.skin); part(fa, G.sph(0.07, 10, 8), o.hand || skin, 0, HAND, 0, 0, 0, 0, 1, 1.25, 0.8);
  }
  if (!o.robe) for (const [th, sh] of [[P.thL, P.shL], [P.thR, P.shR]]) {
    kind(o.legK ?? K.cloth); part(th, G.cyl(0.135 * g, 0.105 * g, 0.8, 12), o.leg, 0, -0.4, 0); part(sh, G.sph(0.105 * g, 10, 8), o.leg, 0, 0, 0.01);
    part(sh, G.cyl(0.1 * g, 0.075 * g, 0.7, 12), o.leg, 0, -0.38, 0);
    kind(o.bootK ?? K.cloth); part(sh, G.cyl(0.105, 0.09, 0.32, 10), o.boot, 0, -0.62, 0); part(sh, G.box(0.17, 0.15, 0.38), o.boot, 0, -0.845, 0.08);
  }
}
// a floor-length robe skirt with pressed folds
function skirt(P, col, flare = 0.6, hem = null) {
  kind(K.cloth);
  const g = lathe([[flare, -1.66], [0.45, -1.1], [0.35, -0.5], [0.3, 0.02], [0.26, 0.22]], 28), p = g.attributes.position;   // bottom-up, so the cloth faces outward
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + Math.sin(Math.atan2(z, x) * 9) * 0.06 * Math.min(1, Math.max(0, -y / 0.8)); p.setXYZ(i, x * k, y, z * k); }
  g.computeVertexNormals(); part(P.hips, g, col, 0, 0, 0, 0, 0, 0, 1, 1, 0.86);
  if (hem) part(P.hips, G.tor(flare * 0.93, 0.03, 6, 28), hem, 0, -1.64, 0, PI / 2, 0, 0, 1, 0.86, 1);
}
const collar = (P, col) => { kind(K.cloth); part(P.chest, G.box(0.09, 0.62, 0.05), col, 0.1, 0.62, 0.235, 0, 0, 0.42); part(P.chest, G.box(0.09, 0.62, 0.05), col, -0.1, 0.62, 0.24, 0, 0, -0.42); };
const sash = (P, col, knot) => { kind(K.cloth); part(P.chest, G.cyl(0.275, 0.285, 0.16, 16), col, 0, 0.1, 0, 0, 0, 0, 1, 1, 0.72); if (knot) part(P.hips, G.box(0.1, 0.6, 0.04), col, 0.1, -0.12, 0.24, -0.06); };
function hairCap(P, col, long = 0) {
  kind(K.cloth); part(P.head, G.sph(0.215, 16, 12), col, 0, 0.335, -0.045, 0, 0, 0, 0.95, 1.04, 1.02);
  if (long) part(P.chest, G.cap(0.13, long), col, 0, 0.9 - long / 2, -0.2, 0.06, 0, 0, 1.25, 1, 0.5);
}
const topknot = (P, col, pin) => { kind(K.cloth); part(P.head, G.sph(0.085, 10, 8), col, 0, 0.58, -0.05); kind(K.metal); part(P.head, G.cyl(0.012, 0.012, 0.32, 5), pin || BRASS, 0, 0.57, -0.05, 0, 0, PI / 2); };
// hanging cloth behind the shoulders (chest-local); the cape material makes it billow
function cape(P, col, w, top, len, trim) {
  kind(K.cloth);
  const g = new THREE.PlaneGeometry(w, len, 6, 10); part(P.cape, g, col, 0, top - len / 2, -0.245);
  if (trim) part(P.cape, new THREE.PlaneGeometry(w, 0.1, 6, 1), trim, 0, top - len + 0.07, -0.243);
  return { top, len };
}
// weapons live in the right forearm's frame: the hand is at y = HAND and "forward out of the fist" is +Z
function blade(L, len, w, col, glow, o = {}) {
  kind(K.metal); part(L, G.box(w, 0.035, len), col, 0, HAND, 0.14 + len / 2);
  if (glow) part(L, G.box(w * 0.22, 0.045, len * 0.86), glow, 0, HAND, 0.14 + len / 2, 0, 0, 0, 1, 1, 1, o.glowK || 1.5);
  part(L, G.box(o.guard || 0.34, 0.07, 0.07), o.guardCol || BRASS, 0, HAND, 0.12);
  kind(K.wood); part(L, G.cyl(0.035, 0.035, 0.26, 8), LEATHER, 0, HAND, -0.02, PI / 2);
  kind(K.metal); part(L, G.sph(0.05, 8, 6), o.guardCol || BRASS, 0, HAND, -0.17);
}
function staff(L, len, col, up = 0.62) { kind(K.wood); part(L, G.cyl(0.035, 0.045, len, 8), col, 0, HAND, len * (up - 0.5), PI / 2); return len * up; } // returns z of the top end

// ---- the nine ----
const OUTFIT = {
  // 韩不语 · 刑律堂首座「镇关」：墨色劲装，口覆黑巾，手持封着剑意的重尺
  warden(P, tc) {
    body(P, { girth: 1.1, top: '#1b1e29', leg: '#14161e', boot: INK, fore: '#0f1016' });
    kind(K.metal); part(P.chest, lathe([[0.3, 0.3], [0.39, 0.55], [0.41, 0.72], [0.31, 0.84]], 16), '#2a2e3a', 0, 0, 0.01, 0, 0, 0, 1, 1, 0.7);
    for (const s of [1, -1]) { part(P.chest, G.sph(0.19, 12, 9), '#2a2e3a', s * 0.47, 0.8, 0, 0, 0, 0, 1.15, 0.7, 1.1); part(P.chest, G.tor(0.17, 0.022, 5, 16), BRASS, s * 0.47, 0.74, 0, PI / 2); }
    part(P.faL, G.cyl(0.095, 0.08, 0.3, 10), '#2a2e3a', 0, -0.26, 0); part(P.faR, G.cyl(0.095, 0.08, 0.3, 10), '#2a2e3a', 0, -0.26, 0);
    part(P.faL, G.box(0.11, 0.17, 0.03), BRASS, 0.09, -0.26, 0); part(P.faL, G.box(0.05, 0.09, 0.035), tc.glow, 0.095, -0.26, 0, 0, 0, 0, 1, 1, 1, 1.7);
    sash(P, tc.dark, true); collar(P, tc.main);
    kind(K.cloth); part(P.head, G.box(0.3, 0.14, 0.06), INK, 0, 0.2, 0.17);                         // the cloth over his mouth
    part(P.head, G.cyl(0.2, 0.22, 0.14, 12), INK, 0, 0.47, -0.02); part(P.head, G.cyl(0.13, 0.15, 0.12, 10), INK, 0, 0.58, -0.04);
    kind(K.metal); part(P.head, G.box(0.09, 0.09, 0.03), tc.glow, 0, 0.48, 0.2, 0, 0, PI / 4, 1, 1, 1, 1.6);
    kind(K.metal); part(P.faR, G.box(0.2, 0.06, 2.1), '#101116', 0, HAND, 1.2); part(P.faR, G.box(0.05, 0.07, 1.8), tc.glow, 0, HAND, 1.25, 0, 0, 0, 1, 1, 1, 1.5);
    for (let i = 0; i < 6; i++) part(P.faR, G.box(0.21, 0.065, 0.02), BRASS, 0, HAND, 0.5 + i * 0.3);
    part(P.faR, G.box(0.3, 0.09, 0.09), BRASS, 0, HAND, 0.13); kind(K.wood); part(P.faR, G.cyl(0.04, 0.04, 0.3, 8), LEATHER, 0, HAND, -0.03, PI / 2);
    return { scale: 1.36, shX: 0.47, cape: cape(P, '#12141b', 0.84, 0.82, 1.75, tc.main) };
  },
  // 周易 · 天衍传人：青衫书生，左掌托命盘，三枚天衍钱绕身
  mage(P, tc) {
    body(P, { robe: true, top: '#2c575c', sleeve: '#356a6f', arm: '#2c575c' });
    skirt(P, '#274d52', 0.6, '#c9c2a8'); collar(P, '#d9d3bd'); sash(P, tc.main, true);
    kind(K.cloth); part(P.chest, lathe([[0.3, 0.6], [0.42, 0.74], [0.3, 0.88]], 14), '#3b767b', 0, 0, 0, 0, 0, 0, 1.15, 1, 0.78);
    hairCap(P, HAIR, 0.5); topknot(P, HAIR); kind(K.cloth); part(P.head, G.box(0.05, 0.3, 0.02), tc.main, 0.03, 0.42, -0.2, 0.3);
    kind(K.metal); part(P.faL, G.cyl(0.21, 0.21, 0.035, 20), BRASS, 0, HAND - 0.2, 0.12, PI / 2); part(P.faL, G.tor(0.21, 0.018, 5, 24), '#6b5320', 0, HAND - 0.2, 0.14);
    part(P.faL, G.cyl(0.07, 0.07, 0.05, 12), tc.glow, 0, HAND - 0.2, 0.15, PI / 2, 0, 0, 1, 1, 1, 2.6);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; part(P.orbit, G.tor(0.12, 0.035, 5, 14), tc.glow, Math.cos(a) * 1.05, 1.9 + i * 0.3, Math.sin(a) * 1.05, 0, a, 0, 1, 1, 1, 2.2); }
    return { scale: 1.3, shX: 0.4 };
  },
  // 苏紫烟 · 听雪：紫衣白裳，长发及腰，听雪剑带着寒气
  ranger(P, tc) {
    body(P, { robe: true, top: '#d7d2e4', sleeve: '#4c3b7a', arm: '#4c3b7a', girth: 0.92 });
    skirt(P, '#463672', 0.56, '#cfc9e0'); collar(P, '#4c3b7a'); sash(P, tc.main, true);
    hairCap(P, HAIR, 0.95); topknot(P, HAIR, '#cfd6e2');
    kind(K.metal); part(P.head, G.oct(0.035), tc.glow, 0.17, 0.57, -0.05, 0, 0, 0, 1, 1.6, 1, 2);
    blade(P.faR, 1.55, 0.06, '#dfe7f2', [0.6, 0.85, 1.0], { guard: 0.2, guardCol: '#aab3c4', glowK: 1.7 });
    kind(K.wood); part(P.chest, G.box(0.08, 1.3, 0.05), '#2a2038', 0.12, 0.35, -0.27, 0, 0, 0.5);
    return { scale: 1.28, shX: 0.38, cape: cape(P, '#3d2f66', 0.6, 0.78, 1.3, tc.main) };
  },
  // 柳红衣 · 噬魂：一身红衣，双手短刃，来去只见一抹红影
  shade(P, tc) {
    body(P, { robe: true, top: '#7f1220', sleeve: '#5c0d18', arm: '#7f1220', girth: 0.92 });
    skirt(P, '#8a1422', 0.52, INK); collar(P, INK); sash(P, INK, true);
    hairCap(P, HAIR, 0.6); kind(K.cloth); part(P.head, G.sph(0.1, 10, 8), HAIR, 0, 0.55, -0.1); part(P.head, G.box(0.26, 0.12, 0.05), '#7f1220', 0, 0.19, 0.17);
    kind(K.metal); part(P.head, G.cyl(0.012, 0.012, 0.36, 5), '#c9a04a', 0, 0.56, -0.1, 0, 0, 1.2); part(P.head, G.oct(0.03), tc.glow, 0.17, 0.62, -0.1, 0, 0, 0, 1, 1, 1, 2);
    for (const L of [P.faL, P.faR]) { kind(K.metal); part(L, G.box(0.06, 0.02, 0.62), '#c8ced8', 0, HAND, 0.4, 0.12); part(L, G.box(0.015, 0.03, 0.5), tc.glow, 0, HAND - 0.01, 0.42, 0.12, 0, 0, 1, 1, 1, 1.8); part(L, G.box(0.16, 0.05, 0.05), INK, 0, HAND, 0.1); kind(K.wood); part(L, G.cyl(0.03, 0.03, 0.2, 6), INK, 0, HAND, 0, PI / 2); }
    return { scale: 1.27, shX: 0.38, cape: cape(P, '#a3182a', 0.42, 0.8, 1.5, INK) };
  },
  // 孙伯 · 守拙：藏经阁扫地的老人，斗笠竹帚，腰间一只丹葫芦
  healer(P, tc) {
    body(P, { robe: true, top: '#5a5042', sleeve: '#6a5f4e', arm: '#5a5042', skin: '#b08e72' });
    skirt(P, '#4f4639', 0.58); collar(P, '#8a7d66'); sash(P, tc.dark, false);
    kind(K.cloth); part(P.chest, G.box(0.22, 0.2, 0.03), '#6f6450', -0.12, 0.42, 0.25, 0, 0, 0.2);                 // a patch
    part(P.head, G.cone(0.52, 0.26, 20), '#a8925c', 0, 0.56, 0); part(P.head, G.cyl(0.52, 0.53, 0.02, 20), '#8d7a4c', 0, 0.43, 0);
    part(P.head, G.cone(0.11, 0.42, 8), '#d8d4c8', 0, -0.02, 0.15, PI + 0.25); part(P.head, G.box(0.2, 0.03, 0.03), '#d8d4c8', 0, 0.345, 0.185);
    const top = staff(P.faR, 3.1, '#6b5a36', 0.5);
    kind(K.cloth); part(P.faR, G.cone(0.26, 0.75, 12), '#b39a55', 0, HAND, -top - 0.2, -PI / 2); kind(K.cloth); part(P.faR, G.cyl(0.09, 0.09, 0.1, 10), LEATHER, 0, HAND, -top + 0.12, PI / 2);
    kind(K.paint); part(P.hips, G.sph(0.13, 12, 9), '#8a5a22', 0.3, -0.05, 0.14); part(P.hips, G.sph(0.085, 10, 8), '#8a5a22', 0.3, 0.1, 0.14); part(P.hips, G.sph(0.03, 6, 5), tc.glow, 0.3, 0.2, 0.14, 0, 0, 0, 1, 1, 1, 2.4);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; part(P.orbit, G.sph(0.07, 8, 6), tc.glow, Math.cos(a) * 1.0, 1.7 + i * 0.35, Math.sin(a) * 1.0, 0, 0, 0, 1, 1, 1, 2.4); }
    return { scale: 1.22, shX: 0.4, hunch: 0.26 };
  },
  // 寒漪 · 玄霜宗长老：霜白长袍，银发冰冠，冰晶法杖
  cryo(P, tc) {
    body(P, { robe: true, top: '#7d9db6', sleeve: '#93b1c8', arm: '#7d9db6', girth: 0.94, skin: '#d6c2b4' });
    skirt(P, '#6f8fa9', 0.62, '#b9cfe0'); collar(P, '#b9cfe0'); sash(P, tc.main, true);
    kind(K.cloth); part(P.chest, lathe([[0.3, 0.62], [0.45, 0.76], [0.3, 0.9]], 14), '#a9c2d6', 0, 0, 0, 0, 0, 0, 1.15, 1, 0.8);
    hairCap(P, '#b9c2cc', 1.0);
    kind(K.metal); for (let i = -2; i <= 2; i++) part(P.head, G.oct(0.045), [0.6, 0.9, 1.0], i * 0.075, 0.56 - Math.abs(i) * 0.03, 0.08 - Math.abs(i) * 0.03, 0, 0, i * 0.12, 1, 2.2 - Math.abs(i) * 0.4, 1, 1.4);
    const top = staff(P.faR, 3.0, '#9fb6c8', 0.62);
    kind(K.metal); part(P.faR, G.oct(0.22), [0.6, 0.9, 1.0], 0, HAND, top + 0.25, PI / 2, 0, 0, 1, 1.9, 1, 1.8); for (const s of [1, -1]) part(P.faR, G.oct(0.09), [0.6, 0.9, 1.0], s * 0.2, HAND, top + 0.05, PI / 2, 0, s * 0.5, 1, 2, 1, 1.5);
    for (let i = 0; i < 4; i++) { const a = i * 1.571; part(P.orbit, G.oct(0.13), [0.6, 0.9, 1.0], Math.cos(a) * 1.15, 1.6 + i * 0.3, Math.sin(a) * 1.15, 0.3, a, 0, 1, 2, 1, 1.5); }
    return { scale: 1.3, shX: 0.39, cape: cape(P, '#c4dcec', 0.7, 0.8, 1.6, tc.main) };
  },
  // 老铁 · 北荒刀客：兽皮坎肩，赤膊，一口崩了刃的厚背刀
  berserker(P, tc) {
    body(P, { girth: 1.2, top: '#4f4132', arm: '#b58c6c', armK: K.skin, fore: '#3a2c20', leg: '#3b2f25', boot: '#2a2019', skin: '#b58c6c' });
    kind(K.cloth); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; part(P.chest, G.sph(0.13, 8, 6), '#7b6a55', Math.cos(a) * 0.36, 0.86, Math.sin(a) * 0.24, 0, 0, 0, 1.1, 0.9, 1.1); }
    part(P.chest, G.box(0.12, 0.9, 0.06), LEATHER, 0.14, 0.45, 0.27, 0, 0, 0.5); sash(P, tc.main, true);
    for (const L of [P.shL, P.shR]) part(L, G.tor(0.115, 0.045, 6, 12), '#7b6a55', 0, -0.47, 0, PI / 2);
    kind(K.metal); part(P.uaL, G.tor(0.11, 0.025, 5, 14), BRASS, 0, -0.2, 0, PI / 2);
    hairCap(P, '#2a2119'); kind(K.cloth); part(P.head, G.sph(0.14, 10, 8), '#2a2119', 0, 0.14, 0.1, 0, 0, 0, 1.2, 0.9, 0.9); part(P.head, G.box(0.42, 0.06, 0.2), tc.main, 0, 0.42, 0.02);
    kind(K.metal); part(P.faR, G.box(0.36, 0.05, 1.7), '#8a9099', 0, HAND, 1.15); part(P.faR, G.box(0.1, 0.07, 1.7), '#4b5059', 0.17, HAND, 1.15); part(P.faR, G.box(0.26, 0.055, 0.3), '#8a9099', -0.05, HAND, 2.1, 0, 0.5, 0);
    part(P.faR, G.box(0.03, 0.06, 1.5), tc.glow, -0.14, HAND, 1.15, 0, 0, 0, 1, 1, 1, 1.5); part(P.faR, G.box(0.44, 0.09, 0.08), BRASS, 0, HAND, 0.26);
    kind(K.wood); part(P.faR, G.cyl(0.045, 0.045, 0.6, 8), LEATHER, 0, HAND, -0.05, PI / 2); kind(K.metal); part(P.faR, G.tor(0.08, 0.02, 5, 12), BRASS, 0, HAND, -0.4);
    return { scale: 1.4, shX: 0.5 };
  },
  // 吴镇岳 · 天元宗峰主：札甲在身，破魂弩在手，腰间一排雷火符
  gunner(P, tc) {
    body(P, { girth: 1.05, top: '#3c4f66', leg: '#2c3a4c', boot: '#20252d', fore: '#59616c' });
    kind(K.metal); for (let r = 0; r < 4; r++) part(P.chest, lathe([[0.3 + r * 0.02, 0.16 + r * 0.17], [0.36 + r * 0.012, 0.25 + r * 0.17], [0.33 + r * 0.02, 0.34 + r * 0.17]], 16), r % 2 ? '#6d7480' : '#596069', 0, 0, 0, 0, 0, 0, 1, 1, 0.7);
    for (const s of [1, -1]) part(P.chest, G.sph(0.17, 12, 9), '#6d7480', s * 0.45, 0.8, 0, 0, 0, 0, 1.1, 0.65, 1.1);
    for (const L of [P.thL, P.thR]) part(L, G.box(0.26, 0.5, 0.05), '#596069', 0, -0.25, 0.13);
    sash(P, tc.main, false); kind(K.paint); for (let i = 0; i < 4; i++) { part(P.hips, G.box(0.09, 0.22, 0.015), '#c9b25a', -0.18 + i * 0.12, -0.02, 0.235); part(P.hips, G.box(0.03, 0.12, 0.02), tc.glow, -0.18 + i * 0.12, -0.02, 0.24, 0, 0, 0, 1, 1, 1, 1.9); }
    hairCap(P, HAIR); topknot(P, HAIR, STEEL); kind(K.metal); part(P.head, G.tor(0.2, 0.025, 5, 18), STEEL, 0, 0.42, -0.02, PI / 2 - 0.15);
    kind(K.wood); part(P.faR, G.box(0.08, 1.15, 0.11), WOOD, 0, HAND - 0.35, 0.04);
    kind(K.metal); part(P.faR, G.tor(0.52, 0.035, 6, 20, PI), STEEL, 0, HAND - 0.92 + 0.5, 0.04, 0, 0, PI); part(P.faR, G.box(0.03, 0.9, 0.03), tc.glow, 0, HAND - 0.5, 0.1, 0, 0, 0, 1, 1, 1, 1.9); part(P.faR, G.box(0.14, 0.14, 0.14), BRASS, 0, HAND - 0.75, 0.04);
    return { scale: 1.32, shX: 0.44, cape: cape(P, '#2c3a4c', 0.66, 0.8, 1.1, tc.main) };
  },
  // 沈渊 · 天刑台执法副使：玄袍金缘，乌纱高冠，掌中一方刑印引雷
  storm(P, tc) {
    body(P, { robe: true, top: '#1a1820', sleeve: '#221f2b', arm: '#1a1820' });
    skirt(P, '#15131a', 0.6, '#b08a3e'); collar(P, '#b08a3e'); kind(K.metal); part(P.chest, G.cyl(0.285, 0.295, 0.14, 16), '#b08a3e', 0, 0.1, 0, 0, 0, 0, 1, 1, 0.72); part(P.chest, G.box(0.14, 0.14, 0.04), tc.glow, 0, 0.1, 0.215, 0, 0, 0, 1, 1, 1, 1.8);
    kind(K.cloth); part(P.chest, lathe([[0.3, 0.6], [0.44, 0.76], [0.3, 0.9]], 14), '#221f2b', 0, 0, 0, 0, 0, 0, 1.15, 1, 0.8);
    hairCap(P, HAIR); kind(K.cloth); part(P.head, G.cyl(0.19, 0.21, 0.16, 12), INK, 0, 0.5, -0.02); part(P.head, G.box(0.24, 0.26, 0.2), INK, 0, 0.66, -0.07);
    for (const s of [1, -1]) part(P.head, G.box(0.34, 0.07, 0.02), INK, s * 0.3, 0.56, -0.12, 0, 0, s * 0.12);
    kind(K.metal); part(P.head, G.box(0.06, 0.06, 0.02), '#b08a3e', 0, 0.5, 0.19);
    const top = staff(P.faR, 3.0, '#2a2620', 0.62);
    kind(K.metal); part(P.faR, G.box(0.26, 0.26, 0.26), '#b08a3e', 0, HAND, top + 0.1); part(P.faR, G.box(0.16, 0.16, 0.28), tc.glow, 0, HAND, top + 0.1, 0, 0, 0, 1, 1, 1, 2.4); part(P.faR, G.tor(0.2, 0.02, 5, 16), '#b08a3e', 0, HAND, top - 0.12);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; part(P.orbit, G.box(0.16, 0.16, 0.16), tc.glow, Math.cos(a) * 1.1, 2.0 + i * 0.25, Math.sin(a) * 1.1, 0.5, a, 0.4, 1, 1, 1, 2.2); }
    return { scale: 1.32, shX: 0.4, cape: cape(P, '#15131a', 0.72, 0.8, 1.65, '#b08a3e') };
  },
  // 周远川 · 天衍城守门人：皮裘在身，左臂一面门板似的大盾，右手铜锏
  keeper(P, tc) {
    body(P, { girth: 1.16, top: '#3b4452', leg: '#262c36', boot: '#3a3128', fore: '#59616c' });
    kind(K.cloth); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; part(P.chest, G.sph(0.14, 8, 6), i % 2 ? '#b9b4a8' : '#a39d90', Math.cos(a) * 0.38, 0.87, Math.sin(a) * 0.25, 0, 0, 0, 1.1, 0.9, 1.1); }
    sash(P, tc.main, true); for (const L of [P.shL, P.shR]) part(L, G.tor(0.115, 0.05, 6, 12), '#b9b4a8', 0, -0.47, 0, PI / 2);
    kind(K.metal); part(P.chest, lathe([[0.3, 0.28], [0.4, 0.52], [0.4, 0.68], [0.32, 0.8]], 16), '#59616c', 0, 0, 0.01, 0, 0, 0, 1, 1, 0.7); part(P.chest, G.cyl(0.11, 0.11, 0.03, 12), BRASS, 0, 0.56, 0.285, PI / 2); part(P.chest, G.box(0.07, 0.07, 0.04), tc.glow, 0, 0.56, 0.29, 0, 0, 0, 1, 1, 1, 1.7);
    hairCap(P, '#8f8f8f'); topknot(P, '#8f8f8f'); kind(K.cloth); part(P.head, G.cone(0.13, 0.3, 8), '#9a9a9a', 0, 0.06, 0.14, PI + 0.2);
    kind(K.metal); part(P.faL, G.box(0.95, 0.09, 1.7), '#4a5160', 0, HAND - 0.12, 0.25); part(P.faL, G.box(1.03, 0.11, 0.1), BRASS, 0, HAND - 0.12, 1.08); part(P.faL, G.box(1.03, 0.11, 0.1), BRASS, 0, HAND - 0.12, -0.58); part(P.faL, G.box(0.08, 0.11, 1.7), BRASS, 0, HAND - 0.13, 0.25);
    for (const [bx, bz] of [[-0.28, 0.75], [0.28, 0.75], [-0.28, -0.25], [0.28, -0.25]]) part(P.faL, G.sph(0.06, 6, 5), BRASS, bx, HAND - 0.18, bz); part(P.faL, G.box(0.26, 0.1, 0.26), tc.glow, 0, HAND - 0.19, 0.25, 0, PI / 4, 0, 1, 1, 1, 1.7);
    part(P.faR, G.cyl(0.07, 0.06, 1.3, 8), '#6f757f', 0, HAND, 0.75, PI / 2); for (let i = 0; i < 4; i++) part(P.faR, G.cyl(0.12, 0.12, 0.09, 8), BRASS, 0, HAND, 0.55 + i * 0.26, PI / 2); part(P.faR, G.sph(0.11, 8, 6), tc.glow, 0, HAND, 1.45, 0, 0, 0, 1, 1, 1, 1.6);
    kind(K.wood); part(P.faR, G.cyl(0.04, 0.04, 0.3, 8), LEATHER, 0, HAND, -0.02, PI / 2);
    return { scale: 1.4, shX: 0.5, cape: cape(P, '#8d877a', 0.9, 0.82, 1.7, tc.main) };
  },
  // 血屠子 · 血魂宗主：暗红法袍，白发披散，十指血光，肩上骨刺
  bloodlord(P, tc) {
    body(P, { robe: true, girth: 1.12, top: '#2a0c10', sleeve: '#3a1016', arm: '#2a0c10', skin: '#c9b8b0' });
    skirt(P, '#240a0e', 0.66, '#7a1018'); collar(P, '#7a1018'); sash(P, '#0d0507', true);
    kind(K.paint); for (const sd of [1, -1]) { part(P.chest, G.sph(0.2, 12, 9), '#1a0709', sd * 0.47, 0.8, 0, 0, 0, 0, 1.15, 0.7, 1.1); for (let i = 0; i < 3; i++) part(P.chest, G.cone(0.07, 0.42, 6), '#d9d2c4', sd * (0.42 + i * 0.1), 0.98 - i * 0.04, -0.06 + i * 0.06, 0, 0, sd * (-0.5 - i * 0.25)); }
    part(P.chest, G.sph(0.11, 10, 8), '#d9d2c4', 0, 0.12, 0.26, 0, 0, 0, 1, 1.1, 0.7); part(P.chest, G.sph(0.03, 6, 5), tc.glow, 0.04, 0.14, 0.33, 0, 0, 0, 1, 1, 1, 2.6); part(P.chest, G.sph(0.03, 6, 5), tc.glow, -0.04, 0.14, 0.33, 0, 0, 0, 1, 1, 1, 2.6);
    hairCap(P, '#cfc8be', 1.1); kind(K.paint); part(P.head, G.box(0.03, 0.12, 0.02), tc.glow, 0, 0.4, 0.2, 0, 0, 0, 1, 1, 1, 2.4);
    for (const L of [P.faL, P.faR]) for (let i = -1; i <= 1; i++) part(L, G.cone(0.028, 0.36, 5), tc.glow, i * 0.055, HAND - 0.02, 0.24, PI / 2 - 0.1, 0, i * -0.15, 1, 1, 1, 2.3);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; part(P.orbit, G.sph(0.11, 10, 8), tc.glow, Math.cos(a) * 1.15, 1.5 + i * 0.4, Math.sin(a) * 1.15, 0, 0, 0, 1, 1.25, 1, 2.2); }
    return { scale: 1.38, shX: 0.46, cape: cape(P, '#3a0a10', 0.86, 0.8, 1.75, '#0d0507') };
  },
  // 沈焰 · 火岛守岛人：赤衣束袖，背一壶火羽箭，左手长弓
  archer(P, tc) {
    body(P, { girth: 0.98, top: '#8a2f14', leg: '#33261d', boot: '#241a14', fore: LEATHER, arm: '#8a2f14' });
    collar(P, '#e0a040'); sash(P, tc.main, true); kind(K.cloth); part(P.chest, G.box(0.1, 1.2, 0.05), LEATHER, -0.1, 0.45, 0.27, 0, 0, -0.6);
    part(P.chest, G.cyl(0.16, 0.14, 0.95, 10), LEATHER, 0.28, 0.42, -0.3, 0, 0, -0.45);
    kind(K.metal); for (let i = 0; i < 4; i++) part(P.chest, G.box(0.03, 0.34, 0.03), tc.glow, 0.44 + i * 0.045, 0.92, -0.3 + (i % 2) * 0.05, 0, 0, -0.45, 1, 1, 1, 2.0);
    hairCap(P, HAIR, 0.45); topknot(P, HAIR, '#e0a040'); kind(K.cloth); part(P.head, G.box(0.42, 0.055, 0.2), '#c8401a', 0, 0.42, 0.02); part(P.head, G.box(0.05, 0.34, 0.02), '#c8401a', -0.12, 0.3, -0.21, 0.3);
    kind(K.wood); part(P.faL, G.tor(0.98, 0.045, 6, 26, PI), '#5e2f18', 0, HAND + 0.28, 0, 0, PI / 2, PI, 1, 0.28, 1);
    kind(K.paint); part(P.faL, G.cyl(0.012, 0.012, 1.96, 4), tc.glow, 0, HAND + 0.28, 0, PI / 2, 0, 0, 1, 1, 1, 1.6);
    kind(K.metal); part(P.faL, G.box(0.06, 0.2, 0.06), BRASS, 0, HAND, 0); part(P.faL, G.oct(0.06), tc.glow, 0, HAND - 0.02, 0.98, 0, 0, 0, 1, 1, 1.6, 2.0); part(P.faL, G.oct(0.06), tc.glow, 0, HAND - 0.02, -0.98, 0, 0, 0, 1, 1, 1.6, 2.0);
    return { scale: 1.3, shX: 0.4, cape: cape(P, '#6e2410', 0.5, 0.78, 1.0, '#e0a040') };
  },
};

// resting arm poses per weapon style: [rightShoulder, rightElbow, leftShoulder, leftElbow]
const IDLE = { shield: [-0.2, -0.5, -0.62, -1.05], archer: [0.05, -0.3, -0.35, -0.6], sword: [-0.12, -0.32, -0.1, -0.35], staff: [-0.5, -0.95, 0.04, -0.3], bow: [-0.25, -0.5, 0.04, -0.3], dual: [-0.3, -1.05, -0.3, -1.05], axe: [-0.32, -0.95, -0.6, -1.3], gun: [-0.62, -1.2, -0.95, -0.85] };
const mix = (a, b, t) => a + (b - a) * t;

let SOUL_GEO = null;
export function buildHero(def, team, isPlayer, fx, parent) {
  const tc = TEAM_COL[team], P = newParts(), O = OUTFIT[def.id](P, tc); kind(K.paint);
  if (def.size) O.scale = def.size;   // body size lives with the rest of the hero's numbers
  const rim = new THREE.Color(tc.glow[0], tc.glow[1], tc.glow[2]).multiplyScalar(0.9);
  const mat = vcMat({ rim }), capeMat = O.cape ? vcMat({ rim, cape: O.cape, side: THREE.DoubleSide }) : null;
  const mk = (list, m = mat) => { const o = new THREE.Mesh(build(list), m); o.castShadow = true; return o; };
  const grp = (x, y, z, par) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; };
  const root = new THREE.Group(), bodyG = grp(0, 0, 0, root); bodyG.scale.setScalar(O.scale);
  const hips = grp(0, 1.72, 0, bodyG); hips.add(mk(P.hips));
  const chest = grp(0, 1.95, 0, bodyG); chest.add(mk(P.chest));
  const head = grp(0, 0.95, 0, chest); head.add(mk(P.head));
  const sx = O.shX || 0.42;
  const shR = grp(-sx, 0.77, 0, chest), shL = grp(sx, 0.77, 0, chest); shR.add(mk(P.uaR)); shL.add(mk(P.uaL));
  const elR = grp(0, -0.56, 0, shR), elL = grp(0, -0.56, 0, shL); elR.add(mk(P.faR)); elL.add(mk(P.faL));
  let hipL = null, hipR = null, knL = null, knR = null, orbit = null;
  if (P.thL.length) { hipL = grp(0.17, 1.72, 0, bodyG); hipR = grp(-0.17, 1.72, 0, bodyG); hipL.add(mk(P.thL)); hipR.add(mk(P.thR)); knL = grp(0, -0.8, 0, hipL); knR = grp(0, -0.8, 0, hipR); knL.add(mk(P.shL)); knR.add(mk(P.shR)); }
  if (P.cape.length) chest.add(mk(P.cape, capeMat));
  if (P.orbit.length) { orbit = mk(P.orbit); orbit.castShadow = false; bodyG.add(orbit); }
  // 金丹: a golden core glowing at the dantian. 元婴: a small figure of light seated above the head, slowly turning.
  const glowM = (r, g, b, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
  const lit = (geo, mat, par, x, y, z) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); q.userData.noAO = true; par.add(q); return q; };
  const core = lit(new THREE.SphereGeometry(0.11, 12, 8), glowM(1.9, 1.25, 0.3, 0.9), chest, 0, 0.2, 0.3); lit(new THREE.SphereGeometry(0.28, 12, 8), glowM(0.8, 0.5, 0.1, 0.2), core, 0, 0, 0); core.visible = false;
  const soul = new THREE.Group(), sc = def.tint, sm = glowM(0.45 + sc[0] * 0.6, 0.45 + sc[1] * 0.6, 0.45 + sc[2] * 0.6, 0.75);
  lit(SOUL_GEO || (SOUL_GEO = mergeGeometries([new THREE.SphereGeometry(0.1, 10, 8).translate(0, 0.36, 0), new THREE.ConeGeometry(0.17, 0.36, 10).translate(0, 0.14, 0), new THREE.TorusGeometry(0.3, 0.014, 5, 28).rotateX(PI / 2).translate(0, 0.1, 0)])), sm, soul, 0, 0, 0);   // one draw for the whole figure, one geometry for everyone lit(new THREE.SphereGeometry(0.42, 10, 8), glowM(sc[0] * 0.35, sc[1] * 0.35, sc[2] * 0.35, 0.14), soul, 0, 0.2, 0);
  soul.position.set(0, 3.95, -0.05); soul.scale.setScalar(1.35); soul.visible = false; bodyG.add(soul);
  const ring = fx.decalMesh(3, (isPlayer ? 5.0 : 4.2) * O.scale / 1.3, isPlayer ? [0.45, 1.1, 0.55] : tc.glow, isPlayer ? 0.8 : 0.55); root.add(ring);
  parent.add(root);

  const style = def.style, idle = IDLE[style], v = { obj: root, walk: 0, mb: 0, atk: 0, cast: 0, dead: 0, deadT: 0, side: 1 };
  // in the brush: see-through and tinted — blue for your side (fainter while unseen), red for an enemy you have spotted
  let gh = 0;
  v.ghost = (on, ally, hid) => {
    const k = !on ? 0 : ally ? (hid ? 1 : 2) : 3; if (k === gh) return; const flip = (k > 0) !== (gh > 0); gh = k;
    for (const m of [mat, capeMat]) if (m) { m.transparent = k > 0; m.opacity = [1, 0.4, 0.7, 0.62][k]; if (k) m.color.setRGB(ally ? 0.45 : 1.7, ally ? 0.85 : 0.42, ally ? 1.8 : 0.36); else m.color.setRGB(1, 1, 1); if (flip) m.needsUpdate = true; }
  };
  v.update = (dt, e, t) => {
    root.position.set(e.x, e.y || 0, e.z); root.rotation.y = PI / 2 - e.facing;
    if (e.animAtk) { v.atk = 1; e.animAtk = 0; v.side = -v.side; } if (e.animCast) { v.cast = 1; e.animCast = 0; }
    v.atk = Math.max(0, v.atk - dt / 0.5); v.cast = Math.max(0, v.cast - dt / 0.55);
    e.flash = Math.max(0, e.flash - dt * 7); mat.userData.u.uFlash.value = e.flash * 0.6; if (capeMat) capeMat.userData.u.uFlash.value = e.flash * 0.6;
    if (!e.alive) {
      v.deadT += dt; v.dead = Math.min(1, v.dead + dt / 0.5);
      const k = v.dead * v.dead; bodyG.rotation.set(-1.5 * k, 0, 0); bodyG.position.y = 0.3 * k - Math.max(0, v.deadT - 1.6) * 1.6;
      root.visible = v.deadT < 4; ring.visible = false; return;
    }
    if (v.dead) { v.dead = 0; v.deadT = 0; root.visible = true; ring.visible = true; bodyG.rotation.set(0, 0, 0); }
    const lvl = e.level || 1; core.visible = lvl >= 5; soul.visible = lvl >= 9;
    if (core.visible) core.scale.setScalar(1 + 0.18 * Math.sin(t * 3.1 + e.id));
    if (soul.visible) { soul.position.y = 3.95 + Math.sin(t * 1.7 + e.id) * 0.08; soul.rotation.y = t * 0.7; }
    const dashing = !!e.dash, air = (e.y || 0) > 0.4;
    v.mb += ((e.moving || dashing ? 1 : 0) - v.mb) * Math.min(1, dt * 10);
    if (e.moving) v.walk += dt * e.curSpeed * 1.35;
    const w = v.walk, mb = v.mb, sw = Math.sin(w) * mb, c = Math.sin(v.cast * PI), breathe = Math.sin(t * 2.1 + e.id) * (1 - mb);
    const hk = e.hitK; if (hk > 0) e.hitK = Math.max(0, hk - dt * 5.5);
    const hf = (e.hitX * Math.cos(e.facing) + e.hitZ * Math.sin(e.facing)) * hk;   // + pushed forward, − knocked back
    let lunge = 0, rs = idle[0], re = idle[1], ls = idle[2], le = idle[3], cy = sw * 0.1, cx = (O.hunch || 0) + (dashing ? 0.45 : 0.1) * mb + breathe * 0.015, lift = 0;
    rs += sw * 0.3; ls -= sw * (style === 'shield' || style === 'archer' ? 0.12 : 0.45); re -= 0.15 * mb; le -= 0.15 * mb;
    if (v.atk > 0) {
      const p = 1 - v.atk, k = Math.min(1, Math.sin(p * PI) * 1.6);
      if (style === 'archer') {                     // raise the bow, draw to the cheek, loose
        const d = Math.min(1, p / 0.42), hold = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2, kk = d * hold; ls = mix(ls, -1.52, kk); le = mix(le, -0.04, kk); rs = mix(rs, -1.4, kk); re = mix(re, p < 0.5 ? -2.05 : -1.2, kk); cy = -0.5 * kk; cx += 0.04 * kk;
      } else if (style === 'sword' || style === 'axe' || style === 'shield') {   // wind up over the shoulder, then cut down and across
        if (p < 0.3) { const q = p / 0.3; rs = mix(rs, -2.9, q); re = mix(re, -1.35, q); cy = -0.5 * q; lunge = -0.12 * q; }
        else if (p < 0.55) { const q = (p - 0.3) / 0.25; rs = mix(-2.9, -0.55, q); re = mix(-1.35, -0.1, q); cy = mix(-0.5, 0.65, q); cx += 0.3 * q; lunge = mix(-0.12, 0.5, q); }
        else { const q = (p - 0.55) / 0.45; rs = mix(-0.55, rs, q); re = mix(-0.1, re, q); cy = mix(0.65, cy, q); cx += 0.3 * (1 - q); lunge = 0.5 * (1 - q); }
        if (style === 'axe') { ls = rs * 0.92 - 0.1; le = re * 0.9 - 0.3; } else if (style === 'shield') { ls = idle[2] - 0.25; le = idle[3]; }
      } else if (style === 'dual') {                // alternating thrusts
        if (v.side > 0) { rs = mix(rs, -1.5, k); re = mix(re, -0.12, k); cy = 0.4 * k; } else { ls = mix(ls, -1.5, k); le = mix(le, -0.12, k); cy = -0.4 * k; }
        cx += 0.15 * k; lunge = 0.38 * k;
      } else if (style === 'bow') { rs = mix(rs, -1.5, k); re = mix(re, -0.12, k); cy = 0.3 * k; cx += 0.1 * k; lunge = 0.2 * k; }  // sword-finger thrust that looses a blade of qi
      else if (style === 'gun') { rs = mix(rs, -1.45, k); re = mix(re, -0.22, k); ls = mix(ls, -1.3, k); le = mix(le, -0.55, k); cx -= 0.1 * Math.sin(p * PI * 2) * (p < 0.5 ? 1 : 0); }
      else { rs = mix(rs, -1.55, k); re = mix(re, -0.25, k); ls = mix(ls, -0.9, k * 0.6); cx += 0.1 * k; }   // staff thrust
    }
    if (c > 0) { rs = mix(rs, -2.75, c); re = mix(re, -0.35, c); ls = mix(ls, -2.3, c); le = mix(le, -0.5, c); lift = c * 0.28; cx -= 0.12 * c; }
    cx += hf * 0.42;
    bodyG.position.y = Math.abs(Math.cos(w)) * 0.07 * mb * O.scale + lift; bodyG.position.z = lunge * O.scale + hf * 0.3;
    bodyG.scale.set(O.scale * (1 + hk * 0.04), O.scale * (1 - hk * 0.06), O.scale * (1 + hk * 0.04));
    bodyG.rotation.z = e.stunT > 0 ? Math.sin(t * 24) * 0.12 : 0;
    chest.rotation.set(cx, cy, 0); chest.scale.setScalar(1 + breathe * 0.012); hips.rotation.set(sw * 0.04, -cy * 0.35, Math.cos(w) * 0.03 * mb); head.rotation.set(-cx * 0.6, -cy * 0.6, 0);
    shR.rotation.set(rs, 0, -0.1); elR.rotation.x = re; shL.rotation.set(ls, 0, 0.1); elL.rotation.x = le;
    if (hipL) {
      const tuck = air ? 1 : 0;
      hipL.rotation.x = -sw * 0.62 - tuck * 0.9; hipR.rotation.x = sw * 0.62 - tuck * 0.5;
      knL.rotation.x = mb * (0.12 + 0.95 * Math.max(0, Math.cos(w))) + tuck * 1.5; knR.rotation.x = mb * (0.12 + 0.95 * Math.max(0, -Math.cos(w))) + tuck * 1.1;
    }
    if (capeMat) capeMat.userData.u.uSway.value += ((dashing ? 1.6 : mb) - capeMat.userData.u.uSway.value) * Math.min(1, dt * 6);
    if (orbit) { orbit.rotation.y = t * 1.5; orbit.position.y = Math.sin(t * 1.3) * 0.08; }
  };
  return v;
}
