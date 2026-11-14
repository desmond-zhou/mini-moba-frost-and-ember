// analyze.mjs — summarise batch.mjs output: node analyze.mjs runs/*.jsonl
import fs from 'fs';
const rows = process.argv.slice(2).flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l)));
const H = {}, n = rows.length; let fw = 0, ew = 0, dr = 0, T = 0, stomp = 0, close = 0, kd = 0, lv = 0;
const dur = [];
for (const r of rows) {
  if (r.win === 0) fw++; else if (r.win === 1) ew++; else dr++;
  T += r.t; dur.push(r.t); const tot = r.kills[0] + r.kills[1], df = Math.abs(r.kills[0] - r.kills[1]); kd += tot;
  if (tot >= 6 && df / tot > 0.6) stomp++; if (tot >= 6 && df / tot < 0.25) close++;
  for (const h of r.heroes) { const o = H[h.id] || (H[h.id] = { g: 0, w: 0, k: 0, d: 0, a: 0, dealt: 0, lv: 0 }); o.g++; if (r.win === h.team) o.w++; o.k += h.k; o.d += h.d; o.a += h.a; o.dealt += h.dealt / (r.t / 60); o.lv += h.lv; lv += h.lv; }
}
dur.sort((a, b) => a - b);
const f = (x, d = 1) => x.toFixed(d);
console.log(`matches ${n} | frost ${fw} ember ${ew} unfinished ${dr} | length avg ${f(T / n / 60)} min, median ${f(dur[n >> 1] / 60)}, min ${f(dur[0] / 60)}, max ${f(dur[n - 1] / 60)} | kills/match ${f(kd / n)} | stomps ${f(stomp / n * 100, 0)}% close ${f(close / n * 100, 0)}%`);
console.log('hero        games  win%   K     D     A    KDA   dmg/min');
for (const [id, o] of Object.entries(H).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g)) console.log(id.padEnd(11), String(o.g).padStart(4), f(o.w / o.g * 100, 0).padStart(6), f(o.k / o.g).padStart(5), f(o.d / o.g).padStart(5), f(o.a / o.g).padStart(5), f((o.k + o.a) / Math.max(1, o.d), 2).padStart(6), f(o.dealt / o.g, 0).padStart(7));
