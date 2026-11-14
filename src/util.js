// util.js — math helpers, seeded RNG, tileable noise data
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function angLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
}

// cheap 2D value noise for placement decisions on the CPU
function h2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, z) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(x0, z0), h2(x0 + 1, z0), sx), lerp(h2(x0, z0 + 1), h2(x0 + 1, z0 + 1), sx), sz);
}

// RGBA tileable noise: R = broad fbm, G = fine fbm, B = smooth (for isoline cracks), A = white
export function makeNoiseData(size = 256, seed = 11) {
  const R = rng(seed);
  const lat = n => { const a = new Float32Array(n * n); for (let i = 0; i < n * n; i++) a[i] = R(); return a; };
  const sample = (a, n, u, v) => {
    const x = u * n, y = v * n, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const i0 = x0 % n, i1 = (x0 + 1) % n, j0 = y0 % n, j1 = (y0 + 1) % n;
    return lerp(lerp(a[j0 * n + i0], a[j0 * n + i1], sx), lerp(a[j1 * n + i0], a[j1 * n + i1], sx), sy);
  };
  const fbm = (base, oct) => {
    const ls = []; for (let o = 0; o < oct; o++) ls.push(lat(base << o));
    return (u, v) => { let s = 0, amp = 0.5, tot = 0; for (let o = 0; o < oct; o++) { s += sample(ls[o], base << o, u, v) * amp; tot += amp; amp *= 0.5; } return clamp((s / tot - 0.5) * 2.0 + 0.5, 0, 1); };
  };
  const fR = fbm(4, 5), fG = fbm(16, 4), fB = fbm(6, 2);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = (y * size + x) * 4;
    data[i] = fR(u, v) * 255; data[i + 1] = fG(u, v) * 255; data[i + 2] = fB(u, v) * 255; data[i + 3] = R() * 255;
  }
  return data;
}
