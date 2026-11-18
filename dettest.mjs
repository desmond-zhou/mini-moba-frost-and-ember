// dettest.mjs — do two machines that see the match from different seats, cameras and quality settings play out the same match?
// node dettest.mjs [mode] [seconds]   → prints the fingerprints side by side; they must match at every checkpoint
// CMDS=1: one seat on each side is a person, and both machines apply the same stream of random commands at the same steps
// (move, attack, cast, buy, learn, signal, 开团, insight, 归宗, 托管 on/off) — the path real players' input takes
import puppeteer from 'puppeteer-core';
const [mode = 'tri', secs = '600'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const N = mode === 'tri' ? 5 : 3, seed = 12345;
const pages = [];
for (const [me, q] of [[0, 'low'], [2 * N - 1, 'high']]) {
  const p = await b.newPage(); p.on('pageerror', e => console.error('PAGEERROR', e.message));
  await p.goto(`${process.env.BASE || 'http://localhost:5179/'}?bot=1&dyn=0&q=${q}&mode=${mode}`, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 1500));
  await p.evaluate((mode, N, seed, me, cmds) => {
    const ids = ['warden', 'mage', 'archer', 'healer', 'shade', 'keeper', 'storm', 'gunner', 'yanzhao', 'bloodlord'];
    const lineup = []; for (let t = 0; t < 2; t++) for (let i = 0; i < N; i++) lineup.push({ team: t, hero: ids[t * 5 + i], slot: i, human: cmds && i === 0, name: cmds && i === 0 ? '人' + t : '' });
    window.__moba.hold = true; window.__moba.start(null, 'normal', mode, -1, { seed, lineup, me, net: true, send: () => {} });
  }, mode, N, seed, me, !!process.env.CMDS);
  pages.push(p);
}
let bad = 0;
for (let t = 30; t <= +secs; t += 30) {
  const h = [];
  for (const [k, p] of pages.entries()) h.push(await p.evaluate((T, draw, cmds) => { const m = window.__moba;
      const G = m.G; let r = (G.cmdSeed || 777) >>> 0; const rnd = () => { r = (r + 0x6D2B79F5) >>> 0; let t = r; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const ITEMS = ['jian', 'zhang', 'jia', 'fu', 'huiyuan', 'xuening', 'qingfeng', 'xingwen', 'zhenxue', 'xingdun'];
      while (m.G.tick < T * 60 && !m.G.over) {
        if (cmds && G.tick % 6 === 0) for (const li of [0, G.lineup.length / 2]) {   // the same commands on both machines: the test's own dice, aimed from the (shared) state
          const h = G.byLi[li], k = rnd(), x = Math.round((h.x + (rnd() - 0.5) * 30) * 100) / 100, z = Math.round((h.z + (rnd() - 0.5) * 20) * 100) / 100;
          const foes = G.heroes.filter(o => o.team !== h.team && o.alive), foe = foes[Math.floor(rnd() * foes.length)] || null;
          const q = k < 0.3 ? { c: 'move', x, z } : k < 0.4 ? { c: 'amove', x, z } : k < 0.48 ? { c: 'atk', id: foe ? foe.id : 0 } : k < 0.52 ? { c: 'dir', dx: Math.round(Math.cos(k * 40) * 100) / 100, dz: Math.round(Math.sin(k * 40) * 100) / 100 }
            : k < 0.66 ? { c: 'cast', i: Math.floor(rnd() * 4), x, z } : k < 0.72 ? { c: 'learn', i: Math.floor(rnd() * 4) } : k < 0.78 ? { c: 'buy', id: ITEMS[Math.floor(rnd() * ITEMS.length)] }
            : k < 0.82 ? { c: 'sig', type: ['gather', 'attack', 'retreat'][Math.floor(rnd() * 3)], x, z, id: 0 } : k < 0.85 ? { c: 'rally', on: rnd() < 0.5 } : k < 0.88 ? { c: 'ins', k: rnd() < 0.5 ? 0 : 1 }
            : k < 0.91 ? { c: 'recall' } : k < 0.94 ? { c: 'stop' } : k < 0.97 ? { c: 'bot', on: h.isPlayer ? rnd() < 0.3 : false } : { c: 'move', x, z };
          G.exec(h, q);
        }
        G.cmdSeed = r;
        m.G.step(1 / 60); m.fx.update(1 / 60); if (draw) { m.G.focus.x = m.G.focus.tx ?? 0; m.G.focus.z = m.G.focus.tz ?? 0; m.G.draw(1 / 60, m.G.t, Math.random()); } } m.G.draw(0, 0); return { h: m.G.hash(), t: m.G.t.toFixed(2), k: m.G.kills.join(':'), over: m.G.over }; }, t, k === 1, !!process.env.CMDS));
  const ok = h[0].h === h[1].h; if (!ok) bad++;
  console.log(t, ok ? 'same' : 'DIFF', JSON.stringify(h));
  if (h[0].over || !ok && bad > 2) break;
}
await b.close(); process.exit(bad ? 1 : 0);
