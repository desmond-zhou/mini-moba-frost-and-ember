// uishot.mjs — the title screen and the online box at phone (portrait, landscape) and desktop sizes: node uishot.mjs <dir>
import puppeteer from 'puppeteer-core';
const out = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--enable-webgl'] });
for (const [w, h, n] of [[390, 844, 'p'], [844, 390, 'l'], [1440, 900, 'd']]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: n !== 'd', hasTouch: n !== 'd' });
  await p.goto('http://localhost:5179/?dyn=0&q=low' + (n !== 'd' ? '&touch=1' : ''), { waitUntil: 'load' }); await p.waitForFunction(() => !document.getElementById('title').hidden && document.getElementById('boot').classList.contains('done'), { timeout: 30000 }); await new Promise(r => setTimeout(r, 800));
  await p.screenshot({ path: `${out}/title_${n}.png` });
  await p.click('#netBtn'); await new Promise(r => setTimeout(r, 500)); await p.screenshot({ path: `${out}/netpane_${n}.png` }); await p.close();
}
await b.close();
