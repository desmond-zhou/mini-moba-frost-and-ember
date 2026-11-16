// serverapp.mjs — the online server as its own Mac app, started only by hand.
//   node build.mjs && node serverapp.mjs     → dist/霜烬之争服务器.app
// Double-click it: a Terminal window opens with the server running in it, the addresses to open, and the log. Close the window
// and the server stops. Nothing starts by itself. The app carries the server (bundled with its one library, ws) and its own
// copy of the game page, so it runs on any Mac with Node.js installed.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const NAME = '霜烬之争服务器', APP = path.resolve('dist', NAME + '.app'), C = path.join(APP, 'Contents'), RES = path.join(C, 'Resources');
if (!fs.existsSync('dist/frostember.html')) { console.error('build first: node build.mjs'); process.exit(1); }
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
fs.rmSync(APP, { recursive: true, force: true });
for (const d of ['MacOS', 'Resources']) fs.mkdirSync(path.join(C, d), { recursive: true });
await build({ entryPoints: ['server/server.mjs'], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile: path.join(RES, 'server.mjs'), external: ['bufferutil', 'utf-8-validate'], logLevel: 'warning',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
fs.copyFileSync('dist/frostember.html', path.join(RES, 'game.html'));

// what runs in the Terminal window
fs.writeFileSync(path.join(RES, 'start.command'), `#!/bin/bash
here="$(cd "$(dirname "$0")" && pwd)"
printf '\\033]0;${NAME}\\007'
node="$(command -v node || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -1)"
if [ -z "$node" ]; then echo "需要先安装 Node.js：https://nodejs.org"; read -n 1; exit 1; fi
echo "${NAME} ${version}"
FROSTEMBER_HTML="$here/game.html" PORT="\${PORT:-8790}" exec "$node" "$here/server.mjs"
`, { mode: 0o755 });
// the app itself only opens that window
fs.writeFileSync(path.join(C, 'MacOS', 'run'), `#!/bin/bash
open -a Terminal "$(cd "$(dirname "$0")/../Resources" && pwd)/start.command"
`, { mode: 0o755 });
fs.writeFileSync(path.join(C, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>${NAME}</string><key>CFBundleDisplayName</key><string>${NAME}</string>
  <key>CFBundleIdentifier</key><string>local.frostember.server</string><key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>${version}</string><key>CFBundleExecutable</key><string>run</string>
  <key>CFBundleIconFile</key><string>icon</string><key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>11.0</string>
</dict></plist>
`);
const icns = path.join('dist', '霜烬之争.app', 'Contents', 'Resources', 'icon.icns');   // the game's icon, when the game app was built
if (fs.existsSync(icns)) fs.copyFileSync(icns, path.join(RES, 'icon.icns'));
execFileSync('touch', [APP]);
console.log('made', APP, '(' + version + ')');
