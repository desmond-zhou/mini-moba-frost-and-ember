// pace.mjs — how fast a mode levels: average cultivator level and gold at each minute, over a few bot matches.
//   node pace.mjs [mode=tri] [matches=4] [minutes=20]
import puppeteer from 'puppeteer-core';
const [mode = 'tri', n = '4', mins = '20'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio'] });
const page = await b.newPage(); await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
await page.goto((process.env.BASE || 'http://localhost:5179/') + '?auto=mage&bot=1&dyn=0&q=low&diff=mirror&mode=' + mode, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 2000));
const rows = [], ends = [];
for (let i = 0; i < +n; i++) {
  await page.evaluate(m => window.__moba.start('mage', 'mirror', m, -1), mode);
  for (let t = 1; t <= +mins; t++) {
    const r = await page.evaluate(() => { const st = window.__moba.sim(60), G = window.__moba.G, hs = G.heroes; return { over: st.over, t: G.t, lv: hs.reduce((a, h) => a + h.level, 0) / hs.length, lo: Math.min(...hs.map(h => h.level)), hi: Math.max(...hs.map(h => h.level)), gold: hs.reduce((a, h) => a + (h.earned || 0), 0) / hs.length, items: hs.reduce((a, h) => a + h.items.length, 0) / hs.length, tw: G.structs.map(s => s.list.filter(x => x.alive).length) }; });
    (rows[t] || (rows[t] = [])).push(r); if (r.over) { ends.push(r.t / 60); break; }
  }
}
console.log(mode, 'ended at', ends.map(x => x.toFixed(1)).join(' '), 'min');
for (let t = 1; t < rows.length; t++) { const R = rows[t], a = k => (R.reduce((s, r) => s + r[k], 0) / R.length); console.log(`${String(t).padStart(2)} min  lvl ${a('lv').toFixed(1)} (${a('lo').toFixed(0)}–${a('hi').toFixed(0)})  items ${a('items').toFixed(1)}  structs ${R[0].tw.join('/')}  n=${R.length}`); }
await Promise.race([b.close(), new Promise(r => setTimeout(r, 3000))]); process.exit(0);
