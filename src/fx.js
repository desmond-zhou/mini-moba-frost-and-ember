// fx.js — pooled effects. One instanced-quad particle system draws three kinds of particle in a single call:
// velocity-stretched sparks, noise-eroded smoke / dust, and fire. Plus ground decals (glow, shockwave, telegraph, scorch),
// a small pool of real point lights for flashes, projectile meshes, instanced health bars, floating text, camera shake.
import * as THREE from 'three';
import { tNoise, uTime } from './mat.js';

const DECAL_FRAG = `
  uniform vec3 uColor; uniform float uMode, uProg, uAlpha, uTime, uSeed, uArc; uniform sampler2D tNoise; varying vec2 vUv;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float poly(float ang, float d, float n){ return cos(floor(0.5 + ang * n / 6.28318) * 6.28318 / n - ang) * d; }
  void main(){
    vec2 c = vUv - 0.5; float d = length(c) * 2.0, a = 0.0, ang = atan(c.y, c.x);
    if (uMode > 7.5 && uMode < 8.5) {                                                      // aim arrow: u runs along the shot, uArc = head length, uSeed = chevron count
      float u = vUv.x, v = abs(vUv.y - 0.5) * 2.0, w = u < 1.0 - uArc ? 0.5 : (1.0 - u) / uArc;
      float inside = step(v, w), edge = smoothstep(0.16, 0.0, abs(v - w)) * step(v, w + 0.02);
      float chev = smoothstep(0.3, 0.5, abs(fract(u * uSeed - uTime * 1.4 - v * 0.3) - 0.5));
      gl_FragColor = vec4(uColor, (inside * (0.1 + 0.22 * chev) + edge * 0.85) * smoothstep(0.0, 0.12, u) * uAlpha); return;
    }
    if (d >= 1.0) discard;   // every other decal is round; outside the disc some of the maths below is undefined
    if (uMode > 8.5) {                                                                     // aim sector: a wedge of half-angle uArc
      float inw = step(abs(ang), uArc), sweep = smoothstep(0.38, 0.5, abs(fract(d * 3.0 - uTime * 1.4) - 0.5));
      float rim = smoothstep(0.035, 0.0, abs(d - 0.96)) * inw, sides = smoothstep(0.03, 0.0, abs(abs(ang) - uArc) * d) * step(abs(ang), uArc + 0.1);
      gl_FragColor = vec4(uColor, (inw * (0.08 + 0.14 * sweep) * smoothstep(0.04, 0.22, d) + rim * 0.9 + sides * 0.8) * uAlpha); return;
    }
    if (uMode < 0.5) a = pow(max(0.0, 1.0 - d), 2.2);                                    // soft light pool
    else if (uMode < 1.5) { float w = 0.04 + 0.08 * (1.0 - uProg); a = smoothstep(w, 0.0, abs(d - (0.12 + 0.84 * uProg))) * (1.0 - uProg) * (0.6 + 0.6 * texture2D(tNoise, vUv * 0.6).g); } // shockwave
    else if (uMode < 2.5) {                                                               // plain telegraph: rim + growing fill
      float rim = smoothstep(0.03, 0.0, abs(d - 0.96));
      float fill = step(d, uProg * 0.96) * 0.16 + smoothstep(0.04, 0.0, abs(d - uProg * 0.96)) * 0.6;
      a = (rim + fill) * step(d, 1.0);
    } else if (uMode < 3.5) a = smoothstep(0.045, 0.0, abs(d - 0.9)) + pow(max(0.0, 1.0 - d), 3.0) * 0.16; // unit ring
    else if (uMode < 4.5) {                                                               // scorch mark (normal blending)
      float n = texture2D(tNoise, vUv * 0.55 + uColor.xy).r * 0.6 + texture2D(tNoise, vUv * 1.7 + uColor.yx).g * 0.4;
      a = smoothstep(1.0, 0.25, d + (n - 0.5) * 0.7) * (0.6 + 0.4 * n);
      gl_FragColor = vec4(vec3(0.012, 0.01, 0.009), a * uAlpha * (1.0 - uProg * uProg)); return;
    } else if (uMode < 5.5) {                                                             // rune circle: rings, turning ticks and glyphs, a hexagram, and a fill that charges up
      float rot = uTime * 0.7 + uSeed * 6.0;
      float rings = smoothstep(0.016, 0.0, abs(d - 0.965)) + smoothstep(0.01, 0.0, abs(d - 0.86)) * 0.8 + smoothstep(0.01, 0.0, abs(d - 0.6)) * 0.6 + smoothstep(0.008, 0.0, abs(d - 0.27)) * 0.5;
      float ticks = step(0.87, d) * step(d, 0.955) * smoothstep(0.36, 0.46, abs(fract((ang + rot) * 36.0 / 6.28318) - 0.5)) * 0.7;
      float ga = (ang - rot * 0.6) * 18.0 / 6.28318, gf = fract(ga), gr = (d - 0.64) / 0.2;
      float glyph = step(0.0, gr) * step(gr, 1.0) * step(0.14, gf) * step(gf, 0.86) * step(0.5, h21(vec2(floor(ga), floor(gr * 4.0) + floor(gf * 3.0) * 7.0 + floor(uSeed * 50.0))));
      float st = smoothstep(0.012, 0.0, abs(poly(ang + rot * 0.5, d, 3.0) - 0.29)) + smoothstep(0.012, 0.0, abs(poly(ang + rot * 0.5 + 3.14159, d, 3.0) - 0.29));
      st *= step(d, 0.6);
      float fill = step(d, uProg * 0.965) * (0.07 + 0.1 * uProg) + smoothstep(0.06, 0.0, abs(d - uProg * 0.965)) * 0.9;
      float pulse = 0.75 + 0.25 * sin(uTime * 9.0);
      a = ((rings + ticks + glyph * 0.75 + st * 0.9) * (0.45 + 0.55 * uProg) * pulse + fill) * step(d, 1.0);
    } else if (uMode < 6.5) {                                                             // glowing fissures radiating from an impact, cooling as they age
      float w = texture2D(tNoise, vec2(d * 0.22, uSeed)).r * 2.6;
      float l1 = abs(fract(ang / 6.28318 * 9.0 + w + uSeed) - 0.5), l2 = abs(fract(ang / 6.28318 * 17.0 - w * 1.7 + uSeed * 3.0) - 0.5);
      float cr = smoothstep(0.05 * (1.0 - d) + 0.012, 0.0, l1) + smoothstep(0.035 * (1.0 - d) + 0.008, 0.0, l2) * smoothstep(0.75, 0.2, d) * 0.7;
      float ringc = smoothstep(0.02, 0.0, abs(d - 0.34 - texture2D(tNoise, vec2(ang * 0.3, uSeed)).g * 0.12)) * 0.8;
      a = (cr + ringc) * pow(max(0.0, 1.0 - d), 0.7) * (1.0 - uProg) * (1.0 - uProg) * 1.6;
      gl_FragColor = vec4(mix(uColor * 1.5 + 0.12, uColor * vec3(0.9, 0.35, 0.2), min(1.0, uProg * 1.6)), min(a, 2.0) * uAlpha); return;
    } else {                                                                              // blade arc: a crescent that sweeps across its cone
      float band = smoothstep(0.4, 0.62, d) * smoothstep(1.0, 0.9, d);
      float lead = mix(-uArc, uArc, min(1.0, uProg * 1.7)), behind = lead - ang;
      float n = texture2D(tNoise, vec2(ang * 0.45, d * 0.5) + uSeed).r;
      float body = step(-uArc, ang) * step(0.0, behind) * exp(-behind * 2.4) * (0.35 + 1.1 * n);
      float edge = smoothstep(0.07, 0.0, abs(behind)) * step(abs(ang), uArc + 0.05) * 1.6;
      a = min(band * (body * 1.5 + edge) * (1.0 - smoothstep(0.55, 1.0, uProg)) + smoothstep(0.03, 0.0, abs(d - 0.93)) * body * 1.2, 2.2);
    }
    gl_FragColor = vec4(uColor, a * uAlpha);
  }`;
const DECAL_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function createFx(R) {
  const { scene } = R;
  const fx = { shakeAmt: 0 };

  // ---------- particles ----------
  const MAX = 4096;
  const iPos = new Float32Array(MAX * 3), iVel = new Float32Array(MAX * 4), iCol = new Float32Array(MAX * 4), iPar = new Float32Array(MAX * 4);
  const life = new Float32Array(MAX), maxLife = new Float32Array(MAX), P = new Float32Array(MAX * 8); // size, grav, drag, opacity, grow, r, g, b
  let cursor = 0;
  const pg = new THREE.InstancedBufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3)); pg.setIndex([0, 1, 2, 0, 2, 3]);
  const aPos_ = new THREE.InstancedBufferAttribute(iPos, 3).setUsage(THREE.DynamicDrawUsage), aVel_ = new THREE.InstancedBufferAttribute(iVel, 4).setUsage(THREE.DynamicDrawUsage);
  const aCol_ = new THREE.InstancedBufferAttribute(iCol, 4).setUsage(THREE.DynamicDrawUsage), aPar_ = new THREE.InstancedBufferAttribute(iPar, 4).setUsage(THREE.DynamicDrawUsage);
  pg.setAttribute('iPos', aPos_); pg.setAttribute('iVel', aVel_); pg.setAttribute('iCol', aCol_); pg.setAttribute('iPar', aPar_);
  pg.instanceCount = MAX;
  const pm = new THREE.ShaderMaterial({
    uniforms: { tNoise }, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `attribute vec3 iPos; attribute vec4 iVel, iCol, iPar; varying vec2 vUv; varying vec4 vCol; varying vec3 vK;
      void main(){
        vec4 mv = viewMatrix * vec4(iPos, 1.0); vec2 q = position.xy; float size = iPar.x;
        if (iPar.y > 0.0) {                       // spark: stretch along the screen-space velocity
          vec3 vv = (viewMatrix * vec4(iVel.xyz, 0.0)).xyz; float sp = length(vv.xy);
          vec2 ax = sp > 0.001 ? vv.xy / sp : vec2(0.0, 1.0);
          mv.xy += ax * q.y * size * (1.0 + sp * iPar.y) + vec2(-ax.y, ax.x) * q.x * size;
        } else {                                  // puff: random roll, slowly turning
          float a = (iPar.z > 2.5 && iPar.z < 3.5) ? 0.0 : iPar.w * 6.283 + (1.0 - iVel.w) * (iPar.w - 0.5) * (iPar.z > 3.5 ? 16.0 : 1.6), c = cos(a), s = sin(a);
          mv.xy += vec2(q.x * c - q.y * s, q.x * s + q.y * c) * size;
        }
        gl_Position = projectionMatrix * mv; vUv = position.xy + 0.5; vCol = iCol; vK = vec3(iPar.z, iPar.w, iVel.w);
      }`,
    fragmentShader: `uniform sampler2D tNoise; varying vec2 vUv; varying vec4 vCol; varying vec3 vK;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        if (vK.x < 0.5) {                         // spark / glow — purely additive
          float a = pow(max(0.0, 1.0 - r), 2.4);
          gl_FragColor = vec4(vCol.rgb * a * vCol.a, 0.0);
        } else if (vK.x < 1.5) {                  // smoke / dust — eroded by noise as it ages
          float n = texture2D(tNoise, vUv * 0.2 + vK.y * 7.3).r * 0.62 + texture2D(tNoise, vUv * 0.55 + vK.y * 3.1).g * 0.38;
          float er = (1.0 - vK.z) * 0.62;
          float a = smoothstep(1.0, 0.2, r) * smoothstep(er, er + 0.3, n) * vCol.a;
          gl_FragColor = vec4(vCol.rgb * (0.45 + 0.9 * n) * a, a);
        } else if (vK.x < 2.5) {                  // fire — hot core, licking edges, mostly additive
          float n = texture2D(tNoise, vUv * 0.28 + vec2(vK.y * 5.0, vK.y * 9.0 - (1.0 - vK.z) * 0.3)).r * 0.7 + texture2D(tNoise, vUv * 0.7 + vK.y * 2.0).g * 0.3;
          float heat = smoothstep(1.0, 0.0, r) * (0.35 + n) * (0.35 + 0.85 * vK.z);
          float a = smoothstep(0.26, 0.6, heat) * vCol.a;
          vec3 c = mix(vCol.rgb * 0.55, vCol.rgb * 1.1 + vec3(0.32, 0.17, 0.04), smoothstep(0.5, 0.98, heat)) * 1.2;
          gl_FragColor = vec4(c * a, a * 0.62);
        } else if (vK.x < 3.5) {                  // flare — a four-point star of light
          vec2 p = (vUv - 0.5) * 2.0;
          float core = pow(max(0.0, 1.0 - r), 3.0);
          float sx = max(0.0, 1.0 - abs(p.y) * 16.0) * pow(max(0.0, 1.0 - abs(p.x)), 2.0), sy = max(0.0, 1.0 - abs(p.x) * 16.0) * pow(max(0.0, 1.0 - abs(p.y)), 2.0);
          gl_FragColor = vec4(vCol.rgb * (core * 1.3 + (sx + sy) * 0.9) * vCol.a, 0.0);
        } else {                                  // debris — tumbling chips of stone, opaque
          float n = texture2D(tNoise, vUv * 0.13 + vK.y * 11.0).r;
          float a = step(r + (n - 0.5) * 0.9, 0.6) * min(1.0, vCol.a * 3.0);
          gl_FragColor = vec4(vCol.rgb * (0.45 + 1.1 * n) * a, a);
        }
      }`,
  });
  const points = new THREE.Mesh(pg, pm); points.frustumCulled = false; points.renderOrder = 20; points.userData.noAO = true; scene.add(points);

  function emit(kind, x, y, z, vx, vy, vz, c, size, lifeS, grav, drag, stretch, opacity, grow) {
    const i = cursor; cursor = (cursor + 1) % MAX;
    iPos[i * 3] = x; iPos[i * 3 + 1] = y; iPos[i * 3 + 2] = z; iVel[i * 4] = vx; iVel[i * 4 + 1] = vy; iVel[i * 4 + 2] = vz;
    life[i] = maxLife[i] = lifeS; iPar[i * 4 + 1] = stretch; iPar[i * 4 + 2] = kind; iPar[i * 4 + 3] = Math.random();
    const b = i * 8; P[b] = size; P[b + 1] = grav; P[b + 2] = drag; P[b + 3] = opacity; P[b + 4] = grow; P[b + 5] = c[0]; P[b + 6] = c[1]; P[b + 7] = c[2];
  }
  fx.spark = (x, y, z, vx, vy, vz, c, size, lifeS, grav = 0, drag = 0, stretch = 0.045) => emit(0, x, y, z, vx, vy, vz, c, size, lifeS, grav, drag, stretch, 1, 0);
  fx.smoke = (x, y, z, vx, vy, vz, c, size, lifeS, opacity = 0.5, grow = 1.6, grav = -0.6, drag = 1.2) => emit(1, x, y, z, vx, vy, vz, c, size, lifeS, grav, drag, 0, opacity, grow);
  fx.fire = (x, y, z, vx, vy, vz, c, size, lifeS, grow = 0.8) => emit(2, x, y, z, vx, vy, vz, c, size, lifeS, -2.5, 1.5, 0, 1, grow);
  fx.flare = (x, y, z, c, size, lifeS = 0.2) => emit(3, x, y, z, 0, 0, 0, c, size, lifeS, 0, 0, 0, 1, -0.55);
  fx.debris = (x, y, z, vx, vy, vz, c, size, lifeS) => emit(4, x, y, z, vx, vy, vz, c, size, lifeS, 26, 0.3, 0, 1, 0);
  // radial burst of sparks. o: n, speed, up, life, size, grav, spread(position jitter), drag
  fx.burst = (x, y, z, c, o = {}) => {
    const n = o.n || 12, sp = o.speed ?? 6, up = o.up ?? 3;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, s = sp * (0.35 + Math.random() * 0.65), j = o.spread || 0;
      fx.spark(x + (Math.random() - 0.5) * j, y + (Math.random() - 0.5) * j * 0.5, z + (Math.random() - 0.5) * j,
        Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s, c, (o.size || 0.5) * (0.5 + Math.random() * 0.7), (o.life || 0.5) * (0.6 + Math.random() * 0.8), o.grav ?? 12, o.drag ?? 1.2);
    }
  };
  // ring of dust kicked outward along the ground
  fx.dust = (x, z, c, o = {}) => {
    const n = o.n || 10, sp = o.speed ?? 4;
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, s = sp * (0.4 + Math.random() * 0.6), r = (o.r || 0) * Math.random(); fx.smoke(x + Math.cos(a) * r, 0.4 + Math.random() * 0.5, z + Math.sin(a) * r, Math.cos(a) * s, 0.6 + Math.random() * (o.up ?? 1.2), Math.sin(a) * s, c, (o.size || 1.6) * (0.7 + Math.random() * 0.6), (o.life || 0.9) * (0.7 + Math.random() * 0.6), o.opacity ?? 0.38, o.grow ?? 1.8, -0.3, 2.2); }
  };
  fx.line = (ax, ay, az, bx, by, bz, c, n = 14, size = 0.5, lifeS = 0.25) => {
    for (let k = 0; k <= n; k++) { const t = k / n, j = 0.35; fx.spark(ax + (bx - ax) * t + (Math.random() - 0.5) * j, ay + (by - ay) * t + (Math.random() - 0.5) * j, az + (bz - az) * t + (Math.random() - 0.5) * j, 0, 0.4, 0, c, size, lifeS * (0.6 + Math.random() * 0.6), 0, 0, 0); }
  };
  const SMOKE = [0.05, 0.046, 0.043], HOTC = [1.0, 0.36, 0.07];
  // fireball: flame, a rising column of dark smoke, falling sparks, a scorch mark and a flash of real light
  fx.explosion = (x, z, s = 1, c = HOTC) => {
    for (let k = 0; k < 9 * s; k++) { const a = Math.random() * 6.283, v = (2 + Math.random() * 5) * s; fx.fire(x + Math.cos(a) * s, 0.8 + Math.random() * 1.6 * s, z + Math.sin(a) * s, Math.cos(a) * v, 2 + Math.random() * 5 * s, Math.sin(a) * v, c, (2.0 + Math.random() * 2.0) * s, 0.45 + Math.random() * 0.45, 1.3); }
    for (let k = 0; k < 12 * s; k++) { const a = Math.random() * 6.283, v = (1 + Math.random() * 3.5) * s; fx.smoke(x + Math.cos(a) * s * 0.8, 1 + Math.random() * 2 * s, z + Math.sin(a) * s * 0.8, Math.cos(a) * v, 2.5 + Math.random() * 4, Math.sin(a) * v, SMOKE, (2.6 + Math.random() * 2.4) * s, 1.8 + Math.random() * 1.8, 0.7, 2.2, -1.4, 0.9); }
    fx.burst(x, 1, z, [c[0] * 3 + 0.6, c[1] * 3 + 0.4, c[2] * 3 + 0.1], { n: Math.round(46 * s), speed: 15 * s, up: 13 * s, life: 1.1, size: 0.34, grav: 22, drag: 0.5 });
    fx.dust(x, z, [0.2, 0.17, 0.14], { n: Math.round(10 * s), speed: 9 * s, size: 2.6 * s, life: 1.2, r: s });
    fx.scorch(x, z, 7.5 * s); fx.flash(x, 2.5, z, c, 300 * s, 0.5);
  };

  // ---------- decals ----------
  const dgeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  function decalMesh(normalBlend) {
    const m = new THREE.Mesh(dgeo, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uMode: { value: 0 }, uProg: { value: 0 }, uAlpha: { value: 1 }, uSeed: { value: 0 }, uArc: { value: 1 }, tNoise, uTime },
      vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG, transparent: true, depthWrite: false, blending: normalBlend ? THREE.NormalBlending : THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    m.renderOrder = normalBlend ? 4 : 5; m.frustumCulled = false; m.userData.noAO = true;
    return m;
  }
  fx.decalMesh = (mode, size, c, alpha = 1) => { // persistent, caller owns it
    const m = decalMesh(false); const u = m.material.uniforms;
    u.uMode.value = mode; u.uColor.value.setRGB(c[0], c[1], c[2]); u.uAlpha.value = alpha; m.scale.set(size, 1, size); m.position.y = 0.07;
    return m;
  };
  const pool = [];
  for (let i = 0; i < 72; i++) { const m = decalMesh(false); m.visible = false; scene.add(m); pool.push({ m, u: m.material.uniforms, t: 0, dur: 0, busy: false, hold: 0, s0: 1, s1: 1 }); }
  // transient decal. o: mode, x, z, size, size0 (start size), color, dur, alpha, hold (keep visible after dur)
  fx.decal = o => {
    const d = pool.find(p => !p.busy); if (!d) return null;
    d.busy = true; d.t = 0; d.dur = o.dur || 0.5; d.hold = o.hold || 0; d.s1 = o.size; d.s0 = o.size0 ?? o.size; d.manual = !!o.manual; d.alpha = o.alpha ?? 1;
    d.u.uMode.value = o.mode; d.u.uColor.value.setRGB(o.color[0], o.color[1], o.color[2]); d.u.uAlpha.value = d.alpha; d.u.uProg.value = 0;
    d.fade = !!o.fade; d.u.uSeed.value = o.seed || 0; d.u.uArc.value = o.arc || 1; d.m.rotation.y = o.rot || 0;
    d.m.position.set(o.x, o.y ?? (0.07 + (o.mode === 2 || o.mode === 5 ? 0.02 : 0)), o.z); d.m.scale.set(d.s0, 1, d.s0); d.m.visible = true;
    return d;
  };
  fx.release = d => { if (d) { d.busy = false; d.m.visible = false; } };
  fx.ringWave = (x, z, size, c, dur = 0.45) => fx.decal({ mode: 1, x, z, size, color: [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7], dur });
  // aim indicator: a range ring round the hero, plus an arrow / wedge / target circle
  const aimRing = decalMesh(false), aimShape = decalMesh(false), aimSpot = decalMesh(false);
  for (const m of [aimRing, aimShape, aimSpot]) { m.visible = false; m.renderOrder = 6; scene.add(m); }
  fx.aimHide = () => { aimRing.visible = aimShape.visible = aimSpot.visible = false; };
  fx.aimShow = o => {
    const c = o.hostile ? [1.8, 0.35, 0.15] : o.heal ? [0.45, 1.3, 0.4] : [0.35, 0.9, 1.5];
    aimRing.visible = !!o.range;
    if (o.range) { const u = aimRing.material.uniforms; u.uMode.value = 3; u.uColor.value.setRGB(c[0] * 0.6, c[1] * 0.6, c[2] * 0.6); u.uAlpha.value = 0.55; aimRing.position.set(o.x, 0.09, o.z); aimRing.scale.set(o.range * 2 / 0.9, 1, o.range * 2 / 0.9); }
    aimShape.visible = !!o.shape;
    if (o.shape) {
      const u = aimShape.material.uniforms; u.uColor.value.setRGB(c[0], c[1], c[2]); u.uAlpha.value = 1; aimShape.rotation.y = -o.facing;
      if (o.shape === 'arrow') { u.uMode.value = 8; u.uArc.value = Math.min(0.45, 2.2 / o.len); u.uSeed.value = o.len / 2.2; aimShape.scale.set(o.len, 1, o.width); aimShape.position.set(o.x + Math.cos(o.facing) * o.len / 2, 0.1, o.z + Math.sin(o.facing) * o.len / 2); }
      else { u.uMode.value = 9; u.uArc.value = o.arc; aimShape.scale.set(o.range * 2, 1, o.range * 2); aimShape.position.set(o.x, 0.1, o.z); }
    }
    aimSpot.visible = o.tx !== undefined;
    if (aimSpot.visible) { const u = aimSpot.material.uniforms; u.uMode.value = 5; u.uProg.value = 1; u.uColor.value.setRGB(c[0], c[1], c[2]); u.uAlpha.value = 0.9; aimSpot.position.set(o.tx, 0.11, o.tz); aimSpot.scale.set(o.radius * 2.08, 1, o.radius * 2.08); }
  };
  const scorches = []; let si = 0;
  for (let i = 0; i < 14; i++) { const m = decalMesh(true); m.visible = false; m.material.uniforms.uMode.value = 4; scene.add(m); scorches.push({ m, u: m.material.uniforms, t: 0, dur: 0 }); }
  fx.scorch = (x, z, size, dur = 16) => { const s = scorches[si]; si = (si + 1) % scorches.length; s.t = 0; s.dur = dur; s.m.visible = true; s.m.position.set(x, 0.05, z); s.m.scale.set(size, 1, size); s.m.rotation.y = Math.random() * 6.28; s.u.uAlpha.value = 0.82; s.u.uColor.value.setRGB(Math.random(), Math.random(), 0); };

  // ---------- real lights: a fixed pool so shaders never recompile ----------
  const lights = [];
  for (let i = 0; i < R.quality.lights; i++) { const l = new THREE.PointLight(0xffffff, 0, 30, 2); scene.add(l); lights.push({ l, t: 0, dur: 0, power: 0, held: false }); }
  fx.flash = (x, y, z, c, power, dur) => {
    let best = null; for (const s of lights) { if (s.held) continue; if (!best || s.l.intensity < best.l.intensity) best = s; }
    if (!best || best.l.intensity > power) return;
    best.l.position.set(x, y, z); best.l.color.setRGB(c[0], c[1], c[2]); best.power = power; best.dur = dur; best.t = 0; best.l.intensity = power;
  };
  fx.lamp = (c, power) => { const s = lights.find(q => !q.held && q.l.intensity < 1); if (!s) return null; s.held = true; s.dur = 0; s.l.color.setRGB(c[0], c[1], c[2]); s.l.intensity = power; return s; };
  fx.freeLamp = s => { if (s) { s.held = false; s.l.intensity = 0; } };

  // ---------- sight beams (a tower's line to whatever it is about to shoot) ----------
  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  fx.beamMesh = () => {
    const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.visible = false; m.frustumCulled = false; m.userData.noAO = true; m.renderOrder = 17;
    m.userData.set = (ax, ay, az, bx, by, bz, c, w, alpha) => { m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.lookAt(bx, by, bz); m.scale.set(w, w, Math.hypot(bx - ax, by - ay, bz - az)); m.material.color.setRGB(c[0], c[1], c[2]); m.material.opacity = alpha; m.visible = true; };
    return m;
  };

  // ---------- projectile meshes ----------
  const sphere = new THREE.IcosahedronGeometry(1, 2);
  const bolts = [];
  for (let i = 0; i < 64; i++) { const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); m.visible = false; scene.add(m); bolts.push({ m, busy: false }); }
  fx.bolt = (c, sx, sy, sz) => {
    const b = bolts.find(p => !p.busy); if (!b) return null;
    b.busy = true; b.m.visible = true; b.m.material.color.setRGB(c[0], c[1], c[2]); b.m.scale.set(sx, sy, sz);
    return b;
  };
  fx.freeBolt = b => { if (b) { b.busy = false; b.m.visible = false; } };

  // ---------- health bars (one instanced draw) ----------
  const BMAX = 110;
  const bgeo = new THREE.InstancedBufferGeometry();
  bgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  bgeo.setIndex([0, 1, 2, 0, 2, 3]);
  const bPos = new Float32Array(BMAX * 3), bPar = new Float32Array(BMAX * 4), bCol = new Float32Array(BMAX * 3), bEx = new Float32Array(BMAX * 2), bFx = new Float32Array(BMAX * 3);
  const aPos = new THREE.InstancedBufferAttribute(bPos, 3).setUsage(THREE.DynamicDrawUsage), aPar = new THREE.InstancedBufferAttribute(bPar, 4).setUsage(THREE.DynamicDrawUsage);
  const aCol = new THREE.InstancedBufferAttribute(bCol, 3).setUsage(THREE.DynamicDrawUsage), aEx = new THREE.InstancedBufferAttribute(bEx, 2).setUsage(THREE.DynamicDrawUsage), aFx = new THREE.InstancedBufferAttribute(bFx, 3).setUsage(THREE.DynamicDrawUsage);
  bgeo.setAttribute('iPos', aPos); bgeo.setAttribute('iPar', aPar); bgeo.setAttribute('iCol', aCol); bgeo.setAttribute('iEx', aEx); bgeo.setAttribute('iFx', aFx);
  const bmat = new THREE.ShaderMaterial({
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `attribute vec3 iPos; attribute vec4 iPar; attribute vec3 iCol; attribute vec2 iEx; attribute vec3 iFx; uniform vec2 uRes;
      varying vec2 vUv; varying vec4 vPar; varying vec3 vCol; varying vec2 vEx; varying vec3 vFx;
      void main(){ vec4 c = projectionMatrix * viewMatrix * vec4(iPos, 1.0); c.xy += position.xy * iPar.zw / uRes * 2.0 * c.w; gl_Position = c; vUv = position.xy + 0.5; vPar = iPar; vCol = iCol; vEx = iEx; vFx = iFx; }`,
    // vPar = (solid fraction, shield, width px, height px) · vEx = (ticks, mana) · vFx = (end of red damage tail, end of white heal preview, how fresh the cut is)
    fragmentShader: `varying vec2 vUv; varying vec4 vPar; varying vec3 vCol; varying vec2 vEx; varying vec3 vFx;
      void main(){
        vec2 px = vUv * vPar.zw; vec2 e = min(px, vPar.zw - px);
        float border = step(min(e.x, e.y), 1.2);
        float manaH = vEx.y > 0.0 ? 0.3 : 0.0;
        vec3 c = vec3(0.02, 0.025, 0.035);
        if (vUv.y > manaH) {
          float f = vUv.x, yy = (vUv.y - manaH) / (1.0 - manaH), endHp = max(vPar.x, max(vFx.x, vFx.y));
          if (f < vPar.x) c = vCol * (0.55 + 0.45 * yy);
          else if (f < vFx.y) c = vec3(0.95, 0.98, 1.0) * (0.75 + 0.25 * yy);                              // healing arrives as white, then turns solid
          else if (f < vFx.x) c = mix(vec3(0.5, 0.03, 0.02), vec3(1.0, 0.16, 0.08), 0.35 + 0.65 * vFx.z) * (0.7 + 0.3 * yy);   // the chunk just lost, cut loose and burning away
          else if (f < endHp + vPar.y) c = vec3(0.7, 0.78, 0.9);                                            // shield
          if (vEx.x > 0.0) { float tk = fract(f * vEx.x); c *= (tk < 0.035 * vEx.x * 0.25 + 0.02 && f < vPar.x) ? 0.35 : 1.0; }
          float cut = (f - vPar.x) * vPar.z + (yy - 0.5) * vPar.w * 0.9;                                    // a slanted bright nick where the blade went in
          c += vec3(1.0, 0.9, 0.8) * smoothstep(2.6, 0.0, abs(cut)) * vFx.z * step(vPar.x, vFx.x - 0.001) * 1.4;
        } else if (vUv.x < vEx.y) c = vec3(0.16, 0.42, 0.95);
        c = mix(c, vec3(0.0), border * 0.85);
        gl_FragColor = vec4(c, 0.92);
      }`,
  });
  const bars = new THREE.Mesh(bgeo, bmat); bars.frustumCulled = false; bars.renderOrder = 50; bars.userData.noAO = true; bars.userData.overlay = true; scene.add(bars);
  R.onResize.push(s => bmat.uniforms.uRes.value.set(s.w, s.h));
  bmat.uniforms.uRes.value.set(R.size.w, R.size.h);
  let bn = 0;
  fx.barsBegin = () => { bn = 0; };
  // frac = hp fraction, sh = shield fraction, w/h px, color [r,g,b], ticks = segment count (0 none), mana = mana fraction (0 none)
  fx.bar = (x, y, z, frac, sh, w, h, c, ticks = 0, mana = 0, lag = 0, healTo = 0, cut = 0) => {
    if (bn >= BMAX) return; const i = bn++;
    bPos[i * 3] = x; bPos[i * 3 + 1] = y; bPos[i * 3 + 2] = z;
    bPar[i * 4] = frac; bPar[i * 4 + 1] = sh; bPar[i * 4 + 2] = w; bPar[i * 4 + 3] = h;
    bCol[i * 3] = c[0]; bCol[i * 3 + 1] = c[1]; bCol[i * 3 + 2] = c[2]; bEx[i * 2] = ticks; bEx[i * 2 + 1] = mana; bFx[i * 3] = lag; bFx[i * 3 + 1] = healTo; bFx[i * 3 + 2] = cut;
  };
  fx.barsEnd = () => { bgeo.instanceCount = bn; aPos.needsUpdate = aPar.needsUpdate = aCol.needsUpdate = aEx.needsUpdate = aFx.needsUpdate = true; };

  // ---------- floating text (DOM, pooled) ----------
  const layer = document.getElementById('floaters');
  const texts = []; for (let i = 0; i < 28; i++) { const el = document.createElement('div'); el.className = 'floater'; layer.appendChild(el); texts.push(el); }
  let ti = 0; const v3 = new THREE.Vector3();
  // name tags: online, each person's name and cultivator over their head (pooled; whatever was not placed this frame hides)
  const tags = []; let tn = 0;
  fx.tagsBegin = () => { tn = 0; };
  fx.tag = (x, y, z, str, cls) => {
    v3.set(x, y, z).project(R.camera); if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) return;
    let el = tags[tn]; if (!el) { el = document.createElement('div'); layer.appendChild(el); tags.push(el); } tn++;
    if (el.dataset.t !== str) { el.textContent = str; el.dataset.t = str; } const c = 'nametag ' + cls; if (el.className !== c) el.className = c;
    el.style.left = ((v3.x * 0.5 + 0.5) * 100).toFixed(2) + '%'; el.style.top = ((-v3.y * 0.5 + 0.5) * 100).toFixed(2) + '%'; el.hidden = false;
  };
  fx.tagsEnd = () => { for (let i = tn; i < tags.length; i++) tags[i].hidden = true; };
  // a line of speech over someone's head: it rises a little and stays long enough to read
  fx.say = (x, y, z, str, ally) => {
    v3.set(x, y, z).project(R.camera); if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) return;
    const el = texts[ti]; ti = (ti + 1) % texts.length;
    el.textContent = '「' + str + '」'; el.className = 'floater say ' + (ally ? 'frost' : 'ember');
    el.style.left = ((v3.x * 0.5 + 0.5) * 100).toFixed(2) + '%'; el.style.top = ((-v3.y * 0.5 + 0.5) * 100).toFixed(2) + '%';
    el.animate([{ opacity: 0, transform: 'translate(-50%,-80%) scale(0.85)' }, { opacity: 1, transform: 'translate(-50%,-130%) scale(1)', offset: 0.1 }, { opacity: 1, transform: 'translate(-50%,-150%) scale(1)', offset: 0.8 }, { opacity: 0, transform: 'translate(-50%,-165%) scale(1)' }], { duration: 2300, easing: 'ease-out', fill: 'forwards' });
  };
  fx.text = (x, y, z, str, cls = '') => {
    v3.set(x, y, z).project(R.camera); if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) return;
    const el = texts[ti]; ti = (ti + 1) % texts.length;
    el.textContent = str; el.className = 'floater ' + cls;
    el.style.left = ((v3.x * 0.5 + 0.5) * 100).toFixed(2) + '%'; el.style.top = ((-v3.y * 0.5 + 0.5) * 100).toFixed(2) + '%';
    const dx = (Math.random() - 0.5) * 30;
    el.animate([{ opacity: 0, transform: `translate(-50%,-30%) scale(0.6)` }, { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.3}px),-90%) scale(1.15)`, offset: 0.15 }, { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.7}px),-160%) scale(1)`, offset: 0.7 }, { opacity: 0, transform: `translate(calc(-50% + ${dx}px),-210%) scale(0.9)` }], { duration: 850, easing: 'ease-out', fill: 'forwards' });
  };


  // ---------- volumes: pillars of light, expanding shock domes, shield bubbles ----------
  const volMat = frag => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uProg: { value: 0 }, uSeed: { value: 0 }, tNoise, uTime },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uProg, uSeed, uTime; uniform sampler2D tNoise; varying vec2 vUv; varying vec3 vN, vV;\n` + frag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const PILLAR = `void main(){ float n = texture2D(tNoise, vec2(vUv.x * 1.5 + uSeed, vUv.y * 0.5 - uTime * 1.1)).r, n2 = texture2D(tNoise, vec2(vUv.x * 4.0 - uSeed, vUv.y * 1.3 - uTime * 2.3)).g;
      float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.3) * (0.25 + 1.1 * n * n + 0.5 * step(0.72, n2)) * (1.0 - uProg) * smoothstep(0.0, 0.08, uProg + 0.04);
      gl_FragColor = vec4(uColor * 1.4, a * 0.85); }`;
  const DOME = `void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
      float n = texture2D(tNoise, vUv * vec2(3.0, 1.0) + uSeed).r;
      float a = (f * 0.8 + smoothstep(0.06, 0.0, abs(vUv.y - 0.52)) * 0.6) * (0.45 + 0.9 * n) * pow(clamp(1.0 - uProg, 0.0, 1.0), 1.5);
      gl_FragColor = vec4(uColor, a); }`;
  const BUBBLE = `float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; p = abs(fract(p) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }
    void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0);
      float cells = smoothstep(0.09, 0.0, hex(vUv * vec2(16.0, 9.0)));
      float sweep = smoothstep(0.12, 0.0, abs(fract(vUv.y * 1.0 - uTime * 0.6) - 0.5)) ;
      float a = f * 0.9 + cells * (0.16 + 0.5 * f + 0.5 * sweep) + 0.04;
      gl_FragColor = vec4(uColor, a * (1.0 - uProg) * (0.85 + 0.15 * sin(uTime * 6.0))); }`;
  const mkPool = (geo, frag, n) => { const a = []; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, volMat(frag)); m.visible = false; m.frustumCulled = false; m.renderOrder = 18; m.userData.noAO = true; scene.add(m); a.push({ m, u: m.material.uniforms, busy: false, t: 0, dur: 1 }); } return a; };
  const pillars = mkPool(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0), PILLAR, 10);
  const domes = mkPool(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), DOME, 8);
  const bubbles = mkPool(new THREE.SphereGeometry(1, 28, 18), BUBBLE, 6);
  const take = (pool, c) => { const v = pool.find(q => !q.busy) || pool[0]; v.busy = true; v.t = 0; v.m.visible = true; v.u.uColor.value.setRGB(c[0], c[1], c[2]); v.u.uProg.value = 0; v.u.uSeed.value = Math.random(); return v; };
  fx.pillar = (x, z, r, h, c, dur = 0.4) => { const v = take(pillars, c); v.dur = dur; v.r = r; v.h = h; v.m.position.set(x, 0.05, z); v.m.scale.set(r, h, r); };
  fx.dome = (x, z, r0, r1, c, dur = 0.4) => { const v = take(domes, c); v.dur = dur; v.r0 = r0; v.r1 = r1; v.m.position.set(x, 0.05, z); v.m.scale.setScalar(r0); };
  fx.bubble = (c, r) => { const v = take(bubbles, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8]); v.dur = 0; v.m.scale.setScalar(r * 0.6); v.r = r; return v; };
  fx.freeBubble = v => { if (v) { v.busy = false; v.m.visible = false; } };
  fx.punchAmt = 0; fx.stopT = 0;
  fx.punch = a => { fx.punchAmt = Math.min(1, Math.max(fx.punchAmt, a)); };
  fx.hitStop = t => { fx.stopT = Math.max(fx.stopT, t); };
  fx.zoomK = 0; fx.zoomIn = a => { fx.zoomK = Math.max(fx.zoomK, a); };            // the camera leans in, then settles back
  fx.slowT = 0; fx.slowDur = 1; fx.slowK = 1;
  fx.slowmo = (dur, k) => { if (dur > fx.slowT) { fx.slowT = fx.slowDur = dur; fx.slowK = k; } };   // the world runs at k for dur seconds of real time, easing back at the end
  function updateVolumes(dt) {
    for (const v of pillars) if (v.busy) { v.t += dt; const p = v.t / v.dur; if (p >= 1) { v.busy = false; v.m.visible = false; continue; } v.u.uProg.value = p; const k = 1 - 0.45 * p; v.m.scale.set(v.r * k, v.h * (0.7 + 0.3 * Math.min(1, p * 5)), v.r * k); v.m.rotation.y += dt * 2; }
    for (const v of domes) if (v.busy) { v.t += dt; const p = v.t / v.dur; if (p >= 1) { v.busy = false; v.m.visible = false; continue; } v.u.uProg.value = p; const e = 1 - (1 - p) * (1 - p); v.m.scale.setScalar(v.r0 + (v.r1 - v.r0) * e); }
    for (const v of bubbles) if (v.busy) { v.t += dt; const s = v.r * Math.min(1, 0.6 + v.t * 3); v.m.scale.setScalar(s); v.m.rotation.y += dt * 0.5; }
    fx.punchAmt = Math.max(0, fx.punchAmt - dt * 3.2);
  }
  const resetVolumes = () => { for (const pool of [pillars, domes, bubbles]) for (const v of pool) { v.busy = false; v.m.visible = false; } fx.punchAmt = 0; fx.stopT = 0; fx.slowT = 0; fx.zoomK = 0; };

  fx.reset = () => { fx.tagsBegin(); fx.tagsEnd(); resetVolumes(); fx.aimHide(); for (const d of pool) fx.release(d); for (const b of bolts) fx.freeBolt(b); for (const s of scorches) s.m.visible = false; for (const s of lights) { s.held = false; s.l.intensity = 0; } life.fill(0); fx.shakeAmt = 0; };
  fx.shake = a => { fx.shakeAmt = Math.min(1.2, fx.shakeAmt + a); };

  fx.update = dt => {
    if (fx.zoomK > 0) fx.zoomK = Math.max(0, fx.zoomK - dt * 1.8);
    updateVolumes(dt);
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) { if (iPar[i * 4] !== 0) { iPar[i * 4] = 0; iCol[i * 4 + 3] = 0; } continue; }
      life[i] -= dt;
      const k = Math.max(0, life[i] / maxLife[i]), b = i * 8, dr = Math.max(0, 1 - P[b + 2] * dt), v = i * 4, p = i * 3, kd = iPar[v + 2];
      iVel[v] *= dr; iVel[v + 2] *= dr; iVel[v + 1] = iVel[v + 1] * dr - P[b + 1] * dt; iVel[v + 3] = k;
      iPos[p] += iVel[v] * dt; iPos[p + 1] += iVel[v + 1] * dt; iPos[p + 2] += iVel[v + 2] * dt;
      if (iPos[p + 1] < 0.06 && P[b + 1] > 0) { iPos[p + 1] = 0.06; iVel[v + 1] *= -0.3; iVel[v] *= 0.6; iVel[v + 2] *= 0.6; }
      iCol[v] = P[b + 5]; iCol[v + 1] = P[b + 6]; iCol[v + 2] = P[b + 7];
      if (kd < 0.5) { iCol[v + 3] = k; iPar[v] = P[b] * (0.35 + 0.65 * k); }
      else { iCol[v + 3] = P[b + 3] * Math.min(1, (1 - k) * 8) * Math.min(1, k * 2.5); iPar[v] = P[b] * (1 + (1 - k) * P[b + 4]); }
    }
    aPos_.needsUpdate = aVel_.needsUpdate = aCol_.needsUpdate = aPar_.needsUpdate = true;
    for (const d of pool) {
      if (!d.busy || d.manual) continue;
      d.t += dt;
      const p = Math.min(1, d.t / d.dur);
      d.u.uProg.value = p;
      const s = d.s0 + (d.s1 - d.s0) * p; d.m.scale.set(s, 1, s); if (d.fade) d.u.uAlpha.value = d.alpha * (1 - p);
      if (d.t > d.dur + d.hold) fx.release(d);
    }
    for (const s of scorches) if (s.m.visible) { s.t += dt; s.u.uProg.value = Math.min(1, s.t / s.dur); if (s.t >= s.dur) s.m.visible = false; }
    for (const s of lights) if (!s.held && s.dur > 0) { s.t += dt; const k = Math.max(0, 1 - s.t / s.dur); s.l.intensity = s.power * k * k; if (k <= 0) s.dur = 0; }
    fx.shakeAmt = Math.max(0, fx.shakeAmt - dt * 2.6);
  };
  return fx;
}
