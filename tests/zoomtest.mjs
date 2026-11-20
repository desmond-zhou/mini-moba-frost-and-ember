// zoomtest.mjs — the page never zooms (the author's ask, 2026-11-20: an accidental zoom-in mid-fight can't be undone).
// Phone: a two-finger pinch on the title and in a match leaves the page at scale 1. Desktop: Ctrl+scroll and Ctrl +/−/0 are
// cancelled, and plain scrolling over the arena no longer moves the camera. Needs the dev page. node tests/zoomtest.mjs
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE || 'http://localhost:5179/', sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, what) => { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) fails++; };
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 120000, args: ['--no-sandbox', '--enable-webgl'] });

const ph = await b.newPage(); await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const cdp = await ph.createCDPSession(), scale = () => ph.evaluate(() => visualViewport.scale);
const pinch = async (x, y) => { await cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: 2.5, relativeSpeed: 800, gestureSourceType: 'touch' }); await sleep(400); };
await ph.goto(BASE + '?dyn=0&q=low&touch=1', { waitUntil: 'load' });
await ph.waitForFunction(() => document.getElementById('boot').classList.contains('done') && !document.getElementById('title').hidden, { timeout: 30000 });
ok(/user-scalable=no/.test(await ph.$eval('meta[name=viewport]', m => m.content)), 'phone: viewport says user-scalable=no');
await pinch(195, 420); ok(await scale() === 1, `phone: pinch on the title leaves scale 1 (${await scale()})`);
await ph.goto(BASE + '?auto=mage&bot=1&dyn=0&q=low&touch=1', { waitUntil: 'load' }); await sleep(3000);
await pinch(195, 300); ok(await scale() === 1, `phone: pinch in a match leaves scale 1 (${await scale()})`);

const pc = await b.newPage(); await pc.setViewport({ width: 1280, height: 720 });
const errs = []; pc.on('pageerror', e => errs.push(e.message));
await pc.goto(BASE + '?auto=mage&bot=1&dyn=0&q=low', { waitUntil: 'load' }); await sleep(3000);
const r = await pc.evaluate(() => {
  const view = document.getElementById('view'), fire = (el, e) => (el.dispatchEvent(e), e.defaultPrevented);
  const out = { ctrlWheel: fire(view, new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true, bubbles: true })) };
  for (const key of ['=', '+', '-', '0']) out['ctrl' + key] = fire(window, new KeyboardEvent('keydown', { ctrlKey: true, key, cancelable: true, bubbles: true }));
  out.cmdPlus = fire(window, new KeyboardEvent('keydown', { metaKey: true, key: '=', cancelable: true, bubbles: true }));
  for (let i = 0; i < 10; i++) view.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true }));
  out.camZoom = window.__moba.input.zoom; return out;
});
for (const [k, v] of Object.entries(r)) if (k !== 'camZoom') ok(v === true, `desktop: ${k} is cancelled`);
ok(r.camZoom === 1, `desktop: scrolling over the arena leaves the camera alone (zoom ${r.camZoom})`);
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
