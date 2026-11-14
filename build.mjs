// build.mjs — bundle src/ + three.js into ONE self-contained html (no network needed except the optional display font).
//   dist/frostember.html  → double-click to play locally
//   dist/artifact.html    → same page without the document skeleton, for publishing as an artifact
import { build } from 'esbuild'; import fs from 'node:fs';
const out = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '').replace(/<script type="module"[^>]*><\/script>\s*/, '');
const body = html.replace(/^<!doctype html>\s*<meta charset[^>]*>\s*<meta name="viewport"[^>]*>\s*/i, '') + '<script>' + js + '</script>\n';
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', body);
fs.writeFileSync('dist/frostember.html', '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n' + body + '</body>\n</html>\n');
const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('bundle js', kb(js.length), '| page', kb(Buffer.byteLength(body)), '| own source', kb(fs.readdirSync('src').reduce((s, f) => s + fs.statSync('src/' + f).size, 0)));
