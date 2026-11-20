// webapp.mjs — the built page works as a web app: builds, then checks dist/frostember.html's head. No zooming in the viewport;
// the tab icon (SVG + 32 px PNG) and the home-screen icon (180 px PNG) are inside the page and decode at the right size;
// the manifest names icons that exist at the sizes it claims; iOS full-screen tags are there. node tests/webapp.mjs
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
let fails = 0; const ok = (c, what) => { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) fails++; };
execFileSync('node', ['build.mjs'], { stdio: 'ignore' });
const page = fs.readFileSync('dist/frostember.html', 'utf8'), head = page.slice(0, page.indexOf('</head>'));
const png = buf => buf.readUInt32BE(0) === 0x89504e47 ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null;   // width, height from IHDR
// const dataOf = rel => { const m = head.match(new RegExp(`<link rel="${rel}"[^>]*href="data:([^;]+);base64,([^"]+)"`)); return m && { type: m[1], buf: Buffer.from(m[2], 'base64') }; };
ok(/<meta name="viewport"[^>]*maximum-scale=1[^>]*user-scalable=no/.test(head), 'built page: viewport forbids zooming');
const svg = head.match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,([^"]+)"/);
ok(svg && /^<svg[\s\S]*<\/svg>$/.test(Buffer.from(svg[1], 'base64').toString()), 'built page: SVG tab icon inside');
const p32 = head.match(/<link rel="icon" type="image\/png" sizes="32x32" href="data:image\/png;base64,([^"]+)"/);
ok(p32 && String(png(Buffer.from(p32[1], 'base64'))) === '32,32', 'built page: 32 px PNG tab icon inside');
const touch = head.match(/<link rel="apple-touch-icon" href="([^"]+)">/);   // iOS ignores a data: URI here and shows a letter
ok(touch && !touch[1].startsWith('data:'), `built page: home-screen icon is a real file, not a data: URI (${touch && touch[1].slice(0, 40)})`);
const tf = touch && 'dist/web/' + touch[1].split('?')[0];
ok(tf && fs.existsSync(tf) && String(png(fs.readFileSync(tf))) === '180,180', 'built page: home-screen icon file is 180 px');
ok(/apple-touch-icon\.png\?v=\w+/.test(head), 'built page: home-screen icon link carries a version, so phones fetch a new picture');
for (const m of ['apple-mobile-web-app-capable', 'mobile-web-app-capable', 'apple-mobile-web-app-title', 'theme-color']) ok(head.includes(`name="${m}"`), `built page: ${m}`);
ok(/<link rel="manifest" href="manifest\.webmanifest(\?v=\w+)?">/.test(head), 'built page: links the manifest');
const man = JSON.parse(fs.readFileSync('dist/web/manifest.webmanifest', 'utf8'));
ok(man.name === '霜烬之争' && man.display && man.start_url, 'manifest: name, display, start_url');
for (const i of man.icons) { const f = 'dist/web/' + i.src; ok(fs.existsSync(f) && String(png(fs.readFileSync(f))) === i.sizes.replace('x', ','), `manifest: ${i.src} is ${i.sizes}`); }
ok(man.icons.some(i => i.purpose === 'maskable'), 'manifest: has a maskable icon');
for (const f of man.icons.map(i => i.src).concat('apple-touch-icon.png')) ok(fs.readFileSync('deploy/publish.sh', 'utf8').includes(f), `publish.sh uploads ${f}`);
console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
