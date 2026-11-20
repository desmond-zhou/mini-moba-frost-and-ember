// icon.mjs — render the web-app icon (appicon.mjs) to the PNGs browsers want, into dist/web/. build.mjs runs it when needed.
//   apple-touch-icon.png 180 (iPhone / iPad home screen), icon-192.png, icon-512.png and icon-maskable-512.png (Android, installed app),
//   favicon-32.png (tab icon for browsers without SVG favicons), favicon.svg (plain version), icon-sheet.png (a contact sheet to eyeball)
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
import { iconSVG } from './appicon.mjs';
fs.mkdirSync('dist/web', { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const shot = async (svg, size, file) => {
  await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await p.setContent(`<style>html,body{margin:0;background:#000}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
};
const full = iconSVG(), plain = iconSVG({ plain: true });
await shot(full, 180, 'dist/web/apple-touch-icon.png');
await shot(full, 192, 'dist/web/icon-192.png');
await shot(full, 512, 'dist/web/icon-512.png');
await shot(iconSVG({ mask: true }), 512, 'dist/web/icon-maskable-512.png');
await shot(plain, 32, 'dist/web/favicon-32.png');
fs.writeFileSync('dist/web/favicon.svg', plain);
// contact sheet: how it looks on a home screen (rounded), and at tab sizes
const b64 = s => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64');
await p.setViewport({ width: 760, height: 300, deviceScaleFactor: 2 });
await p.setContent(`<body style="margin:0;background:#3a4a5e;display:flex;gap:28px;align-items:center;padding:30px;font:12px system-ui;color:#ddd">
  <img src="${b64(full)}" style="width:180px;border-radius:40px"><img src="${b64(full)}" style="width:120px;border-radius:50%">
  <img src="${b64(full)}" style="width:60px;border-radius:13px"><img src="${b64(plain)}" style="width:32px"><img src="${b64(plain)}" style="width:16px">
  <div style="background:#fff;padding:10px;display:flex;gap:10px;align-items:center"><img src="${b64(plain)}" style="width:16px"><span style="color:#222">霜烬之争</span></div></body>`);
await p.screenshot({ path: 'dist/web/icon-sheet.png' });
await b.close();
console.log('icons in dist/web/');
