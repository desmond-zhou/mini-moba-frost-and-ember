// app.mjs — wrap the built game as a local Mac app that opens in its own Chrome window.
//   node build.mjs && node app.mjs        → dist/霜烬之争.app   (drag it to /Applications or the Dock)
// The app carries its own copy of the game, so it needs nothing else on disk except Google Chrome. It opens Chrome in app mode
// (no tabs, no address bar) with its own profile, so the window, saved settings and records stay separate from normal browsing.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { iconSVG } from './appicon.mjs';

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

// the icon: the same frost-and-ember taiji as the web app (appicon.mjs), on the macOS grid: a rounded square 824 of 1024 wide
// with a soft shadow. The 16–32 px sizes get the plain taiji (the sword and whisk would only blur there).
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage(); await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
const macIcon = async (svg, file) => {
  await page.setContent(`<style>html,body{margin:0;background:transparent}#t{position:absolute;left:100px;top:92px;width:824px;height:824px;border-radius:185px;overflow:hidden;
    box-shadow:0 10px 24px rgba(0,0,0,.35),0 2px 6px rgba(0,0,0,.3)}#t svg{width:824px;height:824px;display:block}</style><div id="t">${svg}</div>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
};
const png = path.resolve('dist', 'icon-1024.png'), small = path.resolve('dist', 'icon-1024-plain.png');
await macIcon(iconSVG(), png); await macIcon(iconSVG({ plain: true }), small); await b.close();
const set = path.resolve('dist', 'icon.iconset'); fs.rmSync(set, { recursive: true, force: true }); fs.mkdirSync(set);
const put = (px, name) => execFileSync('sips', ['-z', String(px), String(px), px <= 32 ? small : png, '--out', path.join(set, name)], { stdio: 'ignore' });
for (const s of [16, 32, 128, 256, 512]) { put(s, `icon_${s}x${s}.png`); put(s * 2, `icon_${s}x${s}@2x.png`); }
execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(C, 'Resources', 'icon.icns')]);
fs.rmSync(set, { recursive: true, force: true });
console.log('made', APP, '(' + version + ')');
