// tune.mjs — propose per-mode stat nudges from batch results, keeping each cultivator's two modes close together.
//   node tune.mjs "runs/a_s*.jsonl,runs/b_s*.jsonl" "runs/a_t*.jsonl" [--write]     (comma-separated globs are pooled)
// Reads win rates per cultivator in each mode, moves that mode's multipliers a damped step toward 50%, clamps them to
// [LO, HI], leaves alone anything within DEAD standard errors of 50%, and pulls the two modes' values for the same stat to within GAP of each other. Mechanics are never touched.
import fs from 'fs';
import { HEROES, HERO_ORDER, MODES } from './src/config.js';
const [sGlob, tGlob, flag] = process.argv.slice(2), LO = 0.9, HI = 1.15, GAP = 0.08, STEP = 0.45, DEAD = 1.3;
const files = gs => gs.split(',').flatMap(files1), files1 = g => { const dir = g.slice(0, g.lastIndexOf('/')) || '.', re = new RegExp('^' + g.slice(g.lastIndexOf('/') + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); return fs.readdirSync(dir).filter(f => re.test(f)).map(f => dir + '/' + f); };
const rates = g => { const W = {}; for (const f of files(g)) for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(x => x[0] === '{')) { const r = JSON.parse(l); for (const h of r.heroes) { const o = W[h.id] || (W[h.id] = [0, 0]); o[1]++; if (r.win === h.team) o[0]++; } } return W; };
const S = rates(sGlob), T = rates(tGlob), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), out = { single: {}, tri: {} };
console.log('修士        一路胜率(局)  三路胜率(局)   一路修正 → 新            三路修正 → 新');
for (const id of HERO_ORDER) {
  const d = HEROES[id], cur = { single: MODES.single.heroTune[id] || {}, tri: MODES.tri.heroTune[id] || {} }, nw = { single: {}, tri: {} }, w = { single: S[id], tri: T[id] }, main = cur.single.pow || cur.tri.pow ? 'pow' : d.apG > 0 ? 'ap' : 'ad';   // a cultivator whose kit barely scales with stats is given `pow` by hand and tuned on that
  for (const m of ['single', 'tri']) { const n = w[m] ? w[m][1] : 0, r0 = n >= 20 ? w[m][0] / n : 0.5, r = Math.abs(r0 - 0.5) < DEAD * 0.5 / Math.sqrt(n || 1) ? 0.5 : r0, step = clamp((0.5 - r) * STEP, -0.07, 0.09); nw[m][main] = clamp((cur[m][main] || 1) * (1 + step), LO, HI); nw[m].hp = clamp((cur[m].hp || 1) * (1 + step * 0.5), LO, HI); }
  for (const k of [main, 'hp']) { for (const m of ['single', 'tri']) nw[m][k] = Math.abs(nw[m][k] - 1) < 0.015 ? 1 : +nw[m][k].toFixed(2); const a = nw.single[k], b = nw.tri[k], s = Math.sign(a - b); if (Math.abs(a - b) > GAP + 1e-9) { if (Math.abs(a - 1) >= Math.abs(b - 1)) nw.single[k] = +(b + s * GAP).toFixed(2); else nw.tri[k] = +(a - s * GAP).toFixed(2); } }   // the one further from 1 gives way
  const fmt = o => '{ ' + Object.entries(o).filter(([, v]) => Math.abs(v - 1) >= 0.015).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join(', ') + ' }';
  for (const m of ['single', 'tri']) { const o = {}; for (const [k, v] of Object.entries(nw[m])) if (Math.abs(v - 1) >= 0.015) o[k] = +v.toFixed(2); if (Object.keys(o).length) out[m][id] = o; }
  const pr = x => (x ? `${(x[0] / x[1] * 100).toFixed(0)}% (${x[1]})` : '-').padEnd(12);
  console.log(d.name.padEnd(5, '　'), pr(S[id]), pr(T[id]), (fmt(cur.single) + ' → ' + fmt(nw.single)).padEnd(46), fmt(cur.tri) + ' → ' + fmt(nw.tri));
}
const lit = o => '{ ' + Object.entries(o).map(([id, v]) => `${id}: { ${Object.entries(v).map(([k, x]) => `${k}: ${x}`).join(', ')} }`).join(', ') + ' }';
console.log('\nsingle heroTune: ' + lit(out.single) + '\ntri heroTune: ' + lit(out.tri));
if (flag === '--write') {
  let s = fs.readFileSync('src/config.js', 'utf8'); const a = s.indexOf("id: 'single'"), b = s.indexOf("id: 'tri'");
  const sub = (from, to, o) => { const i = s.indexOf('heroTune: {', from), j = (() => { let depth = 0; for (let k = s.indexOf('{', i); k < s.length; k++) { if (s[k] === '{') depth++; else if (s[k] === '}' && --depth === 0) return k + 1; } })(); if (i < 0 || i > to) throw new Error('heroTune not found'); s = s.slice(0, i) + 'heroTune: ' + lit(o) + s.slice(j); };
  sub(b, s.length, out.tri); sub(a, s.indexOf("id: 'tri'"), out.single); fs.writeFileSync('src/config.js', s); console.log('written to src/config.js');
}
