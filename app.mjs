// app.mjs — wrap the built game as a local Mac app that opens in its own Chrome window.
//   node build.mjs && node app.mjs        → dist/霜烬之争.app   (drag it to /Applications or the Dock)
// The app carries its own copy of the game, so it needs nothing else on disk except Google Chrome. It opens Chrome in app mode
// (no tabs, no address bar) with its own profile, so the window, saved settings and records stay separate from normal browsing.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const NAME = '霜烬之争', APP = path.resolve('dist', NAME + '.app'), C = path.join(APP, 'Contents');
if (!fs.existsSync('dist/frostember.html')) { console.error('build first: node build.mjs'); process.exit(1); }
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
fs.rmSync(APP, { recursive: true, force: true });
for (const d of ['MacOS', 'Resources']) fs.mkdirSync(path.join(C, d), { recursive: true });
fs.copyFileSync('dist/frostember.html', path.join(C, 'Resources', 'game.html'));

// the launcher: Chrome in app mode, its own profile, sound allowed to start, GPU on
fs.writeFileSync(path.join(C, 'MacOS', 'run'), `#!/bin/bash
here="$(cd "$(dirname "$0")/../Resources" && pwd)"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$chrome" ] || chrome="$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$chrome" ]; then osascript -e 'display alert "${NAME}" message "需要先安装 Google Chrome。"'; exit 1; fi
profile="$HOME/Library/Application Support/Frostember"
mkdir -p "$profile"
exec "$chrome" --user-data-dir="$profile" --app="file://$here/game.html" --window-size=1600,900 --start-maximized \\
  --autoplay-policy=no-user-gesture-required --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy \\
  --disable-background-timer-throttling --disable-renderer-backgrounding --no-first-run --no-default-browser-check
`, { mode: 0o755 });

fs.writeFileSync(path.join(C, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>${NAME}</string><key>CFBundleDisplayName</key><string>${NAME}</string>
  <key>CFBundleIdentifier</key><string>local.frostember.app</string><key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>${version}</string><key>CFBundleExecutable</key><string>run</string>
  <key>CFBundleIconFile</key><string>icon</string><key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string><key>NSHighResolutionCapable</key><true/>
</dict></plist>
`);

// the icon: the two characters 霜 and 烬, frost and ember, drawn in the browser and turned into an .icns
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage(); await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0;background:transparent"><canvas id="c" width="1024" height="1024"></canvas><script>
const g = c.getContext('2d'), r = 200; g.beginPath(); g.roundRect(64, 64, 896, 896, r); g.clip();
const bg = g.createLinearGradient(64, 64, 960, 960); bg.addColorStop(0, '#0d1a2c'); bg.addColorStop(0.5, '#120f17'); bg.addColorStop(1, '#2a0e08'); g.fillStyle = bg; g.fillRect(0, 0, 1024, 1024);
const glow = (x, y, col) => { const q = g.createRadialGradient(x, y, 0, x, y, 420); q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, 1024, 1024); };
glow(330, 360, 'rgba(110,180,255,.35)'); glow(700, 680, 'rgba(255,120,60,.35)');
g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 400px "Songti SC","STSong",serif';
g.fillStyle = '#bfe0ff'; g.shadowColor = '#6fb4ff'; g.shadowBlur = 40; g.fillText('霜', 360, 380);
g.fillStyle = '#ffc49a'; g.shadowColor = '#ff7a3c'; g.fillText('烬', 670, 660);
g.shadowBlur = 0; g.strokeStyle = 'rgba(223,189,120,.55)'; g.lineWidth = 10; g.beginPath(); g.roundRect(84, 84, 856, 856, r - 20); g.stroke();
</script></body>`);
const png = path.resolve('dist', 'icon-1024.png'); await (await page.$('#c')).screenshot({ path: png, omitBackground: true }); await b.close();
const set = path.resolve('dist', 'icon.iconset'); fs.rmSync(set, { recursive: true, force: true }); fs.mkdirSync(set);
for (const s of [16, 32, 64, 128, 256, 512]) { execFileSync('sips', ['-z', String(s), String(s), png, '--out', path.join(set, `icon_${s}x${s}.png`)], { stdio: 'ignore' }); execFileSync('sips', ['-z', String(s * 2), String(s * 2), png, '--out', path.join(set, `icon_${s}x${s}@2x.png`)], { stdio: 'ignore' }); }
execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(C, 'Resources', 'icon.icns')]);
fs.rmSync(set, { recursive: true, force: true });
console.log('made', APP, '(' + version + ')');
