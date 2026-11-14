// mat.js — one vertex-coloured PBR material for everything built from primitives, plus the tiny modelling kit.
// Each vertex carries a colour and a surface kind (paint / metal / cloth / skin / stone / wood / rock). The shader turns that
// into a believable surface with tri-planar procedural detail: mottling, scratches, weave, masonry joints, wood grain, cracks,
// moss / snow / soot on upward faces, grime near the ground, micro bump. Colours above 1.0 are emissive. No texture files.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeNoiseData } from './util.js';

export const uTime = { value: 0 };
const noiseTex = new THREE.DataTexture(makeNoiseData(256), 256, 256, THREE.RGBAFormat);
noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping; noiseTex.minFilter = THREE.LinearMipmapLinearFilter; noiseTex.magFilter = THREE.LinearFilter;
noiseTex.generateMipmaps = true; noiseTex.needsUpdate = true;
export const tNoise = { value: noiseTex };

// shared by every lit shader: drifting cloud shadows and derivative bump mapping
export const COMMON_GLSL = `
  float cloudShade(vec2 p){ float c = texture2D(tNoise, p * 0.0042 + uTime * vec2(0.0032, 0.0019)).r; return mix(0.58, 1.0, smoothstep(0.3, 0.6, c)); }
  vec3 bumpNormal(vec3 sp, vec3 sn, vec2 dH){
    vec3 sx = dFdx(sp), sy = dFdy(sp);
    vec3 r1 = cross(sy, sn), r2 = cross(sn, sx);
    float det = dot(sx, r1);
    return normalize(abs(det) * sn - sign(det) * (dH.x * r1 + dH.y * r2));
  }`;

const DETAIL = `
  {
    vec3 tw = pow(abs(normalize(vON)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
    vec4 nM = texture2D(tNoise, vOP.yz * 0.31) * tw.x + texture2D(tNoise, vOP.xz * 0.31) * tw.y + texture2D(tNoise, vOP.xy * 0.31) * tw.z;
    vec4 nF = texture2D(tNoise, vOP.yz * 1.7) * tw.x + texture2D(tNoise, vOP.xz * 1.7) * tw.y + texture2D(tNoise, vOP.xy * 1.7) * tw.z;
    vec3 a = diffuseColor.rgb; float r = roughnessFactor, m = 0.0, b = 0.0;
    if (emk > 0.0) { r = 0.35; }
    else if (vMat < 0.5) { a *= 0.8 + 0.4 * nF.g; r = 0.5 + 0.3 * nM.r; b = nF.g * 0.25; }                       // painted / lacquered
    else if (vMat < 1.5) {                                                                                    // metal: tarnish, scratches
      float tarn = smoothstep(0.52, 0.8, nM.g), scr = smoothstep(0.6, 0.85, nF.g);
      a *= 0.78 + 0.34 * nM.r; a = mix(a, a * vec3(0.5, 0.44, 0.38), tarn * 0.65);
      r = 0.24 + 0.26 * nM.r + 0.3 * tarn + 0.15 * scr; m = 0.95 - 0.35 * tarn; b = nF.g * 0.2 + tarn * 0.3;
    }
    else if (vMat < 2.5) { a *= 0.66 + 0.6 * nF.g; a *= 0.8 + 0.3 * nM.r; r = 0.94; b = nF.g * 0.7; }              // cloth: weave, fading
    else if (vMat < 3.5) { a *= 0.9 + 0.18 * nF.g; r = 0.58; }                                                 // skin
    else if (vMat < 4.5) {                                                                                    // dressed stone: courses, joints, cracks
      float cy = abs(fract(vOP.y * 1.15 + 0.2) - 0.5), row = floor(vOP.y * 1.15 + 0.2);
      float ang = atan(vOP.z, vOP.x) * 2.55 + row * 0.5;
      float joint = max(smoothstep(0.44, 0.49, cy), smoothstep(0.455, 0.495, abs(fract(ang) - 0.5)) * step(0.6, length(vOP.xz)));
      float crack = 1.0 - smoothstep(0.0, 0.035, abs(nM.b - 0.5));
      float blockTint = fract(sin(dot(vec2(row, floor(ang)), vec2(12.9898, 78.233))) * 43758.5453);
      a *= (0.55 + 0.75 * nM.r) * (0.82 + 0.3 * blockTint); a *= 1.0 - 0.55 * joint - 0.45 * crack * (1.0 - joint);
      r = 0.8 + 0.2 * nF.g; b = nF.g * 0.5 + nM.r * 0.4 - joint * 1.6 - crack * 0.8;
    }
    else if (vMat < 5.5) {                                                                                    // bark / timber: vertical grain
      float grain = texture2D(tNoise, vec2((vOP.x + vOP.z) * 2.6, vOP.y * 0.22)).g, knots = texture2D(tNoise, vec2(vOP.x - vOP.z, vOP.y * 0.6) * 0.7).r;
      a *= 0.42 + 0.9 * grain; a *= 0.75 + 0.5 * knots; r = 0.93; b = grain * 1.4 + knots * 0.5;
    }
    else {                                                                                                    // natural rock: strata, fractures
      float strata = texture2D(tNoise, vec2(nM.r * 0.6, vOP.y * 0.55 + nM.g * 0.25)).r;
      float crack = 1.0 - smoothstep(0.0, 0.03, abs(nM.b - 0.5));
      a *= 0.5 + 0.6 * nM.r + 0.4 * strata; a = mix(a, a * vec3(0.62, 0.55, 0.48), smoothstep(0.5, 0.8, nF.r) * 0.6); a *= 1.0 - 0.55 * crack;
      r = 0.84 + 0.16 * nF.g; b = nM.r * 1.6 + strata * 0.8 + nF.g * 0.5 - crack * 1.2;
    }
    if (uWorld > 0.5 && vMat > 3.5 && emk <= 0.0) {                                                           // weathering of things that stand in the world
      vec3 wn = inverseTransformDirection(normalize(vNormal), viewMatrix);
      float up = smoothstep(0.25, 0.7, wn.y + (nF.g - 0.5) * 0.5);
      float bx = vWP.x + (nM.r - 0.5) * 16.0, fr = 1.0 - smoothstep(-52.0, -16.0, bx), em = smoothstep(16.0, 52.0, bx);
      vec3 cover = mix(vec3(0.06, 0.1, 0.03), vec3(0.42, 0.48, 0.56), fr); cover = mix(cover, vec3(0.05, 0.042, 0.038), em);
      float amt = up * mix(smoothstep(0.3, 0.55, nM.g), 1.0, fr * 0.85);
      a = mix(a, cover * (0.7 + 0.6 * nF.g), amt * 0.88); r = mix(r, mix(1.0, 0.5, fr), amt); b = mix(b, nF.g * 0.6, amt);
      a *= mix(0.42, 1.0, smoothstep(-0.2, 1.8, vWP.y + nM.r * 0.8));
      a = mix(a, a * vec3(0.5, 0.42, 0.36), smoothstep(0.55, 0.9, texture2D(tNoise, vec2((vOP.x + vOP.z) * 0.9, vOP.y * 0.06)).g) * (1.0 - amt) * 0.6); // rain streaks
    }
    diffuseColor.rgb = a; roughnessFactor = clamp(r, 0.06, 1.0); metalnessFactor = m; vcBump = b;
  }`;

export function vcMat(o = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.62, metalness: 0, side: o.side ?? THREE.FrontSide });
  const u = m.userData.u = { uFlash: { value: 0 }, uRim: { value: new THREE.Color(o.rim ?? 0x000000) }, uTime, tNoise, uWorld: { value: o.world ? 1 : 0 }, uSway: { value: 0 } };
  const wind = o.wind || 0, plain = !!o.plain, cape = o.cape || null;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uSway; attribute float aMat; varying float vMat; varying vec3 vOP, vON, vWP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vMat = aMat; vOP = position; vON = normal;
        ${cape ? `float cf = clamp((${cape.top.toFixed(3)} - position.y) / ${cape.len.toFixed(3)}, 0.0, 1.0);
        transformed.z -= cf * cf * (0.1 + uSway * 0.8) + sin(uTime * 3.1 + position.x * 4.0 + cf * 5.0) * 0.05 * cf * (1.0 + uSway * 1.6);
        transformed.x += sin(uTime * 2.3 + cf * 6.0) * 0.03 * cf;` : ''}
        #ifdef USE_INSTANCING
          vOP += instanceMatrix[3].xyz * 0.37;
          ${wind ? `float wph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
          transformed.x += (sin(uTime * 1.3 + wph) * 0.6 + sin(uTime * 2.7 + wph * 1.7) * 0.4) * position.y * ${wind.toFixed(3)};
          transformed.z += cos(uTime * 1.1 + wph) * position.y * ${(wind * 0.5).toFixed(3)};` : ''}
        #endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpv = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpv = instanceMatrix * wpv;
        #endif
        vWP = (modelMatrix * wpv).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tNoise; uniform float uTime, uFlash, uWorld; uniform vec3 uRim; varying float vMat; varying vec3 vOP, vON, vWP; float vcBump = 0.0;\n' + COMMON_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float emk = max(0.0, max(vColor.r, max(vColor.g, vColor.b)) - 1.0);
        diffuseColor.rgb = min(diffuseColor.rgb, vec3(1.0));`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + (plain ? '' : DETAIL))
      .replace('#include <normal_fragment_maps>', plain ? '' : 'normal = bumpNormal(-vViewPosition, normal, vec2(dFdx(vcBump), dFdy(vcBump)) * 0.05);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * emk * 1.5;`)
      .replace('#include <opaque_fragment>', `
        float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
        outgoingLight = (outgoingLight - totalEmissiveRadiance) * cloudShade(vWP.xz) + totalEmissiveRadiance;
        outgoingLight += uRim * rimF * 0.32 + vec3(1.0, 0.92, 0.85) * uFlash;
        outgoingLight = min(outgoingLight, vec3(12.0));
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'vc' + wind + (plain ? 'p' : 'd') + (cape ? 'c' + cape.top + '_' + cape.len : '');
  return m;
}

// ---- tiny modelling kit: collect coloured primitives, merge into one geometry ----
export const K = { paint: 0, metal: 1, cloth: 2, skin: 3, stone: 4, wood: 5, rock: 6 };
let curKind = 0;
export const kind = k => { curKind = k; };
const col = new THREE.Color();
export function part(list, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, glow = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  if (Array.isArray(color)) col.setRGB(color[0], color[1], color[2]); else col.set(color);
  const k = glow ? glow / Math.max(col.r, col.g, col.b, 1e-3) : 1; // glow = target peak value (>1 → emissive)
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(n).fill(curKind), 1));
  list.push(g);
  return g;
}
export const build = list => { const g = mergeGeometries(list, false); for (const p of list) p.dispose(); return g; };

export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  sph: (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs),
  cyl: (rt, rb, h, seg = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open),
  cone: (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg),
  cap: (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg),
  ico: (r, d = 2) => new THREE.IcosahedronGeometry(r, d),
  oct: (r, d = 0) => new THREE.OctahedronGeometry(r, d),
  tor: (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc),
};
