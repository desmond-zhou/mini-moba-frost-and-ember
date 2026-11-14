// frameprof.mjs — where a whole frame's CPU time goes (game update + effects + UI + world + render), not just the simulation.
//   node frameprof.mjs [mode=tri] [frames=600]
import puppeteer from 'puppeteer-core';
const [mode = 'tri', frames = '600'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio'] });
const page = await b.newPage(); await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1 });
await page.goto((process.env.BASE || 'http://localhost:5179/') + '?auto=mage&bot=1&dyn=0&mode=' + mode, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => { window.__moba.sim(300); for (let i = 0; i < 60; i++) window.__moba.frame(1 / 60); });   // warm up: shaders compile on the first frames
const c = await page.target().createCDPSession(); await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 100 }); await c.send('Profiler.start');
const ms = await page.evaluate(n => { const M = window.__moba, t0 = performance.now(); for (let i = 0; i < n; i++) M.frame(1 / 60); const gl = M.R.renderer.getContext(), px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / n; }, +frames);
const { profile } = await c.send('Profiler.stop'); const self = {}, idx = new Map(profile.nodes.map(n => [n.id, n]));
profile.samples.forEach((id, i) => { const n = idx.get(id), k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`; self[k] = (self[k] || 0) + profile.timeDeltas[i]; });
const tot = Object.values(self).reduce((a, x) => a + x, 0);
const info = await page.evaluate(() => { const r = window.__moba.R.renderer; r.info.autoReset = false; r.info.reset(); window.__moba.frame(1 / 60); const o = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; return o; });
console.log(`${mode}: ${ms.toFixed(2)} ms per frame (CPU side, GPU work queued) | ${info.calls} draw calls, ${(info.tris / 1000).toFixed(0)}k triangles per frame`);
for (const [k, v] of Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log((v / tot * 100).toFixed(1).padStart(5) + '%  ' + k);
await Promise.race([b.close(), new Promise(r => setTimeout(r, 3000))]); process.exit(0);
