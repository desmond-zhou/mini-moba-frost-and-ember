#!/bin/bash
# publish.sh — put the current build on https://moba.app.desmondzhou.com (single-player; online shows "not open yet").
#   node build.mjs && deploy/publish.sh
# AWS (account of the author, us-east-1): S3 bucket moba-app-desmondzhou-com (private) → CloudFront E1ZK2NAPWFUXQ1 (HTTPS,
# certificate in ACM) → Route53 desmondzhou.com, A/AAAA alias moba.app. Costs next to nothing: one 1.4 MB file, CloudFront's
# free 1 TB a month. The page is cached at most 5 minutes; the invalidation makes a new version show at once.
set -e
cd "$(dirname "$0")/.."
[ -f dist/frostember.html ] || { echo "build first: node build.mjs"; exit 1; }
aws s3 cp dist/frostember.html s3://moba-app-desmondzhou-com/index.html --content-type "text/html; charset=utf-8" --cache-control "public, max-age=300" --only-show-errors
# the web-app icon and manifest (Android / desktop "install app"; iPhone uses the icon inside the page)
aws s3 cp dist/web/manifest.webmanifest s3://moba-app-desmondzhou-com/manifest.webmanifest --content-type "application/manifest+json" --cache-control "public, max-age=300" --only-show-errors
for f in icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png; do aws s3 cp dist/web/$f s3://moba-app-desmondzhou-com/$f --content-type image/png --cache-control "public, max-age=86400" --only-show-errors; done
aws cloudfront create-invalidation --distribution-id E1ZK2NAPWFUXQ1 --paths "/" "/index.html" "/manifest.webmanifest" "/icon-192.png" "/icon-512.png" "/icon-maskable-512.png" "/apple-touch-icon.png" --query Invalidation.Id --output text
echo "published: https://moba.app.desmondzhou.com/"
