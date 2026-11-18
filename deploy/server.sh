#!/bin/bash
# server.sh — put the room server on des-lightsail-us-west-2 (AWS Lightsail, Oregon), reached over Tailscale.
#   node build.mjs && deploy/server.sh           (FORCE=1 to restart even while matches are being played)
# The server runs as the systemd service "frostember" behind Caddy (deploy/server/). Restarting it ends every room and match.
set -e
cd "$(dirname "$0")/.."
H=des-lightsail-us-west-2
[ -f dist/frostember.html ] || { echo "build first: node build.mjs"; exit 1; }
busy=$(ssh $H 'curl -s localhost:8790/healthz' 2>/dev/null | awk '{print $2}')
if [ -n "$busy" ] && [ "$busy" != "0" ] && [ -z "$FORCE" ]; then echo "$busy room(s) open on the server: run with FORCE=1 to restart anyway"; exit 1; fi
out=$(mktemp -d)
npx esbuild server/server.mjs --bundle --platform=node --format=esm --target=node20 --outfile=$out/server.mjs --external:bufferutil --external:utf-8-validate --log-level=warning \
  "--banner:js=import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"
cp dist/frostember.html $out/game.html; cp deploy/server/frostember.service deploy/server/Caddyfile $out/
scp -q $out/server.mjs $out/game.html $out/frostember.service $out/Caddyfile $H:/tmp/
ssh $H 'set -e; mv /tmp/server.mjs /tmp/game.html /opt/frostember/
  sudo mv /tmp/frostember.service /etc/systemd/system/frostember.service; sudo mv /tmp/Caddyfile /etc/caddy/Caddyfile
  sudo systemctl daemon-reload; sudo systemctl enable -q frostember; sudo systemctl restart frostember; sudo systemctl reload caddy || sudo systemctl restart caddy
  sleep 1; curl -s localhost:8790/healthz; echo'
rm -rf $out
echo "deployed: wss://server.moba.app.desmondzhou.com:37190/ws   ·   stats over Tailscale: http://$H:8790/stats"
