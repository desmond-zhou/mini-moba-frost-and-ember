import puppeteer from 'puppeteer-core';
const q = process.argv[2] || 'auto=mage';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio', '--window-size=1440,810'] });
const page = await b.newPage(); await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5179/?' + q, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 2500));
const r = await page.evaluate(() => {
  const m = window.__moba, G = m.G, R = m.R, gl = R.renderer.getContext(); m.sim(40);
  R.dyn.enabled = false; R.dyn.scale = 1; R.resize();
  const px = new Uint8Array(4);
  const time = (fn, n = 30) => { fn(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return +((performance.now() - t0) / n).toFixed(2); };
  let t = 100; const out = { size: R.size };
  out.logic = time(() => { t += 1 / 60; G.update(1 / 60, t); m.fx.update(1 / 60); }, 120);
  out.full = time(() => R.render(t));
  const sun = R.scene.children.find(c => c.isDirectionalLight && c.castShadow); sun.castShadow = false;
  out.noShadow = time(() => R.render(t)); sun.castShadow = true;
  R.bloom.enabled = false; out.noBloom = time(() => R.render(t)); R.bloom.enabled = true;
  const vis = {}; for (const c of R.scene.children) { if (c.isInstancedMesh || c.isPoints) { c.visible = false; } }
  out.noInstanced = time(() => R.render(t)); for (const c of R.scene.children) if (c.isInstancedMesh || c.isPoints) c.visible = true;
  const ground = R.scene.children.find(c => c.isMesh && c.geometry.type === 'PlaneGeometry' && c.receiveShadow); ground.visible = false;
  out.noGround = time(() => R.render(t)); ground.visible = true;
  R.setQuality('low'); R.dyn.enabled = false; out.low = time(() => R.render(t)); out.lowSize = R.size;
  return JSON.stringify(out);
});
console.log(r); await b.close();
