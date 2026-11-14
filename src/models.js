// models.js — every character and building is assembled from coloured primitives and animated procedurally.
// Each primitive is tagged with a surface kind (steel, cloth, skin, dressed stone, timber…) so the shared material can
// weather it properly. All models face +Z; views expose update(dt, entity, time).
import * as THREE from 'three';
import { TEAM_COL, FROST } from './config.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { vcMat, part, build, G, K, kind, uTime } from './mat.js';
import { buildHero } from './heroes.js';

const PI = Math.PI;
const mesh = (list, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(build(list), mat); m.position.set(x, y, z); m.castShadow = true; return m; };
const SKIN = '#b58a6c', WOOD = '#4d3524', LEATHER = '#3a2a1d', BRASS = '#9c7a35';

// faceted crystal: dark glassy body that reflects the sky, lit from within, brightest at grazing angles
function crystalMat(c, power, flat = true) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0] * 0.12, c[1] * 0.12, c[2] * 0.12), emissive: new THREE.Color(c[0], c[1], c[2]), emissiveIntensity: power, roughness: 0.08, metalness: 0.2, flatShading: flat });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float cf = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance *= (0.3 + 1.9 * cf * cf) * (0.85 + 0.15 * sin(uTime * 2.3));`);
  };
  m.customProgramCacheKey = () => 'crystal' + flat;
  return m;
}

export function createModels(R, fx) {
  const { scene } = R;
  const M = {};
  M.root = new THREE.Group(); scene.add(M.root);

  M.hero = (def, team, isPlayer) => buildHero(def, team, isPlayer, fx, M.root);

  // ---------- minions and jungle monsters (one merged mesh each, pooled) ----------
  const minionGeo = {}, pools = {};
  function minionGeometry(type, team) {
    const tc = TEAM_COL[team], L = [];
    if (type === 'melee') {
      kind(K.cloth); part(L, G.cyl(0.4, 0.5, 0.95, 12), tc.dark, 0, 0.75, 0); part(L, G.cyl(0.52, 0.54, 0.16, 12), tc.main, 0, 0.32, 0);
      kind(K.skin); part(L, G.sph(0.31, 12, 9), SKIN, 0, 1.5, 0);
      kind(K.metal); part(L, G.cone(0.4, 0.5, 12), '#6f757f', 0, 1.86, 0); part(L, G.cyl(0.44, 0.44, 0.07, 14), '#6f757f', 0.42, 0.95, 0.3, PI / 2, 0, 0.3);
      part(L, G.cyl(0.2, 0.2, 0.1, 10), tc.glow, 0.42, 0.95, 0.33, PI / 2, 0, 0.3, 1, 1, 1, 1.5); part(L, G.cone(0.09, 0.4, 6), '#b9c0c9', -0.45, 1.33, 1.5, PI / 2 - 0.25);
      kind(K.wood); part(L, G.cyl(0.04, 0.04, 2.1, 6), WOOD, -0.45, 1.05, 0.45, PI / 2 - 0.25);
    } else if (type === 'ranged') {
      kind(K.cloth); part(L, G.cyl(0.24, 0.52, 1.2, 12), tc.dark, 0, 0.62, 0); part(L, G.sph(0.37, 12, 9), tc.main, 0, 1.58, -0.05); part(L, G.cone(0.24, 0.5, 8), tc.main, 0, 1.75, -0.4, -1.8);
      kind(K.skin); part(L, G.sph(0.29, 12, 9), SKIN, 0, 1.5, 0.05);
      kind(K.wood); part(L, G.cyl(0.04, 0.04, 2.0, 6), WOOD, -0.42, 1.0, 0.25);
      kind(K.metal); part(L, G.oct(0.19), tc.glow, -0.42, 2.15, 0.25, 0, 0, 0, 1, 1.5, 1, 2.4);
    } else if (type === 'golem') {
      kind(K.rock); const rock = '#6a6258', rock2 = '#4f483f';
      part(L, G.ico(1.0), rock, 0, 1.15, 0, 0.3, 0.2, 0, 1.15, 0.95, 1); part(L, G.ico(0.55), rock2, 0.95, 1.6, 0.1, 0.5); part(L, G.ico(0.55), rock2, -0.95, 1.6, 0.1, 0, 0.7);
      part(L, G.ico(0.42), rock, 0, 2.05, 0.35); part(L, G.ico(0.45), rock2, 0.55, 0.4, 0.1); part(L, G.ico(0.45), rock2, -0.55, 0.4, 0.1);
      kind(K.cloth); part(L, G.ico(0.5), '#2c4319', 0.2, 1.98, -0.45, 0, 0, 0, 1.3, 0.45, 1.1); part(L, G.ico(0.4), '#2c4319', -0.8, 1.95, 0, 0, 0, 0, 1.1, 0.4, 1.1);
      kind(K.paint); part(L, G.sph(0.09, 8, 6), tc.glow, 0.16, 2.1, 0.72, 0, 0, 0, 1, 1, 1, 2.6); part(L, G.sph(0.09, 8, 6), tc.glow, -0.16, 2.1, 0.72, 0, 0, 0, 1, 1, 1, 2.6);
    } else if (type === 'puppet') { // 镇渊傀 — a suit of black iron with nobody in it: sealed by a talisman, chained, a halberd in its fist
      kind(K.metal); const iron = '#2a2e38', dark = '#1a1d24', steel = '#8a909c', seal = '#c070ff';
      for (const sx of [-0.42, 0.42]) { part(L, G.box(0.52, 0.95, 0.6), dark, sx, 0.48, 0); part(L, G.box(0.6, 0.22, 0.75), iron, sx, 0.11, 0.06); }
      part(L, G.box(1.5, 1.25, 0.95), iron, 0, 1.55, 0); part(L, G.cyl(0.9, 0.72, 0.5, 8), '#3a3f4b', 0, 2.05, 0); part(L, G.cyl(0.62, 0.8, 0.3, 8), dark, 0, 1.0, 0);
      for (const sx of [-1, 1]) { part(L, G.sph(0.52, 10, 8), '#3a3f4b', sx * 1.02, 2.25, 0, 0, 0, 0, 1.15, 0.7, 1.05); part(L, G.cone(0.14, 0.5, 6), steel, sx * 1.25, 2.6, 0, 0, 0, -sx * 0.6); part(L, G.cyl(0.22, 0.27, 1.25, 8), dark, sx * 1.08, 1.5, 0.05); part(L, G.box(0.42, 0.4, 0.46), iron, sx * 1.08, 0.82, 0.08); }
      part(L, G.box(0.6, 0.55, 0.6), dark, 0, 2.78, 0); part(L, G.box(0.7, 0.12, 0.7), iron, 0, 3.08, 0); for (const sx of [-1, 1]) part(L, G.cone(0.1, 0.62, 6), steel, sx * 0.3, 3.4, -0.05, 0, 0, -sx * 0.35);
      for (let i = 0; i < 3; i++) part(L, G.tor(0.82 - i * 0.03, 0.045, 5, 18), '#565b68', 0, 1.25 + i * 0.3, 0, PI / 2 + (i - 1) * 0.35, 0, (i - 1) * 0.3, 1, 1, 0.62);   // chains
      kind(K.wood); part(L, G.cyl(0.055, 0.055, 4.0, 6), '#2a1c14', 1.42, 2.0, 0.35);
      kind(K.metal); part(L, G.box(0.08, 1.0, 0.62), steel, 1.42, 3.75, 0.5); part(L, G.cone(0.12, 0.7, 6), steel, 1.42, 4.35, 0.35);
      kind(K.paint); part(L, G.box(0.46, 0.07, 0.05), seal, 0, 2.8, 0.31, 0, 0, 0, 1, 1, 1, 3.2);                                                         // the light behind the visor
      part(L, G.box(0.5, 0.78, 0.04), '#e6d9ae', 0, 1.7, 0.5); part(L, G.box(0.1, 0.56, 0.05), seal, 0, 1.7, 0.53, 0, 0, 0, 1, 1, 1, 2.6); part(L, G.box(0.34, 0.08, 0.05), seal, 0, 1.86, 0.53, 0, 0, 0, 1, 1, 1, 2.6);
    } else if (type === 'abyss') { // 渊主残念 — what is left of the Abyss Lord: a robe with no body, a crown of bone, the bone bowl in its hands, the seal-eye open, shards of the mirror turning behind
      kind(K.cloth); const robe = '#0d0a14', pale = '#e2d6ff', eye = '#b98cff', brew = '#9fffd0';
      part(L, G.cone(1.55, 3.5, 14), robe, 0, 1.75, 0); part(L, G.cone(1.9, 0.9, 14), '#07060b', 0, 0.45, 0); part(L, G.cyl(0.95, 1.3, 0.55, 12), '#1a1428', 0, 3.05, 0);
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; part(L, G.cone(0.2, 1.3, 5), '#120e1c', Math.cos(a) * 1.5, 0.5, Math.sin(a) * 1.5, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }   // the hem is in tatters
      part(L, G.sph(0.52, 12, 9), '#06050a', 0, 3.65, 0, 0, 0, 0, 1, 1.15, 1);
      kind(K.skin); const bone = '#cfc4ae';
      for (let i = 0; i < 7; i++) { const a = -1.4 + i * 0.467; part(L, G.cone(0.07, 0.75 - Math.abs(i - 3) * 0.1, 5), bone, Math.sin(a) * 0.48, 4.35 - Math.abs(i - 3) * 0.06, Math.cos(a) * 0.1 - 0.1, -0.15, 0, -a * 0.45); }   // crown
      for (const sx of [-1, 1]) { part(L, G.cyl(0.07, 0.11, 1.35, 6), bone, sx * 0.62, 2.55, 0.6, -1.05, 0, sx * 0.35); part(L, G.sph(0.14, 8, 6), bone, sx * 0.36, 2.25, 1.12); }
      part(L, G.sph(0.6, 14, 9), bone, 0, 2.08, 1.15, 0, 0, 0, 1, 0.55, 1); part(L, G.cyl(0.26, 0.36, 0.2, 10), bone, 0, 1.78, 1.15);
      kind(K.paint); part(L, G.cyl(0.46, 0.46, 0.06, 14), brew, 0, 2.3, 1.15, 0, 0, 0, 1, 1, 1, 2.8);                                                          // what the bowl holds
      part(L, G.sph(0.17, 10, 8), pale, 0, 3.68, 0.44, 0, 0, 0, 1, 1, 0.6, 3.6);                                                                               // one eye in the hood
      part(L, G.oct(0.36), eye, 0, 2.95, 0.82, 0, 0, 0, 1.7, 0.75, 0.35, 3.0); part(L, G.sph(0.11, 8, 6), '#08060c', 0, 2.95, 0.96);                           // the seal-eye
      for (let i = 0; i < 6; i++) { const a = -1.25 + i * 0.5; part(L, G.box(0.5, 0.85, 0.04), '#bfd0ff', Math.sin(a) * 2.2, 3.1 + Math.cos(a) * 0.9, -0.9, 0.2, a * 0.5, a * 0.6, 1, 1, 1, 1.9); }   // mirror shards
    } else { // guardian 血海残魂 — a remnant soul risen out of its own pool: a column of blood wearing a bone mask, ribs showing, a crown of clots
      kind(K.metal); const blood = '#5a0a10', deep = '#3a0508', clot = '#8a0f16';
      part(L, G.cyl(1.75, 1.95, 0.12, 20), deep, 0, 0.06, 0); part(L, G.cyl(1.1, 1.5, 0.5, 14), blood, 0, 0.3, 0);
      part(L, G.ico(1.0), blood, 0, 1.35, 0, 0, 0, 0, 1.1, 1.5, 1.0); part(L, G.ico(0.72), '#74101a', 0, 2.55, 0.05);
      for (const sx of [-1, 1]) { part(L, G.ico(0.5), blood, sx * 1.22, 1.75, 0.1, 0, 0, sx * 0.25, 0.62, 1.55, 0.62); part(L, G.ico(0.3), clot, sx * 1.35, 0.85, 0.3, 0, 0, 0, 0.8, 1.3, 0.8); }
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.6; part(L, G.ico(0.2), clot, Math.cos(a) * 1.7, 2.2 + (i % 2) * 0.7, Math.sin(a) * 1.3, 0, 0, 0, 1, 1.4, 1, 1.5); }           // drops that hang in the air
      kind(K.skin); const bone = '#d9cdb8';
      part(L, G.sph(0.44, 12, 9), bone, 0, 2.62, 0.5, 0, 0, 0, 0.86, 1.08, 0.5); part(L, G.box(0.3, 0.26, 0.2), bone, 0, 2.28, 0.6);
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) part(L, G.cyl(0.03, 0.06, 0.95, 5), bone, sx * 0.5, 1.8 - i * 0.3, 0.72, 0.5, 0, sx * 1.15);                              // ribs
      kind(K.paint); for (const sx of [-0.16, 0.16]) part(L, G.sph(0.1, 8, 6), '#ff2a14', sx, 2.7, 0.74, 0, 0, 0, 1, 1, 0.6, 3.2);
      for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; part(L, G.cone(0.13, 0.75 - Math.abs(i - 2) * 0.12, 6), clot, Math.sin(a) * 0.55, 3.3 - Math.abs(i - 2) * 0.08, 0, 0, 0, -a * 0.6, 1, 1, 1, 1.7); }   // crown
    }
    kind(K.paint);
    return build(L);
  }
  M.minion = (type, team, scale = 1) => {
    const key = type + team, pool = pools[key] || (pools[key] = []);
    let v = pool.pop();
    if (!v) {
      const geo = minionGeo[key] || (minionGeo[key] = minionGeometry(type, team));
      const tc = TEAM_COL[team];
      const mat = vcMat({ rim: new THREE.Color(tc.glow[0], tc.glow[1], tc.glow[2]).multiplyScalar(0.55) });
      const m = new THREE.Mesh(geo, mat); m.castShadow = true;
      const root = new THREE.Group(); root.add(m); M.root.add(root);
      v = { obj: root, m, mat, key, bob: Math.random() * 6, atk: 0, dead: 0 };
      // in the brush: see-through and tinted — blue for your side (fainter while unseen), red for an enemy you have spotted
      let gh = 0;
      v.ghost = (on, ally, hid) => {
        const k = !on ? 0 : ally ? (hid ? 1 : 2) : 3; if (k === gh) return; const flip = (k > 0) !== (gh > 0); gh = k;
        for (const m of [mat]) if (m) { m.transparent = k > 0; m.opacity = [1, 0.4, 0.7, 0.62][k]; if (k) m.color.setRGB(ally ? 0.45 : 1.7, ally ? 0.85 : 0.42, ally ? 1.8 : 0.36); else m.color.setRGB(1, 1, 1); if (flip) m.needsUpdate = true; }
      };
      v.update = (dt, e, t) => {
        root.position.set(e.x, 0, e.z); root.rotation.y = PI / 2 - e.facing;
        if (e.animAtk) { v.atk = 1; e.animAtk = 0; }
        v.atk = Math.max(0, v.atk - dt / 0.4);
        e.flash = Math.max(0, e.flash - dt * 7); mat.userData.u.uFlash.value = e.flash * 0.6;
        const hk = e.hitK; if (hk > 0) e.hitK = Math.max(0, hk - dt * 5.5);
        const s = v.scale;
        if (!e.alive) { v.dead = Math.min(1, v.dead + dt / 0.45); const k = 1 - v.dead; m.scale.set(s * k, s * k, s * k); m.rotation.x = -v.dead * 1.2; return; }
        if (e.moving) v.bob += dt * 11;
        const lunge = Math.sin((1 - v.atk) * PI) * (v.atk > 0 ? 1 : 0);
        m.position.set(0, e.moving ? Math.abs(Math.sin(v.bob)) * 0.14 * s : Math.sin(t * 2 + v.bob) * 0.03, lunge * 0.55 * s);
        const hf = (e.hitX * Math.cos(e.facing) + e.hitZ * Math.sin(e.facing)) * hk;
        m.rotation.x = (e.moving ? 0.1 : lunge * 0.3) + hf * 0.5; m.rotation.z = e.moving ? Math.sin(v.bob) * 0.07 : 0; m.position.z += hf * 0.3 * s;
        m.scale.set(s * (1 + hk * 0.14), s * (1 + Math.sin(t * 2.3 + v.bob) * 0.015) * (1 - hk * 0.2), s * (1 + hk * 0.14));
      };
    }
    scale *= 1.2; v.scale = scale; v.ghost(false); v.dead = 0; v.atk = 0; v.m.scale.setScalar(scale); v.m.rotation.set(0, 0, 0); v.obj.visible = true; v.mat.userData.u.uFlash.value = 0;
    return v;
  };
  M.reset = () => { scene.remove(M.root); M.root = new THREE.Group(); scene.add(M.root); for (const k in pools) pools[k].length = 0; };
  M.freeMinion = v => { v.obj.visible = false; pools[v.key].push(v); };

  // ---------- structures: weathered masonry holding a crystal ----------
  const stonePal = t => (t === FROST ? ['#5f6672', '#3c424d', '#767e8c'] : ['#473a35', '#2a211e', '#5d4a42']);
  function structure(team, x, z, staticList, liveMeshes, glowSize, spin) {
    const tc = TEAM_COL[team], root = new THREE.Group(); root.position.set(x, 0, z);
    const mat = vcMat({ world: true });
    const base = mesh(staticList, mat); base.receiveShadow = true; root.add(base);
    const live = new THREE.Group(); root.add(live); for (const m of liveMeshes) live.add(m);
    const glow = fx.decalMesh(0, glowSize, tc.glow, 0.4); root.add(glow);
    M.root.add(root);
    const v = { obj: root, dead: 0 };
    v.update = (dt, e, t) => {
      e.flash = Math.max(0, e.flash - dt * 7); mat.userData.u.uFlash.value = e.flash * 0.1;
      if (!e.alive) {
        if (v.dead < 1) { v.dead = Math.min(1, v.dead + dt / 0.7); const k = v.dead; base.scale.set(1 + k * 0.12, 1 - 0.68 * k, 1 + k * 0.12); base.rotation.z = k * 0.06; mat.color.setScalar(1 - 0.72 * k); live.visible = false; glow.visible = false; }
        return;
      }
      spin(live, t, e);
      glow.material.uniforms.uAlpha.value = 0.34 + 0.1 * Math.sin(t * 2 + x);
    };
    return v;
  }
  const glowMat = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] * k, c[1] * k, c[2] * k), fog: false });
  const mergeGeo = list => mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g)), false);
  const vcMatBrass = () => new THREE.MeshStandardMaterial({ color: 0x8a6f2e, roughness: 0.32, metalness: 0.9 });

  // an eight-sided pagoda roof with a concave sweep, flat-shaded so each slope reads as its own face
  const roofGeo = (w, h) => { const g = new THREE.LatheGeometry([[w, 0], [w * 0.74, h * 0.16], [w * 0.46, h * 0.42], [w * 0.24, h * 0.74], [0.02, h]].map(q => new THREE.Vector2(q[0], q[1])), 8).toNonIndexed(); g.computeVertexNormals(); return g; };
  const palette = t => (t === FROST
    ? { stone: '#6d7480', stone2: '#454b57', wall: '#a9a394', wood: '#4a2d20', roof: '#2c3d54', trim: '#9c7a35' }
    : { stone: '#3d3230', stone2: '#231b1a', wall: '#3a2420', wood: '#170e0d', roof: '#2b0f12', trim: '#cfc6b4' });

  // 灵塔：八角三层楼阁，飞檐挂灯，塔顶悬一颗灵珠
  M.tower = (team, x, z) => {
    const tc = TEAM_COL[team], c = palette(team), L = [], lamps = [];
    kind(K.stone); part(L, G.cyl(2.7, 3.1, 0.5, 8), c.stone2, 0, 0.25, 0); part(L, G.cyl(2.3, 2.6, 0.5, 8), c.stone, 0, 0.75, 0);
    const tiers = [[1.0, 2.5, 1.55, 2.55], [3.9, 1.9, 1.2, 2.05], [6.35, 1.4, 0.9, 1.6]];   // y, height, body radius, roof radius
    tiers.forEach(([y, h, r, rr], k) => {
      kind(K.stone); part(L, G.cyl(r, r * 1.05, h, 8), c.wall, 0, y + h / 2, 0);
      kind(K.wood); for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8; part(L, G.cyl(0.09, 0.1, h, 6), c.wood, Math.cos(a) * r * 1.02, y + h / 2, Math.sin(a) * r * 1.02); }
      part(L, G.cyl(r * 1.12, r * 1.12, 0.16, 8), c.wood, 0, y + h - 0.02, 0);
      for (let i = 0; i < 4; i++) { const a = i * PI / 2; part(L, G.box(0.5, h * 0.52, 0.06), k === 0 && i % 2 === 0 ? tc.dark : c.wood, Math.cos(a) * r * 0.99, y + h * 0.42, Math.sin(a) * r * 0.99, 0, -a + PI / 2, 0); }
      kind(K.stone); part(L, roofGeo(rr, k === 2 ? 1.5 : 0.75), c.roof, 0, y + h + 0.06, 0, 0, PI / 8, 0);
      kind(K.wood); for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8, cx = Math.cos(a), sz = Math.sin(a); part(L, G.cone(0.1, 0.55, 5), c.trim, cx * rr * 1.02, y + h + 0.2, sz * rr * 1.02, sz * 0.9, 0, -cx * 0.9); lamps.push([cx * rr * 0.93, y + h - 0.28, sz * rr * 0.93, k]); }
    });
    kind(K.metal); part(L, G.cyl(0.05, 0.12, 1.1, 6), c.trim, 0, 9.75, 0); for (let i = 0; i < 3; i++) part(L, G.sph(0.17 - i * 0.04, 8, 6), c.trim, 0, 9.5 + i * 0.3, 0);
    kind(K.cloth); part(L, G.box(0.9, 1.5, 0.05), tc.main, 0, 2.45, 1.62, -0.03); part(L, G.box(0.9, 1.5, 0.05), tc.main, 0, 2.45, -1.62, 0.03);
    kind(K.paint);
    const lg = []; for (const [lx, ly, lz, k] of lamps) if ((k + lamps.indexOf(lamps.find(q => q[0] === lx && q[1] === ly && q[2] === lz))) % 2 === 0) { const g = new THREE.BoxGeometry(0.2, 0.3, 0.2); g.translate(lx, ly, lz); lg.push(g); }
    const lanterns = new THREE.Mesh(mergeGeo(lg), glowMat(tc.glow, 2.0));
    const orb = new THREE.Mesh(G.sph(0.72, 20, 14), crystalMat(tc.glow, team === FROST ? 2.0 : 1.1, false)); orb.position.y = 11.1;
    const ring = new THREE.Mesh(G.tor(1.25, 0.045, 6, 36), glowMat(tc.glow, 1.3)), ring2 = new THREE.Mesh(G.tor(1.0, 0.03, 6, 30), glowMat(tc.glow, 1.0)); ring.position.y = ring2.position.y = 11.1;
    const v = structure(team, x, z, L, [orb, ring, ring2, lanterns], 15, (live, t) => {
      orb.position.y = 11.1 + Math.sin(t * 1.7 + x) * 0.22; ring.position.y = ring2.position.y = orb.position.y;
      ring.rotation.set(PI / 2 + Math.sin(t * 0.9) * 0.5, t * 0.8, 0); ring2.rotation.set(Math.cos(t * 0.7) * 0.6, 0, t * 1.1);
    });
    v.muzzleY = 11.1; return v;
  };

  // 阵眼：青云一方是石坛上的青铜鼎与悬空命盘；血魂一方是骨刺环绕的血池骨碗
  M.core = (team, x, z) => {
    const tc = TEAM_COL[team], c = palette(team), L = [], frost = team === FROST, glows = [];
    kind(K.stone); part(L, G.cyl(6.7, 7.1, 0.4, 24), c.stone2, 0, 0.2, 0); part(L, G.cyl(5.9, 6.3, 0.4, 24), c.stone, 0, 0.6, 0); part(L, G.cyl(4.6, 5.2, 0.5, 24), c.stone, 0, 1.05, 0);
    for (let i = 0; i < 8; i++) {
      const a = i * PI / 4, cx = Math.cos(a) * 5.5, cz = Math.sin(a) * 5.5;
      if (frost) { kind(K.stone); part(L, G.box(0.9, 2.6, 0.34), c.stone, cx, 2.1, cz, 0, -a + PI / 2, 0); part(L, G.box(1.05, 0.26, 0.44), c.stone2, cx, 3.5, cz, 0, -a + PI / 2, 0); const g = new THREE.BoxGeometry(0.5, 0.12, 0.06); for (let k = 0; k < 3; k++) { const q = g.clone(); if (k === 1 && i % 2) q.scale(0.4, 1, 1); q.rotateY(-a + PI / 2); q.translate(Math.cos(a) * 5.3, 1.8 + k * 0.42, Math.sin(a) * 5.3); glows.push(q); } }   // eight steles, each carved with a trigram
      else { kind(K.paint); part(L, G.cone(0.42, 3.6, 7), c.trim, cx, 2.5, cz, Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); kind(K.stone); part(L, G.cyl(0.6, 0.75, 0.6, 8), c.stone2, cx, 1.1, cz); }                                                              // eight tusks of bone leaning inward
    }
    if (frost) {   // the bronze 鼎: three legs, round belly, two ears
      kind(K.metal); const bz = '#6b5a32';
      part(L, new THREE.LatheGeometry([[0.5, 0], [1.5, 0.2], [1.85, 0.9], [1.8, 1.6], [1.95, 1.75], [1.95, 1.95], [1.7, 1.95]].map(q => new THREE.Vector2(q[0], q[1])), 20), bz, 0, 2.4, 0);
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; part(L, G.cyl(0.26, 0.2, 1.3, 8), bz, Math.cos(a) * 1.25, 1.95, Math.sin(a) * 1.25); }
      for (const sd of [1, -1]) part(L, G.tor(0.42, 0.11, 6, 14, PI), bz, sd * 1.75, 4.35, 0, 0, PI / 2, 0);
      part(L, G.cyl(1.95, 1.95, 0.14, 20), BRASS, 0, 3.55, 0);
    } else {       // the bone bowl of the old blood altar
      kind(K.paint); part(L, new THREE.LatheGeometry([[0.4, 0], [1.0, 0.25], [1.9, 0.9], [2.3, 1.6], [2.15, 1.7]].map(q => new THREE.Vector2(q[0], q[1])), 20), c.trim, 0, 1.3, 0);
      kind(K.stone); part(L, G.cyl(1.0, 1.5, 0.5, 10), c.stone2, 0, 1.5, 0);
    }
    kind(K.paint);
    const live = [];
    if (frost) {
      const disc = new THREE.Mesh(G.cyl(1.5, 1.5, 0.16, 28), vcMatBrass()); const eye = new THREE.Mesh(G.cyl(0.5, 0.5, 0.2, 20), glowMat(tc.glow, 2.6)); disc.add(eye);
      const marks = new THREE.Mesh(mergeGeo(Array.from({ length: 8 }, (_, i) => { const g = new THREE.BoxGeometry(0.36, 0.2, 0.09); g.translate(1.15, 0, 0); g.rotateY(i * PI / 4); return g; })), glowMat(tc.glow, 1.8)); disc.add(marks);
      const fire = new THREE.Mesh(G.sph(1.3, 16, 10), crystalMat(tc.glow, 1.5, false)); fire.scale.set(1, 0.45, 1); fire.position.y = 4.35;
      live.push(disc, fire, new THREE.Mesh(mergeGeo(glows), glowMat(tc.glow, 1.8))); live.disc = disc;
    } else {
      const orb = new THREE.Mesh(G.sph(1.35, 22, 16), crystalMat([1.0, 0.12, 0.05], 0.9, false)); const pool = new THREE.Mesh(G.cyl(2.0, 2.0, 0.1, 24), glowMat([0.6, 0.03, 0.03], 1.0)); pool.position.y = 2.95;
      live.push(orb, pool); live.disc = orb;
    }
    const rk = frost ? 1 : 0.6, r1 = new THREE.Mesh(G.tor(3.3, 0.07, 6, 48), glowMat(tc.glow, 1.3 * rk)), r2 = new THREE.Mesh(G.tor(4.1, 0.05, 6, 56), glowMat(tc.glow, 1.1 * rk)); live.push(r1, r2);
    const d = live.disc, v = structure(team, x, z, L, live, 30, (lv, t) => {
      d.position.y = 7.4 + Math.sin(t * 1.3) * 0.3; d.rotation.y = t * 0.5; r1.position.y = r2.position.y = d.position.y;
      r1.rotation.set(PI / 2 + Math.sin(t * 0.7) * 0.5, t * 0.5, 0); r2.rotation.set(PI / 2 + Math.cos(t * 0.6) * 0.6, 0, t * 0.4);
    });
    v.muzzleY = 7.4; return v;
  };

  M.fountain = (team, x, z) => {
    const tc = TEAM_COL[team], [s1, s2] = stonePal(team), L = [];
    kind(K.stone); part(L, G.cyl(4.6, 5.0, 0.3, 24), s2, 0, 0.15, 0); part(L, G.tor(4.2, 0.24, 8, 36), s1, 0, 0.36, 0, PI / 2); kind(K.paint);
    const m = mesh(L, vcMat({ world: true }), x, 0, z); m.receiveShadow = true; M.root.add(m);
    const g = fx.decalMesh(0, 17, tc.glow, 0.4); g.position.set(x, 0.4, z); M.root.add(g);
    const r = fx.decalMesh(3, 8.2, tc.glow, 0.8); r.position.set(x, 0.42, z); M.root.add(r);
  };
  return M;
}
