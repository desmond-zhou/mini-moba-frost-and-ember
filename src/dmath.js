// dmath.js — arithmetic that gives the same answer on every machine, so that every player's copy of a match plays out alike.
//
// Online play (V3) runs the whole match on every player's machine and only sends what each player does: if two machines ever
// computed a different number, their matches would drift apart. + − × ÷ and Math.sqrt are exact in every browser, but
// Math.sin, cos, atan2 and hypot are not: Chrome, Safari and Firefox may each round the last digit differently.
// So the modules that decide what happens (game, config, util, world) use this object in place of Math:
//     import { DMath as Math } from './dmath.js';
// It is the ordinary Math with sin / cos / atan / atan2 / hypot rebuilt from exact operations, and random() drawn from the
// match's own seeded generator. Anything purely for show (sparks, chatter, which bark to say) uses vis() instead, so that
// the effects one player happens to see never move the match's dice.
//
// sin, cos and atan follow trigfills (Andrew Strain, Apache-2.0): reduce the angle, then a short polynomial.

const N = globalThis.Math;
const tau = N.PI * 2, pi = N.PI, hpi = N.PI * 0.5, qpi = N.PI * 0.25, sq3 = 1.7320508075688772, f3 = 1 / 3;

const f24 = 100000 / 2399999, f720 = 100000 / 71998376, f40k = 1000 / 40578583;
const costay = x => { const x2 = x * x, x4 = x2 * x2; return 1 - x2 * 0.5 + x4 * f24 - x2 * x4 * f720 + x4 * x4 * f40k; };
const fh6 = 100000000 / 600000005, f120 = 1 / 120, f5k = 1000 / 5039680, f362k = 10 / 3628880;
const sintay = x => { const c = x * x * x; return x - c * fh6 + c * x * x * f120 - c * c * x * f5k + c * c * c * f362k; };

function sin(x) {
  x = x - N.floor(x / tau) * tau;
  if (x < pi) { if (x >= hpi) x = pi - x; return x > qpi ? costay(hpi - x) : sintay(x); }
  x -= pi; if (x >= hpi) x = pi - x;
  return x > qpi ? -costay(hpi - x) : -sintay(x);
}
const cos = x => sin(hpi - x);

const ff3 = 100000000000 / 299999999177, ff5 = 10000000 / 50000082, ff7 = 100000 / 700011, ff9 = 10000 / 90019, ff11 = 1000 / 11768;
function atan(x) {
  let neg = false, inv = false, shift = false;
  if (x < 0) { neg = true; x = -x; }
  if (x > 1) { x = 1 / x; inv = true; }
  if (x > 0.26794919) { x = (sq3 * x - 1) / (sq3 + x); shift = true; }
  const x2 = x * x, x4 = x2 * x2, x8 = x4 * x4;
  x = x - x * x2 * ff3 + x4 * x * ff5 - x4 * x2 * x * ff7 + x8 * x * ff9 - x8 * x2 * x * ff11;
  if (shift) x += hpi * f3;
  if (inv) x = hpi - x;
  return neg ? -x : x;
}
function atan2(y, x) {
  if (x > 0) return atan(y / x);
  if (x < 0) return y >= 0 ? atan(y / x) + pi : atan(y / x) - pi;
  return y > 0 ? hpi : y < 0 ? -hpi : 0;
}
function hypot(a, b, c) { return c === undefined ? N.sqrt(a * a + b * b) : N.sqrt(a * a + b * b + c * c); }

// the match's dice: mulberry32, reseeded at the start of every match
let s = 1;
function random() {
  s = (s + 0x6D2B79F5) >>> 0; let t = s;
  t = N.imul(t ^ (t >>> 15), t | 1); t ^= t + N.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const seedSim = seed => { s = seed >>> 0; };
export const simState = () => s;
export const vis = () => N.random();                                  // for show only: never decides anything

export const DMath = Object.freeze(Object.assign(Object.create(null),
  Object.fromEntries(Object.getOwnPropertyNames(N).map(k => [k, N[k]])),
  { sin, cos, atan, atan2, hypot, random }));
