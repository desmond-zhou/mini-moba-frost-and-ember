// builds.mjs — which first 法宝 suits each cultivator. Reads runs made with HERO=<id> BUILD='{"<id>":["<core>"]}' and prints, per
// cultivator, the tracked cultivator's win rate for each core tried.   node builds.mjs "runs/bd_*.jsonl"
import fs from 'fs';
const g = process.argv[2] || 'runs/bd_*.jsonl', dir = g.slice(0, g.lastIndexOf('/')) || '.', re = new RegExp('^' + g.slice(g.lastIndexOf('/') + 1).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$');
const T = {};
for (const f of fs.readdirSync(dir).filter(f => re.test(f))) {
  const m = f.match(/^bd\d*_([a-z]+)_([a-z]+)_/); if (!m) continue; const [, hero, core] = m, o = (T[hero] || (T[hero] = {}))[core] || (T[hero][core] = [0, 0]);
  for (const l of fs.readFileSync(dir + '/' + f, 'utf8').split('\n').filter(x => x[0] === '{')) { const r = JSON.parse(l), me = r.heroes.find(h => h.me); if (!me || r.win < 0) continue; o[1]++; if (r.win === me.team) o[0]++; }
}
for (const [hero, cores] of Object.entries(T)) console.log(hero.padEnd(10), Object.entries(cores).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([c, [w, n]]) => `${c} ${(w / n * 100).toFixed(0)}% (${n})`).join('   '));
