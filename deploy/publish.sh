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
aws cloudfront create-invalidation --distribution-id E1ZK2NAPWFUXQ1 --paths "/" "/index.html" --query Invalidation.Id --output text
echo "published: https://moba.app.desmondzhou.com/"
