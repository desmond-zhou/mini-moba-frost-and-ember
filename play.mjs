// drives the real input path: click to move, keys to cast, shop
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal', '--mute-audio', '--window-size=1440,810'] });
const page = await b.newPage(); await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
await page.goto('http://localhost:5179/', { waitUntil: 'load' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); await sleep(1500);
await page.click('.card[data-k="warden"]'); await page.click('#goBtn'); await sleep(800);
const st = () => page.evaluate(() => { const p = window.__moba.G.player; return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), order: p.order && p.order.type, cds: p.cds.map(c => +c.toFixed(1)), mana: Math.round(p.mana), hero: p.def.id, gold: Math.round(p.gold), items: p.items.length }; });
console.log('start', JSON.stringify(await st()));
await page.mouse.click(1100, 420, { button: 'right' }); await sleep(1500);
console.log('after move', JSON.stringify(await st()));
await page.mouse.move(1000, 300); await page.keyboard.press('q'); await sleep(200); await page.keyboard.press('e'); await sleep(600);
console.log('after Q,E', JSON.stringify(await st()));
await page.keyboard.press('b'); await sleep(200); await page.click('.item[data-k="boots"]'); await sleep(200);
console.log('after shop', JSON.stringify(await st()), 'shopHidden', await page.evaluate(() => document.getElementById('shop').hidden));
await page.screenshot({ path: 'shot_shop.png' });
await page.keyboard.press('Escape'); await page.hover('.skill[data-i="3"]'); await sleep(200); await page.screenshot({ path: 'shot_tip.png' });
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
