// world.js — the arena. Still no asset files: a procedural ground shader (frost → meadow → ember, cobbled lane, river, puddles),
// a procedural dusk sky baked into image-based lighting, trees made of bark trunks + alpha-tested leaf cards whose textures
// are painted on a canvas at load, displaced boulders, undergrowth, grass, drifting motes.
import { DMath as Math } from './dmath.js';                  // same numbers on every machine (online play)
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAP, LANES, RIVER, TOWERS, CAMPS, POS, FROST, EMBER, BRUSH, brushAt, biomeX, biomeGLSL, MODE, RIDGES } from './config.js';
import { rng, vnoise, smooth } from './util.js';
import { vcMat, part, build, G, K, kind, uTime, tNoise, COMMON_GLSL } from './mat.js';

const F = v => { const t = Number(v).toFixed(6); return t.includes('.') ? t : t + '.0'; };
// Where the lanes and the river are. 一路 has them as formulas, written straight into the shader. 三路's are free-form paths,
// so they are baked once into a texture: distance to the nearest lane, how far along it, distance to the river, and which
// side of the lane (the last two give the cobbles their rows).
const analytic = () => LANES.length === 1 && LANES[0].func;
const fieldGLSL = () => (analytic()
  ? `float lz = ${LANES[0].glsl}; float dl = abs(p.y - lz); vec2 laneQ = vec2(p.x, p.y - lz); float riverD = abs(p.x - (${RIVER.glsl}));`
  : 'vec4 LN = texture2D(tLane, (p - uLaneBox.xy) / uLaneBox.zw); float dl = LN.r; vec2 laneQ = vec2(LN.g, LN.a); float riverD = LN.b;');
const P2 = (v) => `vec2(${F(v.x)}, ${F(v.z)})`;
const groundPars = () => `
  uniform sampler2D tNoise; uniform float uTime; uniform vec3 uCamps[${CAMPS.length}]; uniform vec3 uBrush[${BRUSH.length}]; uniform sampler2D tLane; uniform vec4 uLaneBox;
  varying vec3 vWPos;
  vec3 gAlb; vec3 gEmis; float gRough; float gH; float gMetal = 0.0;
  float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  ${COMMON_GLSL}
  void groundEval(vec2 p){
    vec4 nA = texture2D(tNoise, p * 0.011);
    vec4 nB = texture2D(tNoise, p * 0.047 + 0.37);
    vec4 nC = texture2D(tNoise, p * 0.19 + 0.11);
    vec4 nD = texture2D(tNoise, p * 0.71 + 0.53);
    float macro = nA.r, mid = nB.r, fine = nC.g, grit = nD.g;
    float pulse = 0.65 + 0.35 * sin(uTime * 1.4 + macro * 22.0);

    float bx = ${biomeGLSL('p', 'y')} + (macro - 0.5) * 30.0 + (mid - 0.5) * 8.0;
    float fr = 1.0 - smoothstep(-52.0, -16.0, bx);
    float em = smoothstep(16.0, 52.0, bx);

    ${fieldGLSL()}
    float laneM = 1.0 - smoothstep(4.7, 6.3, dl + (mid - 0.5) * 2.6);
    float dPl = min(length(p - ${P2(POS.core(FROST))}), length(p - ${P2(POS.core(EMBER))}));
    float dFo = min(length(p - ${P2(POS.fountain(FROST))}), length(p - ${P2(POS.fountain(EMBER))}));
    float plaza = 1.0 - smoothstep(13.5, 15.5, min(dPl, dFo + 4.0) + (mid - 0.5) * 2.0);
    float paved = max(laneM, plaza);
    float worn = 1.0 - smoothstep(5.5, 10.0, dl + (mid - 0.5) * 5.0);
    float camp = 0.0;
    for (int i = 0; i < ${CAMPS.length}; i++) camp = max(camp, 1.0 - smoothstep(uCamps[i].z * 0.55, uCamps[i].z, length(p - uCamps[i].xy) + (mid - 0.5) * 3.0));
    float shore = riverD + (mid - 0.5) * 1.8;
    float water = (1.0 - smoothstep(3.5, 4.5, shore)) * (1.0 - 0.8 * laneM);
    float wet = 1.0 - smoothstep(4.2, 7.5, shore);

    // --- soil and ground cover: forest floor, frozen ground, scorched earth ---
    vec3 soil = mix(vec3(0.05, 0.037, 0.024), vec3(0.105, 0.08, 0.052), fine) * (0.75 + 0.5 * grit);
    vec3 grass = mix(vec3(0.022, 0.045, 0.014), vec3(0.06, 0.095, 0.026), mid);
    grass = mix(grass, vec3(0.1, 0.1, 0.036), smoothstep(0.5, 0.85, nB.g) * 0.6);           // dry patches
    grass *= 0.65 + 0.7 * fine;
    grass = mix(grass, soil, smoothstep(0.62, 0.8, nC.r) * 0.75);                              // bare earth
    grass = mix(grass, vec3(0.16, 0.085, 0.02), step(0.93, nD.a) * smoothstep(0.4, 0.7, nB.b) * 0.7); // fallen leaves
    vec3 snow = mix(vec3(0.2, 0.26, 0.36), vec3(0.4, 0.45, 0.53), smoothstep(0.25, 0.7, mid));
    snow *= 0.9 + 0.2 * grit;
    snow = mix(snow, soil * vec3(0.8, 0.95, 1.2), smoothstep(0.58, 0.74, nB.g) * 0.85);       // frozen mud showing through
    vec3 ash = mix(vec3(0.035, 0.026, 0.022), vec3(0.1, 0.078, 0.064), mid) * (0.65 + 0.7 * fine);
    ash = mix(ash, vec3(0.15, 0.145, 0.14), smoothstep(0.62, 0.85, nB.g) * 0.45);
    float crack = (1.0 - smoothstep(0.0, 0.03, abs(nB.b - 0.5))) * smoothstep(0.3, 0.55, nA.g) * smoothstep(0.55, 0.95, em);
    ash = mix(ash, vec3(0.01), crack * 0.75);

    vec3 land = mix(grass, snow, fr);
    land = mix(land, ash, em);
    vec3 dirt = soil * mix(vec3(1.0), vec3(1.5, 1.9, 2.4), fr * 0.6) * mix(1.0, 0.6, em);
    land = mix(land, dirt, max(worn * 0.8, camp));
    float brIn = 0.0, brRim = 0.0;
    for (int i = 0; i < ${BRUSH.length}; i++) { float bd = distance(p, uBrush[i].xy) - uBrush[i].z + (nB.r - 0.5) * 0.9; brIn = max(brIn, 1.0 - smoothstep(-0.5, 0.4, bd)); brRim = max(brRim, 1.0 - smoothstep(0.0, 0.42, abs(bd + 0.05))); }
    land = mix(land, land * vec3(0.3, 0.42, 0.3), brIn * 0.85); land = mix(land, vec3(0.006, 0.012, 0.005), brRim * 0.7);
    float landH = mid * 0.5 + fine * 0.2 + grit * 0.07 - crack * 0.14;
    float rough = mix(0.96, 0.6, fr * (1.0 - smoothstep(0.58, 0.74, nB.g)));
    vec3 emis = vec3(2.6, 0.55, 0.06) * crack * pulse * (1.0 - paved);

    // --- cobbles: uneven rows that follow the lane, every stone tilted and worn differently ---
    vec2 q = laneQ;
    float bh = 1.3, row = floor(q.y / bh);
    float bw = 1.9 + 0.9 * hash21(vec2(row, 3.7));
    float qx = q.x / bw + hash21(vec2(row, 9.1));
    vec2 id = vec2(floor(qx), row), f = vec2(fract(qx), fract(q.y / bh));
    float edge = min(min(f.x, 1.0 - f.x) * bw, min(f.y, 1.0 - f.y) * bh) + (fine - 0.5) * 0.1;
    float grout = 1.0 - smoothstep(0.03, 0.15, edge);
    float rnd = hash21(id), rnd2 = hash21(id + 4.3);
    vec3 stone = mix(vec3(0.085, 0.08, 0.075), vec3(0.2, 0.185, 0.165), rnd) * (0.6 + 0.8 * fine) * (0.85 + 0.3 * grit);
    stone = mix(stone, stone * vec3(0.62, 0.52, 0.42), smoothstep(0.55, 0.85, nB.g) * 0.7);   // stains
    stone = mix(stone, stone * vec3(0.85, 1.0, 1.25) + 0.012, fr);
    stone = mix(stone, stone * vec3(0.5, 0.42, 0.4), em);
    float chip = (1.0 - smoothstep(0.0, 0.035, abs(nC.b - 0.5))) * step(0.72, rnd2);            // cracked stones
    stone *= 1.0 - 0.6 * chip;
    vec3 groutC = mix(mix(soil * 0.5, vec3(0.045, 0.07, 0.022), smoothstep(0.35, 0.6, nB.r) * (1.0 - em)), vec3(0.34, 0.39, 0.47), fr * 0.9);
    stone = mix(stone, groutC, grout);
    stone = mix(stone, vec3(0.34, 0.39, 0.47), fr * smoothstep(0.66, 0.8, nB.g) * 0.7);        // snow drifts on the paving
    vec3 stoneE = vec3(2.2, 0.4, 0.04) * grout * em * pulse * 0.42 * smoothstep(0.42, 0.7, nA.g * 0.6 + nB.r * 0.4);
    float stoneH = smoothstep(0.0, 0.24, edge) * 0.1 + rnd * 0.03 + fine * 0.025 - chip * 0.04
                 + ((f.x - 0.5) * (rnd - 0.5) + (f.y - 0.5) * (rnd2 - 0.5)) * 0.14;

    vec3 alb = mix(land, stone, paved);
    emis = mix(emis, stoneE, paved);
    float h = mix(landH, stoneH + 0.3, paved);
    rough = mix(rough, 0.62 + 0.25 * rnd, paved);

    // --- sect grounds: inside each precinct the floor is dressed flagstone in the sect's own stone, inlaid with its ward —
    //     two rings and eight spokes that glow faintly — and edged with a dark kerb. Neither road nor wilderness. ---
    float baseD = min(dPl, dFo + ${F(MAP.baseF)});
    float sect = 1.0 - smoothstep(${F(MAP.base - 0.5)}, ${F(MAP.base + 0.5)}, baseD + (mid - 0.5) * 0.7);
    if (sect > 0.001) {
      float own = step(length(p - ${P2(POS.core(FROST))}), length(p - ${P2(POS.core(EMBER))}));          // 1 on frost's side
      vec2 bp = p - mix(${P2(POS.core(EMBER))}, ${P2(POS.core(FROST))}, own);
      float rr = length(bp), ang = atan(bp.y, bp.x);
      vec2 sp = vec2(bp.x * ${F(MAP.ax)} + bp.y * ${F(MAP.az)}, bp.y * ${F(MAP.ax)} - bp.x * ${F(MAP.az)}) / 3.3, sf = fract(sp);
      float slab = hash21(floor(sp)), joint = 1.0 - smoothstep(0.015, 0.05, min(min(sf.x, 1.0 - sf.x), min(sf.y, 1.0 - sf.y)));
      vec3 sc = mix(mix(vec3(0.075, 0.05, 0.046), vec3(0.125, 0.078, 0.064), slab), mix(vec3(0.27, 0.31, 0.37), vec3(0.37, 0.41, 0.47), slab), own) * (0.78 + 0.4 * fine);
      sc = mix(sc, sc * 0.3, joint);
      float ringW = max(1.0 - smoothstep(0.0, 0.24, abs(rr - 8.6)), 1.0 - smoothstep(0.0, 0.32, abs(rr - ${F(MAP.base - 2.4)})));
      float spoke = (1.0 - smoothstep(0.0, 0.2, abs(fract(ang * 1.2732395 + 0.5) - 0.5) * rr * 0.7853982)) * step(8.6, rr) * step(rr, ${F(MAP.base - 2.4)});
      float ward = max(ringW, spoke) * (1.0 - smoothstep(${F(MAP.base - 1.5)}, ${F(MAP.base)}, dPl));
      vec3 glowC = mix(vec3(2.4, 0.5, 0.08), vec3(0.35, 1.1, 2.2), own);
      alb = mix(alb, mix(sc, glowC * 0.1, ward), sect);
      emis = mix(emis, glowC * ward * (0.28 + 0.16 * pulse), sect);
      h = mix(h, 0.55 + slab * 0.07 - joint * 0.28 - ward * 0.1, sect); rough = mix(rough, 0.48 + 0.2 * slab, sect);
      alb = mix(alb, vec3(0.022, 0.02, 0.02), (1.0 - smoothstep(0.0, 0.55, abs(baseD - ${F(MAP.base)}))) * 0.85);       // the kerb
      if (own < 0.5) {
        // 血魂宗. No clean ward here: an eight-pointed blood array scored into black stone, blood welling in the seams and
        // standing in pools, the whole floor breathing.
        float Rw = ${F(MAP.base - 2.4)}, star = 1e9;
        for (int k = 0; k < 8; k++) { float a0 = float(k) * 0.7853982, a1 = float(k + 3) * 0.7853982; vec2 A = vec2(cos(a0), sin(a0)) * Rw, B = vec2(cos(a1), sin(a1)) * Rw, ab = B - A; star = min(star, length(bp - A - ab * clamp(dot(bp - A, ab) / dot(ab, ab), 0.0, 1.0))); }
        float arr = max(1.0 - smoothstep(0.0, 0.24, star), 1.0 - smoothstep(0.0, 0.34, abs(rr - Rw))) * (1.0 - smoothstep(${F(MAP.base - 1.5)}, ${F(MAP.base)}, dPl));
        float beat = 0.55 + 0.45 * sin(uTime * 2.1 + rr * 0.35);
        float pool = smoothstep(0.6, 0.68, nB.g * 0.55 + nA.b * 0.45) * sect * (1.0 - arr);
        vec3 stoneB = mix(vec3(0.03, 0.022, 0.024), vec3(0.058, 0.036, 0.036), slab) * (0.75 + 0.45 * fine);
        vec3 e = stoneB; e = mix(e, vec3(0.16, 0.006, 0.008), joint * 0.9); e = mix(e, vec3(0.2, 0.01, 0.012), arr); e = mix(e, vec3(0.07, 0.003, 0.005), pool);
        alb = mix(alb, e, sect * step(${F(MAP.base)}, 1e4));
        emis = mix(emis, vec3(2.3, 0.1, 0.07) * (arr * (0.35 + 0.3 * beat) + joint * (0.1 + 0.16 * beat) * (0.4 + 0.6 * nC.r)) + vec3(0.3, 0.008, 0.008) * pool * beat, sect);
        rough = mix(rough, mix(0.55 + 0.2 * slab, 0.07, pool), sect); h = mix(h, 0.5 + slab * 0.09 - joint * 0.3 - pool * 0.35, sect);
      }
    }

    // --- standing water: rain puddles on the lane (ice on the frost side) ---
    float pud = smoothstep(0.6, 0.66, nB.r * 0.55 + nA.g * 0.45 + (1.0 - smoothstep(0.0, 0.25, edge)) * 0.05) * paved * (1.0 - em);
    alb = mix(alb, mix(alb * 0.45, vec3(0.16, 0.2, 0.25), fr * 0.7), pud);
    rough = mix(rough, mix(0.05, 0.16, fr), pud);
    h = mix(h, 0.36, pud * 0.96);

    // --- river ---
    float w1 = texture2D(tNoise, p * 0.05 + vec2(0.0, uTime * 0.016)).r;
    float w2 = texture2D(tNoise, p * 0.11 - vec2(uTime * 0.012, uTime * 0.027)).g;
    float w3 = texture2D(tNoise, p * 0.33 + vec2(uTime * 0.02, -uTime * 0.045)).g;
    alb *= mix(1.0, 0.5, wet * (1.0 - fr * 0.5));
    rough = mix(rough, 0.3, wet * 0.8);
    float depth = smoothstep(4.2, 1.0, shore);
    float caust = pow(clamp(w1 * w2 * 2.6, 0.0, 1.0), 3.0) + pow(w3, 4.0) * 0.5;
    vec3 bed = (soil * vec3(0.9, 1.25, 1.1) + vec3(0.03, 0.07, 0.06) * caust) * (0.7 + 0.6 * fine);   // pebbly bed with moving caustics
    vec3 wcol = mix(bed, vec3(0.006, 0.045, 0.05), 0.3 + 0.62 * depth);                         // deeper water hides it
    wcol = mix(wcol, vec3(0.07, 0.11, 0.14), fr * 0.5);
    float foam = smoothstep(0.4, 0.85, water * (1.0 - water) * 4.0 * (0.4 + w2)) * 0.6;
    alb = mix(alb, wcol, water);
    alb = mix(alb, vec3(0.3, 0.36, 0.38), foam * water);
    emis *= 1.0 - water;
    rough = mix(rough, 0.05, water * (1.0 - foam));
    gMetal = water * (1.0 - foam) * 0.6;
    alb = mix(alb, alb * 0.5 + vec3(0.3, 0.42, 0.48), gMetal);
    h = mix(h, (w1 + w2) * 0.11 + w3 * 0.035, water);

    float ob = smoothstep(0.0, 9.0, max(abs(p.x) - ${F(MAP.hx + 1)}, abs(p.y) - ${F(MAP.hz + 1)}));       // beyond the edge of the map
    alb = mix(alb, vec3(0.008, 0.011, 0.016), ob); emis *= 1.0 - ob;

    gAlb = alb; gEmis = emis; gRough = rough; gH = h;
  }`;

export function terrain(x, z) {
  let dl = 1e9; for (const L of LANES) dl = Math.min(dl, L.dist(x, z));
  const dr = RIVER.dist(x, z), d2 = q => Math.hypot(x - q.x, z - q.z);
  const dPl = Math.min(d2(POS.core(FROST)), d2(POS.core(EMBER))), dFo = Math.min(d2(POS.fountain(FROST)), d2(POS.fountain(EMBER)));
  let camp = 99; for (const c of CAMPS) camp = Math.min(camp, Math.hypot(x - c.x, z - c.z) - c.r);
  const bx = biomeX(x, z) + (vnoise(x * 0.04, z * 0.04) - 0.5) * 30;
  return { dl, dr, dPl: Math.min(dPl, dFo + MAP.baseF), camp, fr: 1 - smooth(-52, -16, bx), em: smooth(16, 52, bx), inside: Math.abs(x) < MAP.hx && Math.abs(z) < MAP.hz };
}

// ---- leaf textures, painted once on a canvas ----
function leafTexture(type, rand) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const leaf = (x, y, s, a, fill, rib) => {
    g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.62, -s * 0.15, 0, s); g.quadraticCurveTo(-s * 0.62, -s * 0.15, 0, -s);
    g.fillStyle = fill; g.fill(); g.strokeStyle = rib; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(0, s * 0.85); g.stroke(); g.restore();
  };
  if (type === 'pine') {
    const twig = (x0, y0, x1, y1, w, n, len) => {
      g.strokeStyle = '#2a1c12'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      for (let i = 0; i < n; i++) {
        const t = i / n, px = x0 + dx * t, py = y0 + dy * t, l = len * (1 - t * 0.6) * (0.7 + rand() * 0.5);
        for (const s of [-1, 1]) {
          const a = 0.95 + rand() * 0.35, nx = ux * Math.cos(a) - uy * Math.sin(a) * s, ny = uy * Math.cos(a) + ux * Math.sin(a) * s;
          g.strokeStyle = `hsl(${150 + rand() * 25},${22 + rand() * 18}%,${9 + rand() * 13}%)`; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + nx * l, py + ny * l); g.stroke();
        }
      }
    };
    twig(128, 256, 128, 14, 5, 60, 26);
    for (let i = 0; i < 7; i++) { const y = 228 - i * 30, l = 92 - i * 10; for (const s of [-1, 1]) twig(128, y, 128 + s * l * 0.8, y - l * 0.62, 3, 26, 17); }
  } else {
    const ember = type === 'ember', n = ember ? 90 : 260;
    if (ember) { g.strokeStyle = '#140d0a'; g.lineWidth = 3; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + (rand() - 0.5) * 210, 128 + (rand() - 0.5) * 210); g.stroke(); } }
    for (let i = 0; i < n; i++) {
      const a = rand() * 6.283, r = Math.pow(rand(), 0.62) * 108, s = 13 + rand() * 11, li = 0.55 + 0.45 * (i / n);
      const fill = ember ? `hsl(${10 + rand() * 28},${55 + rand() * 25}%,${(14 + rand() * 16) * li}%)` : `hsl(${80 + rand() * 40},${26 + rand() * 24}%,${(11 + rand() * 15) * li}%)`;
      leaf(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, s, rand() * 6.283, fill, ember ? 'rgba(255,190,120,.25)' : 'rgba(190,220,140,.2)');
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function leafMat(map, a2c) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.2, alphaToCoverage: a2c, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72, metalness: 0 });
  const u = { uTime, tNoise };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float wph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
        transformed.x += (sin(uTime * 1.3 + wph) * 0.6 + sin(uTime * 2.7 + wph * 1.7) * 0.4) * position.y * 0.03 + sin(uTime * 3.4 + position.z * 2.3 + wph) * 0.05;
        transformed.z += cos(uTime * 1.1 + wph) * position.y * 0.015 + cos(uTime * 2.9 + position.x * 2.1 + wph) * 0.05;`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tNoise; uniform float uTime; varying vec3 vWP;\n' + COMMON_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 lwn = inverseTransformDirection(normalize(vNormal), viewMatrix);
        float lfr = 1.0 - smoothstep(-52.0, -16.0, ${biomeGLSL('vWP')});
        float lsnow = lfr * smoothstep(0.3, 0.75, lwn.y) * smoothstep(0.25, 0.6, texture2D(tNoise, vWP.xz * 0.45).g);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.48, 0.56), lsnow * 0.9);`)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')   // same lighting on both faces of a leaf card
      .replace('#include <opaque_fragment>', 'outgoingLight = outgoingLight * cloudShade(vWP.xz) + diffuseColor.rgb * vec3(0.16, 0.2, 0.26);\n#include <opaque_fragment>');   // a little sky light always filters through foliage
  };
  m.customProgramCacheKey = () => 'leaf' + MODE.id;
  return m;
}
// a textured card: centre, size, facing normal (nx,ny,nz), roll; shading normal bends away from the canopy centre
function card(list, cx, cy, cz, w, h, nx, ny, nz, roll, ox, oy, oz, shade = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx, ny, nz).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  g.applyQuaternion(q); g.translate(cx, cy, cz);
  const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i) - ox, p.getY(i) - oy, p.getZ(i) - oz).normalize().add(new THREE.Vector3(0, 0.75, 0)).normalize();
    n.setXYZ(i, v.x, v.y, v.z); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  list.push(g.toNonIndexed());
}

export function createWorld(R) {
  const { scene, renderer } = R;
  const W = { obstacles: [], walls: [] }, owned = [], add = (...o) => { for (const q of o) { scene.add(q); owned.push(q); } };
  const AREA = (MAP.hx * MAP.hz) / (80 * 48);                            // scatter counts scale with the size of the map
  const rand = rng(20261111);

  // ---- sun + sky. The sky is never seen directly: it is baked into image-based lighting so metal, water and wet stone reflect it ----
  const sunOff = new THREE.Vector3(-46, 27, 13), sunDir = sunOff.clone().normalize();
  const sky = new THREE.Scene();
  sky.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { uSun: { value: sunDir }, tNoise },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uSun; uniform sampler2D tNoise; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD); float h = d.y;
        float az = max(dot(normalize(d.xz), normalize(uSun.xz)), 0.0);
        vec3 hor = mix(vec3(0.3, 0.26, 0.32), vec3(1.9, 0.8, 0.28), pow(az, 2.5));
        vec3 c = mix(hor, vec3(0.1, 0.17, 0.36), pow(clamp(h, 0.0, 1.0), 0.42));
        c += vec3(3.0, 1.3, 0.45) * pow(max(dot(d, uSun), 0.0), 9.0);
        vec2 cuv = d.xz / (max(h, 0.0) + 0.25) * 0.09;
        float cl = smoothstep(0.42, 0.75, texture2D(tNoise, cuv).r * 0.7 + texture2D(tNoise, cuv * 3.1).g * 0.3) * smoothstep(0.0, 0.25, h);
        c = mix(c, mix(vec3(0.07, 0.075, 0.11), vec3(1.5, 0.62, 0.3), pow(az, 2.0) * 0.7), cl * 0.8);
        c = mix(vec3(0.03, 0.028, 0.024), c, smoothstep(-0.12, 0.02, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(sky, 0, 0.1, 200).texture; scene.environmentIntensity = 0.85; pm.dispose();

  const hemi = new THREE.HemisphereLight(0x7f9cff, 0x2a2018, 0.2);
  add(hemi);
  const sun = new THREE.DirectionalLight(0xffb878, 3.6);
  sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -52; sc.right = 52; sc.top = 52; sc.bottom = -52; sc.near = 1; sc.far = 190;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
  sun.shadow.mapSize.set(R.quality.shadow, R.quality.shadow);
  add(sun, sun.target);
  W.sun = sun; W.sunDir = sunDir;
  // The shadow box follows the camera. It must move in whole shadow-map texels measured along the light's own axes, or every
  // shadow edge in view jumps by a fraction of a texel as the camera moves — the flicker seen when walking.
  const lsX = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize(), lsY = new THREE.Vector3().crossVectors(sunDir, lsX).normalize(), lsP = new THREE.Vector3();
  W.focusLight = (x, z) => {
    const texel = (sc.right - sc.left) / sun.shadow.mapSize.x; lsP.set(x, 0, z);
    const a = Math.round(lsP.dot(lsX) / texel) * texel, b = Math.round(lsP.dot(lsY) / texel) * texel, c = lsP.dot(sunDir);
    lsP.copy(lsX).multiplyScalar(a).addScaledVector(lsY, b).addScaledVector(sunDir, c);
    sun.target.position.copy(lsP); sun.position.copy(lsP).addScaledVector(sunOff, 1.6);
  };
  W.setShadowSize = s => { if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } };

  // ---- ground ----
  const gmat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  let tLane = null, laneBox = new THREE.Vector4(0, 0, 1, 1);
  if (!analytic()) {
    const N = 384, pad = 30, x0 = -MAP.hx - pad, z0 = -MAP.hz - pad, w = (MAP.hx + pad) * 2, h = (MAP.hz + pad) * 2, data = new Uint16Array(N * N * 4), H = THREE.DataUtils.toHalfFloat;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + (i + 0.5) / N * w, z = z0 + (j + 0.5) / N * h; let bd = 1e9, bs = 0, bo = 0;
      for (const L of LANES) { const r = L.path.near(x, z); if (r[0] < bd) { bd = r[0]; bs = r[1]; bo = r[2]; } }
      const k = (j * N + i) * 4; data[k] = H(Math.min(bd, 200)); data[k + 1] = H(bs); data[k + 2] = H(Math.min(RIVER.dist(x, z), 200)); data[k + 3] = H(Math.max(-200, Math.min(200, bo)));
    }
    tLane = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType); tLane.magFilter = tLane.minFilter = THREE.LinearFilter; tLane.needsUpdate = true; laneBox.set(x0, z0, w, h);
  }
  const gu = { tNoise, uTime, tLane: { value: tLane }, uLaneBox: { value: laneBox }, uCamps: { value: CAMPS.map(c => new THREE.Vector3(c.x, c.z, c.r)) }, uBrush: { value: BRUSH.map(b => new THREE.Vector3(b.x, b.z, b.r)) } };
  gmat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, gu);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + groundPars())
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\ngroundEval(vWPos.xz);')
      .replace('#include <map_fragment>', 'diffuseColor.rgb = gAlb;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = gMetal;')
      .replace('#include <normal_fragment_maps>', 'normal = bumpNormal(-vViewPosition, normal, vec2(dFdx(gH), dFdy(gH)));')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += gEmis;')
      .replace('#include <opaque_fragment>', 'outgoingLight = min((outgoingLight - totalEmissiveRadiance) * cloudShade(vWPos.xz) + totalEmissiveRadiance, vec3(2.6));\n#include <opaque_fragment>');
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(460, 360).rotateX(-Math.PI / 2), gmat);
  ground.receiveShadow = true; add(ground);

  // ---- scatter helpers ----
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  // Scatter is instanced, and split into square patches of ground so that whatever is off screen (and outside the sun's
  // shadow box) is culled whole instead of being pushed through the vertex shader every frame. With over a million
  // triangles of grass, reeds and leaves on the map, this is most of what the camera does not have to draw.
  const PATCH = 34;
  function instanced(geo, mat, items, cast = true, noAO = false) {
    const buckets = new Map();
    if (items.length < 160) buckets.set(0, items);
    else for (const it of items) { const k = Math.floor(it.x / PATCH) * 1000 + Math.floor(it.z / PATCH); let bk = buckets.get(k); if (!bk) buckets.set(k, bk = []); bk.push(it); }
    let last = null;
    for (const list of buckets.values()) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        dummy.position.set(it.x, it.y || 0, it.z); dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); dummy.scale.set(it.sx ?? it.s, it.sy ?? it.s, it.sz ?? it.s); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix); color.setRGB(it.c[0], it.c[1], it.c[2]); im.setColorAt(i, color);
      });
      im.castShadow = cast; im.receiveShadow = true; im.userData.noAO = noAO;
      im.computeBoundingSphere(); im.boundingSphere.radius += 2.5; im.frustumCulled = true;     // room for the wind
      add(im); last = im;
    }
    return last;
  }
  const structs = [];
  for (const t of [FROST, EMBER]) structs.push({ ...POS.core(t), r: 11 }, { ...POS.fountain(t), r: 9 });
  for (const t of TOWERS) structs.push({ x: t.x, z: t.z, r: 9 });
  const clear = (x, z, m = 0) => {
    const t = terrain(x, z);
    if (t.dl < 9 + m || t.dr < 7.5 + m || t.dPl < Math.max(19, MAP.base + 4) + m || t.camp < 2.5 + m) return null;
    for (const s of structs) if (Math.hypot(x - s.x, z - s.z) < s.r + m) return null;
    return t;
  };

  // ---- trees: bark trunk + branches (one geometry) and a canopy of leaf cards (another), both instanced with the same transforms ----
  const dirOnSphere = () => { const u = rand() * 2 - 1, a = rand() * 6.283, s = Math.sqrt(1 - u * u); return [Math.cos(a) * s, u, Math.sin(a) * s]; };
  function canopy(L, cx, cy, cz, rx, ry, rz, n, size) {
    for (let i = 0; i < n; i++) {
      const d = dirOnSphere(); if (d[1] < -0.35) d[1] = -d[1];
      const k = 0.5 + rand() * 0.5, x = cx + d[0] * rx * k, y = cy + d[1] * ry * k, z = cz + d[2] * rz * k;
      card(L, x, y, z, size * (0.8 + rand() * 0.5), size * (0.8 + rand() * 0.5), d[0] + (rand() - 0.5) * 0.6, d[1] + 0.7, d[2] + (rand() - 0.5) * 0.6, rand() * 6.283, cx, cy - ry * 0.3, cz, 0.55 + 0.45 * k);
    }
  }
  const species = {};
  { // broadleaf
    const T = [], L = []; kind(K.wood);
    part(T, G.cyl(0.2, 0.42, 3.6, 9), '#4a3a2b', 0, 1.8, 0, 0, 0, 0.04);
    part(T, G.cyl(0.09, 0.18, 2.4, 6), '#4a3a2b', 0.75, 3.9, 0.1, 0, 0, -0.7); part(T, G.cyl(0.09, 0.17, 2.2, 6), '#4a3a2b', -0.6, 4.0, 0.45, 0.5, 0, 0.6); part(T, G.cyl(0.08, 0.15, 2.0, 6), '#4a3a2b', -0.1, 4.2, -0.7, -0.7, 0, 0.1);
    canopy(L, 0, 5.4, 0, 2.9, 1.9, 2.9, 46, 3.0); canopy(L, 1.6, 4.5, 0.4, 1.6, 1.1, 1.6, 12, 2.3); canopy(L, -1.4, 4.6, -0.6, 1.6, 1.1, 1.6, 12, 2.3);
    species.leaf = { trunk: build(T), leaves: build(L), tex: 'leaf' };
  }
  { // pine: whorls of drooping needle boughs
    const T = [], L = []; kind(K.wood);
    part(T, G.cyl(0.07, 0.3, 7.6, 8), '#3a2c22', 0, 3.8, 0);
    for (let i = 0; i < 9; i++) {
      const y = 1.5 + i * 0.68, len = 2.7 * (1 - i / 10.5), n = i < 6 ? 6 : 5;
      for (let j = 0; j < n; j++) {
        const a = j / n * 6.283 + i * 0.7 + (rand() - 0.5) * 0.3, droop = 0.2 + rand() * 0.25;
        const g = new THREE.PlaneGeometry(len * 0.95, len); g.translate(0, len / 2, 0); g.rotateX(Math.PI / 2 + droop); g.rotateZ((rand() - 0.5) * 0.3); g.rotateY(-a + Math.PI / 2); g.translate(0, y, 0);
        const p = g.attributes.position, nn = g.attributes.normal, col = new Float32Array(p.count * 3).fill(0.6 + 0.4 * (i / 9));
        for (let v = 0; v < p.count; v++) { const o = new THREE.Vector3(p.getX(v), 0, p.getZ(v)).multiplyScalar(0.35).add(new THREE.Vector3(0, 1, 0)).normalize(); nn.setXYZ(v, o.x, o.y, o.z); }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3)); L.push(g.toNonIndexed());
      }
    }
    species.pine = { trunk: build(T), leaves: build(L), tex: 'pine' };
  }
  { // charred, half-bare ember tree
    const T = [], L = []; kind(K.wood);
    part(T, G.cyl(0.15, 0.4, 3.8, 8), '#1d1512', 0, 1.9, 0, 0, 0, 0.1);
    const br = [[0.8, 3.6, 0, 0, -0.85, 2.6], [-0.7, 3.9, 0.3, 0.4, 0.8, 2.4], [0.1, 4.3, -0.7, -0.8, 0.15, 2.2], [0.2, 4.6, 0.6, 0.7, -0.2, 2.0], [-0.3, 5.0, 0, 0, 0.2, 1.8]];
    for (const b of br) part(T, G.cyl(0.04, 0.14, b[5], 5), '#1d1512', b[0], b[1], b[2], b[3], 0, b[4]);
    canopy(L, 0.2, 5.3, 0, 2.3, 1.5, 2.3, 15, 2.3);
    species.char = { trunk: build(T), leaves: build(L), tex: 'ember' };
  }
  kind(K.paint);
  const lists = { leaf: [], pine: [], char: [] }, placed = [];
  const tryTree = (x, z, border) => {
    const t = border ? terrain(x, z) : clear(x, z, 2.2);   // keep canopies from overhanging the lane
    if (border && MODE.id !== 'single') for (const tm of [FROST, EMBER]) { const f = POS.fountain(tm); if (Math.hypot(x - f.x, z - f.z) < 24) return; }   // in the corner maps, no forest crowding the fountains with evening shadow
    if (!t || (!border && (brushAt(x, z, 3.2) >= 0 || brushAt(x, z - 3.5, 3.4) >= 0))) return;   // nor over the brush, seen from the camera's side
    for (const p of placed) if (Math.abs(p.x - x) < 5 && Math.abs(p.z - z) < 5 && Math.hypot(p.x - x, p.z - z) < 5) return;
    if (!border && vnoise(x * 0.09 + 5, z * 0.09 + 9) < 0.42) return;
    const s = 0.85 + rand() * 0.4, v = 0.75 + rand() * 0.5, k = rand();
    const it = { x, z, s, sy: s * (0.9 + rand() * 0.3), ry: rand() * 6.28, rz: (rand() - 0.5) * 0.07, c: [v, v * (0.9 + rand() * 0.2), v * (0.85 + rand() * 0.2)] };
    lists[t.fr > 0.5 + (k - 0.5) * 0.5 ? 'pine' : t.em > 0.5 + (k - 0.5) * 0.5 ? 'char' : 'leaf'].push(it);
    placed.push(it);
    if (!border) W.obstacles.push({ x, z, r: 0.75 });
  };
  for (let i = 0; i < 2600 * AREA; i++) tryTree((rand() * 2 - 1) * (MAP.hx - 2), (rand() * 2 - 1) * (MAP.hz - 2), false);
  for (let i = 0; i < 1500; i++) {
    const x = (rand() * 2 - 1) * (MAP.hx + 24), z = (rand() * 2 - 1) * (MAP.hz + 22);
    if (Math.abs(x) > MAP.hx + 2.5 || Math.abs(z) > MAP.hz + 2.5) tryTree(x, z, true);
  }
  const barkMat = vcMat({ wind: 0.03, world: true }), a2c = R.quality.msaa > 0;
  const leafMats = { leaf: leafMat(leafTexture('leaf', rand), a2c), pine: leafMat(leafTexture('pine', rand), a2c), ember: leafMat(leafTexture('ember', rand), a2c) };
  for (const k in species) { instanced(species[k].trunk, barkMat, lists[k], true, true); instanced(species[k].leaves, leafMats[species[k].tex], lists[k], true, true); }

  // ---- undergrowth: low clumps of the same leaf cards ----
  {
    const L = []; canopy(L, 0, 0.75, 0, 1.2, 0.6, 1.2, 9, 1.5);
    const geo = build(L), bush = { leaf: [], ember: [], pine: [] };
    for (let i = 0; i < 2400; i++) {
      const x = (rand() * 2 - 1) * (MAP.hx + 6), z = (rand() * 2 - 1) * (MAP.hz + 6), t = terrain(x, z);
      if (t.dl < 7.5 || t.dr < 5.4 || t.dPl < Math.max(17, MAP.base + 1.5) || t.camp < 0.5 || vnoise(x * 0.13 + 3, z * 0.13) < 0.5) continue;
      const v = 0.7 + rand() * 0.5, list = t.em > 0.6 ? (rand() < 0.35 ? bush.ember : null) : t.fr > 0.6 ? (rand() < 0.4 ? bush.pine : null) : bush.leaf;
      if (list) list.push({ x, z, s: 0.7 + rand() * 0.8, ry: rand() * 6.28, c: [v, v, v] });
    }
    for (const k in bush) instanced(geo, leafMats[k], bush[k], true, true);
  }

  // ---- rocks: a displaced, smooth-shaded boulder; strata, cracks, moss and snow come from the material ----
  const rg = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('uv').deleteAttribute('normal'));
  const rp = rg.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    const k = 0.62 + 0.55 * vnoise(x * 1.4 + 7.1 + y * 1.1, z * 1.4 + 3.3 - y * 0.9) + 0.16 * vnoise(x * 4.3 + y * 3.1, z * 4.3 - y * 2.7) + 0.05 * vnoise(x * 11 + y * 9, z * 11 - y * 7);
    rp.setXYZ(i, x * k, Math.max(-0.25, y * k * 0.78), z * k);
  }
  rg.computeVertexNormals();
  rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rp.count * 3).fill(1), 3));
  rg.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(rp.count).fill(K.rock), 1));
  const rocks = [];
  const rockAt = (x, z, s, t, obstacle) => {
    const g = 0.75 + rand() * 0.4;
    const c = [0.21 * g * (1 - t.em * 0.6) + t.fr * 0.03, 0.2 * g * (1 - t.em * 0.66) + t.fr * 0.045, 0.19 * g * (1 - t.em * 0.66) + t.fr * 0.07];
    rocks.push({ x, z, y: s * 0.18, s, sy: s * (0.7 + rand() * 0.5), ry: rand() * 6.28, rx: (rand() - 0.5) * 0.4, c });
    if (obstacle) W.obstacles.push({ x, z, r: s * 0.9 });
  };
  for (let i = 0; i < 400 * AREA && rocks.length < 46 * AREA; i++) {
    const x = (rand() * 2 - 1) * (MAP.hx - 3), z = (rand() * 2 - 1) * (MAP.hz - 3), t = clear(x, z, 1.5);
    if (!t || brushAt(x, z, 3) >= 0) continue;
    if (W.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < 5.5)) continue;
    const s = 1.2 + rand() * 1.5; rockAt(x, z, s, t, true);
    if (rand() < 0.6) rockAt(x + (rand() - 0.5) * 3, z + (rand() - 0.5) * 3, 0.5 + rand() * 0.5, t, false);
  }
  for (let i = 0; i < 240; i++) {
    const a = rand() * 6.283, ex = MAP.hx + 7 + rand() * 10, ez = MAP.hz + 6 + rand() * 10;
    const x = Math.max(-ex, Math.min(ex, Math.cos(a) * ex * 1.5)), z = Math.max(-ez, Math.min(ez, Math.sin(a) * ez * 1.5));
    rockAt(x, z, 1.4 + rand() * 2.0, terrain(x, z), false);
  }
  for (let i = 0; i < 110 * MAP.hz / 48; i++) {
    const rp = RIVER.at(rand(), (rand() < 0.5 ? -1 : 1) * (4.3 + rand() * 2.2)), x = rp.x, z = rp.z, t = terrain(x, z);
    if (t.dl > 7) rockAt(x, z, 0.3 + rand() * 0.55, t, false);
  }
  // ridges: a spine of big boulders along each wall segment. Each boulder is also a solid circle for movement and for paths.
  for (const [A, B] of RIDGES) {
    const d = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(2, Math.round(d / 1.7));
    for (let i = 0; i <= n; i++) {
      const x = A[0] + (B[0] - A[0]) * i / n, z = A[1] + (B[1] - A[1]) * i / n, t = terrain(x, z);
      rockAt(x + (rand() - 0.5) * 0.5, z + (rand() - 0.5) * 0.5, 1.75 + rand() * 0.7, t, false); if (rand() < 0.5) rockAt(x + (rand() - 0.5) * 1.6, z + (rand() - 0.5) * 1.6, 0.8 + rand() * 0.5, t, false);
      W.walls.push({ x, z, r: 1.5 });
    }
  }
  instanced(rg, vcMat({ world: true }), rocks);

  // ---- sect precincts: a low stone balustrade around each one, and a gate (山门) where every lane comes in ----
  {
    const WL = [], GT = []; kind(K.stone);
    part(WL, G.box(2.5, 0.95, 0.8), '#77736c', 0, 0.48, 0); part(WL, G.box(2.75, 0.2, 1.05), '#55524d', 0, 1.02, 0); part(WL, G.box(0.5, 1.5, 0.95), '#6a665f', 1.25, 0.75, 0); part(WL, G.box(0.66, 0.2, 1.1), '#4d4a45', 1.25, 1.58, 0);
    for (const sx of [-7.4, 7.4]) { part(GT, G.cyl(0.5, 0.62, 7.2, 10), '#6f6b64', sx, 3.6, 0); part(GT, G.box(1.7, 0.6, 1.7), '#57534d', sx, 0.3, 0); }
    part(GT, G.box(16.4, 0.7, 0.85), '#5f5b55', 0, 6.3, 0); part(GT, G.box(18.6, 0.42, 1.7), '#3e3b37', 0, 7.35, 0); part(GT, G.box(3.4, 1.15, 0.5), '#2c2a28', 0, 5.35, 0);
    for (const sx of [-1, 1]) part(GT, G.box(2.2, 0.38, 1.6), '#3e3b37', sx * 9.9, 7.62, 0, 0, 0, sx * 0.3);
    kind(K.paint);
    const walls = [[], []], gates = [[], []];
    for (const team of [FROST, EMBER]) {
      const c = POS.core(team), f = POS.fountain(team), Rc = MAP.base + 0.9, Rf = MAP.base - MAP.baseF + 0.9, tint = team === FROST ? [0.92, 0.98, 1.1] : [1, 1, 1];
      const ring = (o, R, other, Ro) => { const n = Math.round(6.2832 * R / 2.75); for (let i = 0; i < n; i++) { const a = i / n * 6.2832, x = o.x + Math.cos(a) * R, z = o.z + Math.sin(a) * R;
        if (Math.hypot(x - other.x, z - other.z) < Ro - 0.3 || Math.abs(x) > MAP.hx + 6 || Math.abs(z) > MAP.hz + 6) continue;       // inside the other circle, or off the map
        let open = false; for (const L of LANES) if (L.dist(x, z) < 8.6) open = true; if (open) continue;                        // the lanes come through here
        walls[team].push({ x, z, s: 1, ry: -a + Math.PI / 2, c: tint }); if (MODE.solid) W.walls.push({ x, z, r: 1.45 }); } };
      ring(c, Rc, f, Rf); ring(f, Rf, c, Rc);
      for (const L of LANES) {                                           // the gate stands where the lane crosses the edge of the precinct
        const from = team === FROST ? L.s0 : L.s1, dir = team === FROST ? 1 : -1; let s = from, q = L.at(s, 0);
        for (let k = 0; k < 400 && Math.min(Math.hypot(q.x - c.x, q.z - c.z), Math.hypot(q.x - f.x, q.z - f.z) + MAP.baseF) < MAP.base + 0.9; k++) { s += dir * 0.25; q = L.at(s, 0); }
        const t = L.tan(s); gates[team].push({ x: q.x, z: q.z, s: 1, ry: Math.atan2(-t.x, -t.z), c: tint }); if (MODE.solid) for (const sd of [-7.4, 7.4]) W.walls.push({ x: q.x - t.z * sd, z: q.z + t.x * sd, r: 0.95 });
      }
    }
    // 血魂宗's fence is a row of tusks leaning outward from a black sill; its gates are two obsidian spires hung with chains,
    // a skull with lit sockets between them and a blood-red banner below.
    const WE = [], GE = [];
    kind(K.stone); part(WE, G.box(2.6, 0.5, 0.95), '#141012', 0, 0.25, 0);
    kind(K.skin); for (const [x, hgt, lean] of [[-0.95, 2.3, 0.3], [-0.3, 3.0, 0.42], [0.4, 2.5, 0.34], [1.05, 1.9, 0.26]]) part(WE, G.cyl(0.02, 0.2, hgt, 6), '#b3a58d', x, 0.4 + hgt * 0.45, -Math.sin(lean) * hgt * 0.45, -lean, 0, x * 0.08);
    kind(K.stone);
    for (const sx of [-7.4, 7.4]) {
      part(GE, G.cyl(0.14, 0.85, 9.4, 6), '#120e10', sx, 4.7, 0); part(GE, G.box(2.0, 0.7, 2.0), '#0e0b0c', sx, 0.35, 0);
      for (const [y, a] of [[3.2, 0.9], [5.4, 0.75], [7.2, 0.6]]) for (const d of [-1, 1]) part(GE, G.cyl(0.02, 0.2, 1.9, 5), '#b3a58d', sx + d * 0.7, y + 0.5, 0, 0, 0, -d * a);
    }
    for (let i = 0; i <= 12; i++) { const k = i / 12, x = -7.2 + 14.4 * k, y = 8.3 - Math.sin(k * Math.PI) * 2.0; part(GE, G.box(0.5, 0.2, 0.32), '#1c1719', x, y, 0, 0, 0, Math.cos(k * Math.PI) * 0.5); }   // the chain sags
    kind(K.skin); part(GE, G.sph(0.95, 12, 9), '#bfb29a', 0, 5.6, 0, 0, 0, 0, 1, 1.12, 0.95); part(GE, G.box(0.9, 0.6, 0.7), '#a99c85', 0, 4.75, 0.25);
    kind(K.paint); for (const sx of [-0.36, 0.36]) part(GE, G.sph(0.21, 8, 6), '#ff2a14', sx, 5.72, 0.78, 0, 0, 0, 1, 1, 0.6, 3.2);
    kind(K.cloth); part(GE, G.box(2.3, 3.4, 0.07), '#4a0606', 0, 2.75, 0); part(GE, G.box(1.1, 1.1, 0.09), '#8a0c0c', 0, 3.0, 0.02, 0, 0, Math.PI / 4);
    kind(K.paint);
    const wm = vcMat({ world: true });
    instanced(build(WL), wm, walls[FROST]); instanced(build(GT), wm, gates[FROST]); instanced(build(WE), wm, walls[EMBER]); instanced(build(GE), wm, gates[EMBER]);
  }

  // ---- grass: thin blades in tufts, lit like the ground, swaying in the vertex shader ----
  const bl = [], bc = [], bn = [];
  for (let b = 0; b < 5; b++) {
    const a = b * 1.31 + 0.4, ca = Math.cos(a), sa = Math.sin(a), ox = Math.cos(a * 2.7) * 0.16, oz = Math.sin(a * 2.7) * 0.16, hgt = 0.5 + (b % 3) * 0.24, lean = 0.12 + b * 0.05, w = 0.035;
    const A = [ox - ca * w, 0, oz - sa * w], B = [ox + ca * w, 0, oz + sa * w], C = [ox + sa * lean, hgt, oz - ca * lean];
    bl.push(...A, ...B, ...C, ...B, ...A, ...C);
    for (let k = 0; k < 2; k++) { bc.push(0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 1, 0.95, 0.7); bn.push(0, 1, 0, 0, 1, 0, 0, 1, 0); }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(bl, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); gg.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3));
  const tufts = [], nT = Math.round(30000 * R.quality.grass * AREA);
  for (let i = 0; i < nT * 3 && tufts.length < nT; i++) {
    const x = (rand() * 2 - 1) * (MAP.hx + 4), z = (rand() * 2 - 1) * (MAP.hz + 4), t = terrain(x, z);
    if (t.dl < 6.4 || t.dr < 4.9 || t.dPl < MAP.base + 1 || t.camp < -1) continue;
    const lush = (1 - t.fr * 0.8) * (1 - t.em * 0.85);
    if (rand() > 0.18 + 0.82 * lush * (0.35 + 0.65 * vnoise(x * 0.15, z * 0.15))) continue;
    const v = 0.6 + rand() * 0.7, dry = rand();
    const c = [(0.09 + 0.1 * dry) * v, (0.17 + 0.07 * dry) * v, 0.04 * v];
    if (t.fr > 0.5) { c[0] = 0.24 * v; c[1] = 0.25 * v; c[2] = 0.2 * v; } else if (t.em > 0.5) { c[0] = 0.16 * v; c[1] = 0.075 * v; c[2] = 0.03 * v; }
    tufts.push({ x, z, s: 0.7 + rand() * 0.9, ry: rand() * 6.28, c });
  }
  instanced(gg, vcMat({ wind: 0.26, rough: 0.9, plain: true }), tufts, false, true);

  // ---- brush: waist-high reeds you can hide in. Dense, taller toward the middle, with a few pale plumes ----
  {
    const rl = [], rc = [], rn = [];
    for (let b = 0; b < 9; b++) {
      const a = b * 2.4 + 0.3, ca = Math.cos(a), sa = Math.sin(a), ox = Math.cos(a * 1.7) * 0.22, oz = Math.sin(a * 1.7) * 0.22, hgt = 1.25 + (b % 4) * 0.34, lean = 0.18 + (b % 3) * 0.16, w = 0.05 + (b % 2) * 0.02;
      const A = [ox - ca * w, 0, oz - sa * w], B = [ox + ca * w, 0, oz + sa * w], M1 = [ox + sa * lean * 0.35 - ca * w * 0.7, hgt * 0.55, oz - ca * lean * 0.35 - sa * w * 0.7], M2 = [ox + sa * lean * 0.35 + ca * w * 0.7, hgt * 0.55, oz - ca * lean * 0.35 + sa * w * 0.7], C = [ox + sa * lean, hgt, oz - ca * lean];
      for (const tri of [[A, B, M2], [A, M2, M1], [M1, M2, C], [B, A, M2], [M2, A, M1], [M2, M1, C]]) for (const q of tri) { rl.push(...q); const k = 0.28 + 0.72 * (q[1] / hgt); rc.push(k, k * 0.98, k * 0.8); rn.push(0, 1, 0); }
    }
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rl, 3)); rgeo.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3)); rgeo.setAttribute('normal', new THREE.Float32BufferAttribute(rn, 3));
    const reeds = [], dens = 8.5 * Math.max(0.55, R.quality.grass);
    for (const b of BRUSH) {
      const n = Math.round(Math.PI * b.r * b.r * dens);
      for (let i = 0; i < n; i++) {
        const a = rand() * 6.283, q = Math.sqrt(rand()) * (b.r + 0.25), x = b.x + Math.cos(a) * q, z = b.z + Math.sin(a) * q, t = terrain(x, z);
        const v = 0.6 + rand() * 0.6, plume = rand() < 0.13, edge = 1 - 0.35 * (q / b.r) * (q / b.r);
        let c = plume ? [0.4 * v, 0.36 * v, 0.16 * v] : [0.1 * v, 0.26 * v, 0.075 * v];
        if (t.fr > 0.5) c = plume ? [0.42 * v, 0.44 * v, 0.42 * v] : [0.17 * v, 0.24 * v, 0.22 * v]; else if (t.em > 0.5) c = plume ? [0.36 * v, 0.2 * v, 0.07 * v] : [0.2 * v, 0.1 * v, 0.035 * v];
        reeds.push({ x, z, s: 1, sx: 1.1 + rand() * 0.5, sy: (0.6 + rand() * 0.4) * edge * (plume ? 1.3 : 1), sz: 1.1 + rand() * 0.5, ry: rand() * 6.28, c });
      }
      const nr = Math.round(b.r * 16);                                 // the rim: a ring of taller, paler plumes so the edge reads from above
      for (let i = 0; i < nr; i++) {
        const a = i / nr * 6.283 + rand() * 0.2, q = b.r + (rand() - 0.5) * 0.5, x = b.x + Math.cos(a) * q, z = b.z + Math.sin(a) * q, t = terrain(x, z), v = 0.75 + rand() * 0.4;
        const c = t.fr > 0.5 ? [0.46 * v, 0.5 * v, 0.5 * v] : t.em > 0.5 ? [0.42 * v, 0.24 * v, 0.08 * v] : [0.36 * v, 0.4 * v, 0.14 * v];
        reeds.push({ x, z, s: 1, sx: 1.3 + rand() * 0.5, sy: 1.15 + rand() * 0.35, sz: 1.3 + rand() * 0.5, ry: rand() * 6.28, c });
      }
    }
    instanced(rgeo, vcMat({ wind: 0.22, rough: 0.9, plain: true }), reeds, false, true);
  }

  // ---- drifting motes: snow over frost, fireflies in the meadow, embers over the ash (all in the vertex shader) ----
  const N = 520, seeds = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) seeds[i] = rand();
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
  const mm = new THREE.ShaderMaterial({
    uniforms: { uTime, uCenter: { value: new THREE.Vector3() }, uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime, uScale; uniform vec3 uCenter; varying vec4 vC;
      void main(){
        vec3 box = vec3(100.0, 16.0, 80.0), s = position;
        vec3 p; p.xz = mod(s.xz * box.xz - uCenter.xz, box.xz) - box.xz * 0.5 + uCenter.xz;
        float pbx = ${biomeGLSL('p')}; float fr = 1.0 - smoothstep(-40.0, -14.0, pbx), em = smoothstep(14.0, 40.0, pbx);
        float vy = mix(mix(0.25, -1.1, fr), 1.5, em);
        p.y = mod(s.y * box.y + uTime * vy * (0.6 + s.x), box.y) + 0.3;
        p.x += sin(uTime * 0.7 + s.y * 40.0) * 0.8; p.z += cos(uTime * 0.5 + s.x * 37.0) * 0.8;
        vec3 c = mix(vec3(0.75, 1.0, 0.4) * 0.7, vec3(0.7, 0.85, 1.0) * 0.55, fr); c = mix(c, vec3(2.4, 0.6, 0.08), em);
        float tw = 0.55 + 0.45 * sin(uTime * (1.0 + s.z * 3.0) + s.x * 50.0);
        vC = vec4(c, tw * smoothstep(0.3, 2.0, p.y) * (1.0 - smoothstep(12.0, 16.0, p.y)));
        vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(0.11, 0.18, s.z) * uScale / max(0.1, -mv.z);
      }`,
    fragmentShader: `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC.rgb, vC.a * a * a); }`,
  });
  const motes = new THREE.Points(mg, mm); motes.frustumCulled = false; motes.renderOrder = 19; add(motes);
  const setScale = s => { mm.uniforms.uScale.value = s.ph / (2 * Math.tan(R.camera.fov * Math.PI / 360)); };
  R.onResize.push(setScale); setScale(R.size);
  for (const w of W.walls) W.obstacles.push(w);
  W.dispose = () => {
    const k = R.onResize.indexOf(setScale); if (k >= 0) R.onResize.splice(k, 1);
    for (const o of owned) { scene.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); if (o.shadow && o.shadow.map) o.shadow.map.dispose(); if (o.dispose && o.isInstancedMesh) o.dispose(); }
    if (scene.environment) { scene.environment.dispose(); scene.environment = null; }
    if (tLane) tLane.dispose();
  };
  W.update = (focus) => { mm.uniforms.uCenter.value.set(focus.x, 0, focus.z); };
  return W;
}
