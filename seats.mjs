// seats.mjs — which seat suits which cultivator. Reads batch output where the tracked hero ("me") was forced into a seat
// (node batch.mjs <n> <off> <maxT> mirror tri <seat>) and compares each cultivator in a seat with the others in that seat.
import fs from 'fs';
const SEAT = ['镇关', '中军', '养剑', '护法', '巡山'], NAME = { warden: '韩不语', keeper: '周远川', bloodlord: '血屠子', berserker: '老铁', shade: '柳红衣', archer: '沈焰', ranger: '苏紫烟', gunner: '吴镇岳', mage: '周易', cryo: '寒漪', storm: '沈渊', healer: '孙伯', yanzhao: '言照雪', yuanshan: '周远山', qingya: '陆青崖', wenren: '闻人遥', linshuang: '林霜', peiji: '裴寂' };
const C = {};                                                                      // C[seat][hero] = sums
for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(x => x[0] === '{')) {
  const r = JSON.parse(l), me = r.heroes.find(h => h.me); if (!me || !me.seat) continue; const min = r.t / 60, s = SEAT.indexOf(me.seat);
  const o = ((C[s] = C[s] || {})[me.id] = C[s][me.id] || { n: 0, win: 0, gpm: 0, dpm: 0, k: 0, d: 0, a: 0 });
  o.n++; o.win += r.win === me.team ? 1 : 0; o.gpm += me.earned / min; o.dpm += me.dealt / min; o.k += me.k; o.d += me.d; o.a += me.a;
}
const heroes = Object.keys(NAME), M = {};                                           // M[hero][seat] = index, 1.00 = average for that seat
for (let s = 0; s < 5; s++) {
  const row = C[s] || {}, v = heroes.filter(h => row[h]).map(h => { const o = row[h]; return { h, n: o.n, win: o.win / o.n, gpm: o.gpm / o.n, dpm: o.dpm / o.n, kda: (o.k + o.a) / Math.max(1, o.d), d: o.d / o.n, a: o.a / o.n }; });
  const avg = k => v.reduce((t, x) => t + x[k], 0) / v.length, A = { gpm: avg('gpm'), dpm: avg('dpm'), kda: avg('kda'), d: avg('d'), a: avg('a'), win: avg('win') };
  for (const x of v) {
    // income and staying alive matter in every seat; damage matters less for the two that are there for others (护法, 镇关)
    const wD = s === 3 ? 0.05 : s === 0 ? 0.15 : 0.25, wA = s === 3 ? 0.2 : 0;
    const idx = 0.3 * x.gpm / A.gpm + wD * x.dpm / A.dpm + wA * x.a / Math.max(0.1, A.a) + 0.2 * Math.min(2.5, x.kda / A.kda) + 0.1 * Math.min(2, A.d / Math.max(0.5, x.d)) + (0.4 - wD - wA) * (1 + (x.win - A.win));
    (M[x.h] = M[x.h] || [])[s] = { idx, ...x };
  }
}
const f = (x, d = 2) => x.toFixed(d);
console.log('index: 1.00 = the average cultivator in that seat. n = matches per cell.\n');
console.log('修士      ' + SEAT.map(s => s.padStart(7)).join('') + '   最适合');
const FIT = {};
for (const h of heroes) {
  const r = M[h] || [], best = r.map((c, s) => ({ s, i: c ? c.idx : 0 })).sort((a, b) => b.i - a.i), top = best.filter(b => b.i >= best[0].i - 0.06 && b.i >= 0.97).slice(0, 2); FIT[h] = (top.length ? top : best.slice(0, 1)).map(b => b.s);
  console.log(NAME[h].padEnd(6, '　') + r.map(c => (c ? f(c.idx) : '  - ').padStart(8)).join('') + '   ' + FIT[h].map(s => SEAT[s]).join('、'));
}
console.log('\nSEAT_FIT = ' + JSON.stringify(FIT));
if (process.env.DETAIL) for (let s = 0; s < 5; s++) { console.log('\n' + SEAT[s] + ' — win%, 灵石/分, 伤害/分, KDA, 陨落'); for (const h of heroes) { const c = (M[h] || [])[s]; if (c) console.log('  ' + NAME[h].padEnd(5, '　'), String(c.n).padStart(3), f(c.win * 100, 0).padStart(5), f(c.gpm, 0).padStart(6), f(c.dpm, 0).padStart(6), f(c.kda).padStart(6), f(c.d, 1).padStart(5)); } }
