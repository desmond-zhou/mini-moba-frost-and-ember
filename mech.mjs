// mech.mjs — staged checks of single moves against a parked target: node mech.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio'] });
const page = await b.newPage(); page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5179/?auto=mage&dyn=0&q=low&diff=mirror&mode=single', { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 2000));
const run = (hero, i, dx, body) => page.evaluate((hero, i, dx, body) => {
  const M = window.__moba; M.start(hero, 'mirror', 'single', -1); const G = M.G, p = G.player, e = G.heroes.find(h => h.team !== p.team);
  for (const h of G.heroes) { h.x = h.team === p.team ? -30 : 60; h.z = 30; h.stunT = 99; }   // park everyone
  p.x = 0; p.z = 20; e.x = dx; e.z = 20; p.stunT = 0; p.level = 6; p.ranks = [2, 2, 2, 1]; p.mana = 999; p.cds = [0, 0, 0, 0]; e.hp = e.maxHp = 3000;
  const ok = G.castAt(i, e.x, e.z), log = [];
  for (let t = 0; t < 30; t++) { M.sim(0.1); for (const h of G.heroes) if (h !== p && h !== e) h.stunT = 99; e.stunT = Math.max(e.stunT, 0.5); log.push(eval(body)); }
  return { hero, skill: p.def.skills[i].name, ok, log: log.filter((v, k) => k % 3 === 0 || k < 4).join(' | ') };
}, hero, i, dx, body);
const cases = [
  ['ranger', 1, 7, "`hp${Math.round(e.hp)} proj${G.proj.filter(q=>q.src===p).map(q=>(q.returning?'<':'>')+q.x.toFixed(0)).join(',')}`"],
  ['wenren', 0, 9, "`px${p.x.toFixed(1)} hp${Math.round(e.hp)} slow${e.slowPct}`"],
  ['peiji', 3, 6, "`ex${e.x.toFixed(1)} hp${Math.round(e.hp)}`"],
  ['peiji', 2, 7, "`px${p.x.toFixed(1)} hp${Math.round(e.hp)}`"],
  ['shade', 2, 9, "`hid${p.hid} veil${(p.veilT||0).toFixed(1)}`"],
  ['yuanshan', 1, 8, "`hp${Math.round(e.hp)} vuln${e.vulnT>G.t?e.vulnK:0}`"],
  ['linshuang', 3, 20, "`hp${Math.round(e.hp)} slow${e.slowPct}`"],
  ['gunner', 2, 9, "`rng${p.range} ms${(p.hasteMs||0)} ad+${p.hasteAd||0}`"],
  ['qingya', 3, 9, "`px${p.x.toFixed(1)} hp${Math.round(e.hp)}`"],
  ['healer', 2, 9, "`as${p.hasteAs} ms${p.hasteMs} t${p.hasteT.toFixed(1)}`"],
];
for (const c of cases) console.log(JSON.stringify(await run(...c)));
await Promise.race([b.close(), new Promise(r => setTimeout(r, 3000))]); process.exit(0);
