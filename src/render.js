// render.js — renderer and the HDR post chain: scene → ambient occlusion (GTAO) → volumetric mist with sun shafts
// (ray-marched against the sun's shadow map) → bloom → filmic grade. Quality tiers and dynamic resolution keep it smooth.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { tNoise } from './mat.js';

export const QUALITY = {
  low: { name: 'low', label: '流畅', scale: 0.7, msaa: 0, shadow: 1024, grass: 0.35, maxPx: 1.0e6, ao: false, vol: 0, lights: 2 },
  medium: { name: 'medium', label: '均衡', scale: 0.85, msaa: 2, shadow: 2048, grass: 0.7, maxPx: 1.6e6, ao: true, vol: 10, lights: 4 },
  high: { name: 'high', label: '精致', scale: 1, msaa: 4, shadow: 4096, grass: 1, maxPx: 2.8e6, ao: true, vol: 16, lights: 5 },
};

export function pickQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  if (mobile) return 'low';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software/i.test(name)) return 'low';
  } catch { /* fall through */ }
  return 'high';
}

// low mist that hugs the ground: denser in drifting patches, lit by the sun only where the shadow map says the sun reaches
const VolShader = {
  defines: { STEPS: 16 },
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null }, tShadow: { value: null }, tNoise,
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uShadowMat: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0.9, 0.5, 0.24) }, uFogCol: { value: new THREE.Color(0.045, 0.06, 0.1) },
    uTime: { value: 0 }, uDensity: { value: 0.04 }, uTop: { value: 9 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth, tNoise; uniform highp sampler2DShadow tShadow;
    uniform mat4 uInvProj, uCamWorld, uShadowMat; uniform vec3 uCamPos, uSunDir, uSunCol, uFogCol; uniform float uTime, uDensity, uTop;
    varying vec2 vUv;
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      float d = texture2D(tDepth, vUv).x;
      vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vp /= vp.w;
      vec3 rd = (uCamWorld * vp).xyz - uCamPos; float tMax = min(length(rd), 260.0); rd = normalize(rd);
      float t0 = rd.y < -0.001 ? max(0.0, (uTop - uCamPos.y) / rd.y) : tMax;
      float dt = max(0.0, tMax - t0) / float(STEPS);
      float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uTime * 7.31);
      float cosT = dot(rd, uSunDir);
      float phase = 0.5 + 1.6 * pow(max(cosT, 0.0), 5.0) + 0.3 * (cosT * 0.5 + 0.5);
      vec3 acc = vec3(0.0); float trans = 1.0;
      for (int i = 0; i < STEPS; i++) {
        vec3 p = uCamPos + rd * (t0 + (float(i) + jit) * dt);
        float hgt = clamp(1.0 - p.y / uTop, 0.0, 1.0);
        float n = texture2D(tNoise, p.xz * 0.012 + uTime * vec2(0.007, 0.0035)).r;
        float dens = uDensity * hgt * hgt * (0.15 + 1.9 * n * n);
        vec4 sc = uShadowMat * vec4(p, 1.0); sc.xyz /= sc.w;
        float lit = 1.0;
        if (sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) lit = texture(tShadow, vec3(sc.xy, sc.z - 0.0015));
        float cloud = mix(0.5, 1.0, smoothstep(0.3, 0.6, texture2D(tNoise, p.xz * 0.0042 + uTime * vec2(0.0032, 0.0019)).r));
        float a = 1.0 - exp(-dens * dt);
        acc += trans * a * (uSunCol * lit * cloud * phase + uFogCol);
        trans *= 1.0 - a;
      }
      float far = 1.0 - exp(-pow(tMax * 0.0062, 2.0));                      // aerial perspective beyond the arena
      vec3 c = col.rgb * trans + acc;
      c = mix(c, uFogCol * 0.55, far * 0.85);
      gl_FragColor = vec4(c.r == c.r && c.g == c.g && c.b == c.b ? min(c, vec3(60.0)) : vec3(0.0), col.a);   // a single bad pixel would otherwise bloom across the whole frame
    }`,
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uTime: { value: 0 }, uHurt: { value: 0 }, uSat: { value: 1.0 }, uFade: { value: 0 }, uPunch: { value: 0 }, uInk: { value: 0.6 }, uLine: { value: 0 }, uPx: { value: new THREE.Vector2(0.001, 0.001) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform float uTime, uHurt, uSat, uFade, uPunch, uInk, uLine; uniform vec2 uPx; varying vec2 vUv;
    float lin(vec2 uv){ float d = texture2D(tDepth, uv).x; return 400.0 / (400.0 - d * 399.0); }   // view depth for near 1, far 400
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453), c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r = length(c);
      vec2 off = c * r * r * (0.006 + 0.03 * uHurt) + c * uPunch * 0.012;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1.45 * (1.0 + uPunch * 0.55);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = aces(col);
      // split tone: cold shadows, warm highlights
      float ll = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += vec3(-0.012, 0.004, 0.026) * (1.0 - smoothstep(0.0, 0.4, ll)) + vec3(0.028, 0.01, -0.02) * smoothstep(0.45, 1.0, ll);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.3);
      // --- a touch of ink wash ---
      float lw = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, mix(vec3(lw) * vec3(1.03, 1.0, 0.94), col, 0.74), uInk);                 // colour thinned like pigment in water, on warm paper
      if (uLine > 0.5) {                                                                      // ink lines where depth breaks: silhouettes of people, towers, rocks
        float d0 = lin(vUv), w = 1.0 + 0.9 * vn(vUv / uPx / 90.0);                            // the brush presses harder in places
        float e = abs(lin(vUv + vec2(uPx.x, 0.0) * w) - lin(vUv - vec2(uPx.x, 0.0) * w)) + abs(lin(vUv + vec2(0.0, uPx.y) * w) - lin(vUv - vec2(0.0, uPx.y) * w));
        float edge = smoothstep(0.018, 0.07, e / d0) * (0.55 + 0.45 * vn(vUv / uPx / 14.0));
        col = mix(col, col * vec3(0.16, 0.15, 0.17), edge * uInk * 1.15);
      }
      col *= 1.0 + (vn(vUv / uPx / 2.6) - 0.5) * 0.07 * uInk + (vn(vec2(vUv.x / uPx.x / 1.3, vUv.y / uPx.y / 40.0)) - 0.5) * 0.045 * uInk;   // paper tooth and long fibres
      col *= mix(0.42, 1.0, smoothstep(0.95, 0.3, r * 1.2));
      col = mix(col, vec3(0.6, 0.03, 0.0), uHurt * smoothstep(0.2, 0.7, r) * 0.55);
      col *= 1.0 - uFade;
      col = pow(max(col, 0.0), vec3(1.0 / 2.2));
      col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.03;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createRender(canvas, qualityName) {
  const R = { quality: { ...QUALITY[qualityName] || QUALITY.high } };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;       // once per frame, not once per pass
  renderer.setClearColor(0x05080c, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b1018, 0.0035);
  scene.background = new THREE.Color(0x0b1018);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 400);

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: R.quality.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.updateGtaoMaterial({ radius: 2.4, distanceExponent: 1.5, thickness: 1.4, scale: 1.35, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
  gtao._overrideVisibility = function () { // also leave out leaf cards, grass, decals, particles: they are not solid occluders
    const cache = this._visibilityCache;
    this.scene.traverse(o => { if ((o.isPoints || o.isLine || o.userData.noAO) && o.visible) { o.visible = false; cache.push(o); } });
  };
  composer.addPass(gtao);
  const vol = new ShaderPass(VolShader);
  composer.addPass(vol);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.34, 0.6, 1.15);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  function applyTier() {
    gtao.enabled = R.quality.ao; vol.enabled = R.quality.ao && R.quality.vol > 0;
    if (vol.enabled && vol.material.defines.STEPS !== R.quality.vol) { vol.material.defines.STEPS = R.quality.vol; vol.material.needsUpdate = true; }
  }
  applyTier();

  // dynamic resolution: hold ~60 fps by trading pixels, then by dropping a quality tier
  const dyn = { scale: 1, acc: 0, n: 0, settle: 3, upWait: 4, floorHits: 0, enabled: true };
  R.size = { w: 2, h: 2, pw: 2, ph: 2 };
  R.onResize = [];
  function resize() {
    const w = Math.max(2, canvas.clientWidth || innerWidth), h = Math.max(2, canvas.clientHeight || innerHeight);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let s = R.quality.scale * dyn.scale;
    const px = w * dpr * h * dpr * s * s;
    if (px > R.quality.maxPx) s *= Math.sqrt(R.quality.maxPx / px);
    const pr = dpr * s;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    R.size = { w, h, pw: Math.round(w * pr), ph: Math.round(h * pr) }; grade.uniforms.uPx.value.set(1 / (w * pr), 1 / (h * pr));
    for (const f of R.onResize) f(R.size);
  }
  function setQuality(name) {
    R.quality = { ...QUALITY[name] };
    dyn.scale = 1; dyn.settle = 2;
    applyTier(); resize();
    if (R.onQuality) R.onQuality(R.quality);
  }
  function adapt(ms) {
    if (!dyn.enabled || ms > 1500) return;
    dyn.settle -= ms / 1000; dyn.upWait -= ms / 1000;
    if (dyn.settle > 0) { dyn.acc = 0; dyn.n = 0; return; }
    dyn.acc += ms; dyn.n++;
    if (dyn.n < 40 && dyn.acc < 900) return;
    const avg = dyn.acc / dyn.n; dyn.acc = 0; dyn.n = 0;
    let s = dyn.scale;
    if (avg > 21.5 && s > 0.6) { if (s >= 1) dyn.before = avg; s = Math.max(0.6, s - (avg > 30 ? 0.2 : 0.1)); dyn.upWait = 8; }
    else if (avg < 17.4 && s < 1 && dyn.upWait <= 0) { s = Math.min(1, s + 0.1); dyn.upWait = 4; }
    s = Math.round(s * 10) / 10;
    // fewer pixels did not help: the frame rate is capped by something else (power saving, background tab) — give the pixels back
    if (s <= 0.6 && dyn.scale <= 0.6 && dyn.before && avg > dyn.before * 0.85) { dyn.scale = 1; dyn.enabled = false; resize(); return; }
    if (s <= 0.6 && avg > 26) {
      const next = { high: 'medium', medium: 'low' }[R.quality.name];
      if (++dyn.floorHits >= 2 && next) { dyn.floorHits = 0; setQuality(next); return; }
    } else dyn.floorHits = 0;
    if (s !== dyn.scale) { dyn.scale = s; dyn.settle = 1; resize(); }
  }

  Object.assign(R, {
    renderer, scene, camera, composer, grade: grade.uniforms, bloom, gtao, vol, dyn, resize, setQuality, adapt, sun: null,
    render(time) {
      grade.uniforms.uTime.value = time;
      renderer.shadowMap.needsUpdate = true;
      grade.uniforms.tDepth.value = gtao.depthTexture; grade.uniforms.uLine.value = R.quality.ao ? 1 : 0;
      const sun = R.sun, u = vol.uniforms;
      if (vol.enabled || R.quality.vol > 0) {
        const ok = R.quality.ao && sun && sun.shadow.map && sun.shadow.map.depthTexture;
        vol.enabled = !!ok;
        if (ok) {
          camera.updateMatrixWorld();
          u.tDepth.value = gtao.depthTexture; u.tShadow.value = sun.shadow.map.depthTexture; u.uShadowMat.value.copy(sun.shadow.matrix);
          u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uCamWorld.value.copy(camera.matrixWorld); u.uCamPos.value.copy(camera.position);
          u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize(); u.uTime.value = time;
        }
      }
      composer.render();
    },
  });
  addEventListener('resize', resize);
  resize();
  return R;
}
