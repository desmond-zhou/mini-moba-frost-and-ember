// batch.mjs — many bot-vs-bot matches in one headless page, both sides on identical numbers ("mirror").
// node batch.mjs <matches> <offset> <maxSeconds> [difficulty]  → one JSON line per match on stdout
import puppeteer from 'puppeteer-core';
const [n = '6', off = '0', maxT = '1200', diff = 'mirror', mode = 'single'] = process.argv.slice(2);
const ORDER = ['warden', 'keeper', 'bloodlord', 'berserker', 'shade', 'archer', 'ranger', 'gunner', 'mage', 'cryo', 'storm', 'healer'];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio', '--window-size=640,360'] });
const page = await b.newPage(); await page.setViewport({ width: 640, height: 360, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERROR', (e.stack || e.message).slice(0, 600)));
await page.goto((process.env.BASE || 'http://localhost:5179/') + '?auto=mage&bot=1&dyn=0&q=low&diff=' + diff + '&mode=' + mode, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 2000));
for (let i = 0; i < +n; i++) {
  const hero = ORDER[(i + +off) % ORDER.length];
  await page.evaluate((h, d) => { window.__moba.start(h, d); }, hero, diff);
  let st = null;
  for (let t = 0; t < +maxT; t += 60) { st = await page.evaluate(() => { try { return window.__moba.sim(60); } catch (e) { return { err: String(e.stack || e) }; } }); if (!st || st.err || st.over) break; }
  if (st && st.err) { console.error('SIMERR', st.err); continue; }
  const r = await page.evaluate(() => { const G = window.__moba.G; return { t: Math.round(G.t), win: G.over ? G.winner : -1, kills: G.kills, tw: G.structs.map(s => s.list.filter(t => t.alive).length), bot: G.botStat, heroes: G.heroes.map(h => ({ id: h.def.id, team: h.team, lv: h.level, k: h.kills, d: h.deaths, a: h.assists, dealt: Math.round(h.dealt), gold: Math.round(h.gold + h.items.reduce((s, x) => s + (x.total || x.cost || 0), 0)) })) }; });
  console.log(JSON.stringify(r));
}
await Promise.race([b.close(), new Promise(r => setTimeout(r, 3000))]); process.exit(0);   // never linger: a stuck browser close used to leave these processes behind
