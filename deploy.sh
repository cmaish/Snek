#!/usr/bin/env bash
# Upload the game to an S3 bucket (optionally behind CloudFront).
#
#   ./deploy.sh my-snek-bucket                 # S3 only
#   ./deploy.sh my-snek-bucket E123ABC456      # S3 + CloudFront cache refresh
#
# Needs the AWS CLI configured (aws configure). Everything in public/ is static.
set -euo pipefail

BUCKET="${1:?usage: ./deploy.sh <s3-bucket> [cloudfront-distribution-id]}"
DIST="${2:-}"
cd "$(dirname "$0")/public"

# Long-ish cache for assets (the service worker refreshes them anyway)...
aws s3 sync . "s3://$BUCKET/" --delete \
  --exclude "index.html" --exclude "sw.js" --exclude "config.json" --exclude "manifest.webmanifest" \
  --cache-control "public, max-age=3600"

# ...and never cache the files that control updates.
for f in index.html sw.js config.json; do
  aws s3 cp "$f" "s3://$BUCKET/$f" --cache-control "no-cache"
done
aws s3 cp manifest.webmanifest "s3://$BUCKET/manifest.webmanifest" \
  --cache-control "no-cache" --content-type "application/manifest+json"

if [ -n "$DIST" ]; then
  aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" >/dev/null
  echo "CloudFront invalidation started for $DIST"
fi
echo "Deployed to s3://$BUCKET"
