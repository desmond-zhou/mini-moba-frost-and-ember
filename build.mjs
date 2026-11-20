// build.mjs — bundle src/ + three.js into ONE self-contained html (no network needed except the optional display font).
//   dist/frostember.html  → double-click to play locally
//   dist/artifact.html    → same page without the document skeleton, for publishing as an artifact
import { build } from 'esbuild'; import fs from 'node:fs'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
// __SIM__: a fingerprint of the code that decides what happens in a match. Online, only pages with the same fingerprint may share a
// room (different rules would make their matches drift apart); the server turns the others away with "refresh the page".
const SIM = crypto.createHash('sha1').update(['game', 'config', 'dmath', 'util', 'world'].map(f => fs.readFileSync(`src/${f}.js`, 'utf8')).join('\n')).digest('hex').slice(0, 10);
const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none', define: { __SIM__: JSON.stringify(SIM) } });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '').replace(/<script type="module"[^>]*><\/script>\s*/, '');
const body = html.replace(/^<!doctype html>\s*<meta charset[^>]*>\s*<meta name="viewport"[^>]*>\s*/i, '') + '<script>' + js + '</script>\n';
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', body);
// the web-app icon (appicon.mjs, rendered by icon.mjs into dist/web/ when it changed) goes into the page itself, so the tab
// icon works wherever the page is served from; the home-screen icon, manifest.webmanifest and the big PNGs sit next to the page
// on the public site (deploy/publish.sh uploads them) for iPhone "add to home screen" and Android / desktop "install app".
const W = 'dist/web/', stale = !fs.existsSync(W + 'apple-touch-icon.png') || fs.statSync(W + 'apple-touch-icon.png').mtimeMs < Math.max(fs.statSync('appicon.mjs').mtimeMs, fs.statSync('icon.mjs').mtimeMs);
if (stale) execFileSync('node', ['icon.mjs'], { stdio: 'inherit' });
const iconV = crypto.createHash('sha1').update(fs.readFileSync(W + 'icon-512.png')).digest('hex').slice(0, 8);
const uri = (f, type) => `data:${type};base64,` + fs.readFileSync(W + f).toString('base64');
fs.writeFileSync(W + 'manifest.webmanifest', JSON.stringify({ name: '霜烬之争', short_name: '霜烬之争', lang: 'zh-CN', start_url: './', scope: './', display: 'fullscreen',
  background_color: '#070a10', theme_color: '#070a10', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 1));
const viewport = html.match(/<meta name="viewport"[^>]*>/i)[0];   // the page's own (no zooming), not a copy that can drift
const head = [viewport, '<meta name="theme-color" content="#070a10">',
  `<link rel="icon" type="image/svg+xml" href="${uri('favicon.svg', 'image/svg+xml')}">`, `<link rel="icon" type="image/png" sizes="32x32" href="${uri('favicon-32.png', 'image/png')}">`,
  // the home-screen icon must be a real file: iOS ignores a data: URI here and shows a letter instead (found 2026-11-20).
  // ?v= changes with the picture so phones don't keep an old one.
  `<link rel="apple-touch-icon" href="apple-touch-icon.png?v=${iconV}">`, `<link rel="manifest" href="manifest.webmanifest?v=${iconV}">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">', '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">', '<meta name="apple-mobile-web-app-title" content="霜烬之争">'].join('\n');
fs.writeFileSync('dist/frostember.html', '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' + head + '\n</head>\n<body>\n' + body + '</body>\n</html>\n');
const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('bundle js', kb(js.length), '| page', kb(Buffer.byteLength(body)), '| own source', kb(fs.readdirSync('src').reduce((s, f) => s + fs.statSync('src/' + f).size, 0)));
