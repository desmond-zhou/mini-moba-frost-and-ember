// prof.mjs — where the simulation spends its time: node prof.mjs [mode=tri] [seconds=420]
import puppeteer from 'puppeteer-core';
const [mode = 'tri', secs = '420'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio'] });
const page = await b.newPage(); await page.goto('http://localhost:5179/?auto=mage&bot=1&dyn=0&q=low&diff=mirror&mode=' + mode, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 2000));
const c = await page.target().createCDPSession(); await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 200 });
await page.evaluate(() => window.__moba.sim(240)); await c.send('Profiler.start');
const ms = await page.evaluate(s => { const t = performance.now(); window.__moba.sim(s); return performance.now() - t; }, +secs);
const { profile } = await c.send('Profiler.stop'); const self = {}, dt = profile.timeDeltas, idx = new Map(profile.nodes.map(n => [n.id, n]));
profile.samples.forEach((id, i) => { const n = idx.get(id), k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self[k] = (self[k] || 0) + dt[i]; });
const tot = Object.values(self).reduce((a, x) => a + x, 0);
console.log(`${mode}: ${(ms / +secs).toFixed(2)} ms per simulated second (${(1000 / (ms / +secs)).toFixed(0)}x real time)`);
for (const [k, v] of Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log((v / tot * 100).toFixed(1).padStart(5) + '%  ' + k);
await Promise.race([b.close(), new Promise(r => setTimeout(r, 3000))]); process.exit(0);
