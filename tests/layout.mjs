// layout.mjs — on a phone held upright, a phone on its side and two desktop sizes: the title, the lobby, the room and the match
// HUD fit the screen (no sideways scrolling, the buttons that matter inside the screen). Needs the dev page and the room server
// on this machine. node tests/layout.mjs
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE || 'http://localhost:5179/', sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, what) => { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) fails++; };
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 120000, args: ['--no-sandbox', '--enable-webgl'] });
const SIZES = [['phone upright', 390, 844, true], ['phone on its side', 844, 390, true], ['laptop', 1280, 720, false], ['desktop', 1440, 900, false]];
const fits = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return 'missing'; const r = e.getBoundingClientRect(); if (!r.width) return 'hidden';
  return r.left >= -1 && r.right <= innerWidth + 1 ? 'ok' : `x ${Math.round(r.left)}–${Math.round(r.right)} of ${innerWidth}`; }, sel);
const noSideScroll = p => p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1);
for (const [name, w, h, touch] of SIZES) {
  const ctx = await b.createBrowserContext(), p = await ctx.newPage(); await p.setViewport({ width: w, height: h, isMobile: touch, hasTouch: touch });   // a fresh profile each: no leftover seat to rejoin
  await p.evaluateOnNewDocument(() => localStorage.setItem('frostember.name', '量尺寸'));
  await p.goto(BASE + '?dyn=0&q=low' + (touch ? '&touch=1' : ''), { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('boot').classList.contains('done') && !document.getElementById('title').hidden, { timeout: 30000 });
  ok(await noSideScroll(p), `${name}: title has no sideways scroll`);
  for (const s of ['#goBtn', '#netBtn', '#modeSel']) ok((await fits(p, s)) === 'ok', `${name}: title ${s} on screen (${await fits(p, s)})`);
  await p.click('#netBtn'); await sleep(1800);
  const pane = await p.evaluate(() => { const r = document.querySelector('#netPane .pane').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1; });
  ok(pane, `${name}: lobby box inside the screen`);
  await p.click('#nCreate1'); await p.waitForSelector('#room .rhead b', { timeout: 8000 }); await sleep(400);
  ok(await noSideScroll(p), `${name}: room has no sideways scroll`);
  for (const s of ['#room .rready', '#room .rstart', '#room .rsend', '#room .seat']) ok((await fits(p, s)) === 'ok', `${name}: room ${s} on screen (${await fits(p, s)})`);
  await p.click('.card[data-k="mage"]'); await sleep(300); await p.click('#room .rstart');
  await p.waitForFunction(() => window.__moba.G && window.__moba.G.net, { timeout: 15000 }); await sleep(2500);
  for (const s of ['#skills', '#mini', '#sig']) ok((await fits(p, s)) === 'ok', `${name}: match ${s} on screen (${await fits(p, s)})`);
  await p.screenshot({ path: `runs/layout_${w}x${h}.png` });
  await ctx.close();
}
await Promise.race([b.close(), sleep(3000)]);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
