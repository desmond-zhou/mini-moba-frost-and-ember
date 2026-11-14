// audiotest.mjs — play every effect once in headless Chrome and report peak / RMS, to balance levels and catch errors
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-size=640,360'] });
const page = await b.newPage(); const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + (e.stack || e.message).slice(0, 500)));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text().slice(0, 300)); });
await page.goto('http://localhost:5179/?auto=mage&dyn=0&q=low', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 2500));
const res = await page.evaluate(async () => {
  const A = window.__moba.audio; A.init(); await new Promise(r => setTimeout(r, 600));
  const out = [], L = A.listener, sleep = ms => new Promise(r => setTimeout(r, ms));
  const measure = async ms => { let pk = 0, rm = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { const [p, r] = A.level(); pk = Math.max(pk, p); rm = Math.max(rm, r); await sleep(12); } return [pk, rm]; };
  const base = await measure(1500);
  out.push('bed (music + ambience) peak ' + base[0].toFixed(3) + ' rms ' + base[1].toFixed(3));
  for (const n of A.names()) { A.lastErr = ''; A.play(n, L.x + 3, L.z - 2); const [pk, rm] = await measure(420); out.push(n.padEnd(8) + ' peak ' + pk.toFixed(3) + ' rms ' + rm.toFixed(3) + (A.lastErr ? '  ERR ' + A.lastErr : '')); await sleep(350); }
  return out.join('\n');
});
console.log(res); console.log(errs.length ? errs.join('\n') : 'no page errors');
await b.close();
