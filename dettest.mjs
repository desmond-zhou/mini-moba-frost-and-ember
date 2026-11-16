// dettest.mjs — do two machines that see the match from different seats, cameras and quality settings play out the same match?
// node dettest.mjs [mode] [seconds]   → prints the fingerprints side by side; they must match at every checkpoint
import puppeteer from 'puppeteer-core';
const [mode = 'tri', secs = '600'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
const N = mode === 'tri' ? 5 : 3, seed = 12345;
const pages = [];
for (const [me, q] of [[0, 'low'], [2 * N - 1, 'high']]) {
  const p = await b.newPage(); p.on('pageerror', e => console.error('PAGEERROR', e.message));
  await p.goto(`${process.env.BASE || 'http://localhost:5179/'}?bot=1&dyn=0&q=${q}&mode=${mode}`, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 1500));
  await p.evaluate((mode, N, seed, me) => {
    const ids = ['warden', 'mage', 'archer', 'healer', 'shade', 'keeper', 'storm', 'gunner', 'yanzhao', 'bloodlord'];
    const lineup = []; for (let t = 0; t < 2; t++) for (let i = 0; i < N; i++) lineup.push({ team: t, hero: ids[t * 5 + i], slot: i, human: false });
    window.__moba.hold = true; window.__moba.start(null, 'normal', mode, -1, { seed, lineup, me, net: true, send: () => {} });
  }, mode, N, seed, me);
  pages.push(p);
}
let bad = 0;
for (let t = 30; t <= +secs; t += 30) {
  const h = [];
  for (const [k, p] of pages.entries()) h.push(await p.evaluate((T, draw) => { const m = window.__moba; while (m.G.tick < T * 60 && !m.G.over) { m.G.step(1 / 60); m.fx.update(1 / 60); if (draw) { m.G.focus.x = m.G.focus.tx ?? 0; m.G.focus.z = m.G.focus.tz ?? 0; m.G.draw(1 / 60, m.G.t, Math.random()); } } m.G.draw(0, 0); return { h: m.G.hash(), t: m.G.t.toFixed(2), k: m.G.kills.join(':'), over: m.G.over }; }, t, k === 1));
  const ok = h[0].h === h[1].h; if (!ok) bad++;
  console.log(t, ok ? 'same' : 'DIFF', JSON.stringify(h));
  if (h[0].over || !ok && bad > 2) break;
}
await b.close(); process.exit(bad ? 1 : 0);
