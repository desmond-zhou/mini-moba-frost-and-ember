// headless smoke test: node test.mjs "<query>" <out.png> [simSeconds] [w] [h]
import puppeteer from 'puppeteer-core';
const [q = 'auto=mage', out = 'shot.png', sim = '0', w = '1440', h = '810', js = '', wait = '1500'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio', `--window-size=${w},${h}`] });
const page = await b.newPage(); await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text().slice(0, 600)); });
page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.stack || e.message).slice(0, 900)));
await page.goto((process.env.BASE || 'http://localhost:5179/') + '?' + q, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 2500));
if (+sim > 0) { const r = await page.evaluate(s => { try { return JSON.stringify(window.__moba.sim(s)); } catch (e) { return 'SIMERR ' + (e.stack || e); } }, +sim); console.log('sim:', r); await new Promise(r => setTimeout(r, 1200)); }
if (js) { const r = await page.evaluate(c => { try { return String(eval(c)); } catch (e) { return 'JSERR ' + (e.stack || e); } }, js); console.log('js:', r); await new Promise(r => setTimeout(r, +wait)); }
const stat = await page.evaluate(() => { const G = window.__moba.G; if (!G) return ''; return JSON.stringify({ t: Math.round(G.t), over: G.over, win: G.winner, kills: G.kills, recalls: G.recalls, bot: G.botStat, hid: G.units.filter(u => u.hid).length, structs: G.structs.map(s => [s.t1, s.t2, s.core].map(u => Math.round(u.hp))), heroes: G.heroes.map(h => `${h.team}${h.def.id[0]} L${h.level} ${h.kills}/${h.deaths}/${h.assists} g${Math.round(h.gold)} r${h.ranks.join('')} [${h.items.map(x => x.name).join(' ')}]`) }); });
console.log('stat:', stat);
const info = await page.evaluate(() => { const m = window.__moba; if (!m) return 'no __moba'; const G = m.G, r = m.R.renderer.info; return JSON.stringify({ calls: r.render.calls, tris: r.render.triangles, q: m.R.quality.name, scale: m.R.dyn.scale, size: m.R.size, t: G && G.t, units: G && G.units.length, fatal: document.getElementById('fatal').textContent }); });
console.log('info:', info);
console.log('title:', await page.title());
await page.screenshot({ path: out });
console.log(errs.length ? errs.slice(0, 12).join('\n') : 'no console errors');
await b.close();
