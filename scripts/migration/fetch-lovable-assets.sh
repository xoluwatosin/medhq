#!/usr/bin/env bash
# Download the files Lovable hosted under /__l5e/assets-v1/ into public/, so the
# site serves them itself: email images (public/email-kit) and the Figtree
# fonts (public/fonts). Run once from the repo root while medicconnect.co is
# still served by Lovable, then commit public/email-kit and public/fonts.
set -euo pipefail
ORIGIN="${ORIGIN:-https://medicconnect.co}"
cd "$(dirname "$0")/../.."
while read -r dest url; do
  [ -n "$dest" ] || continue
  mkdir -p "public/$(dirname "$dest")"
  curl -fsSL "$ORIGIN$url" -o "public/$dest"
  echo "public/$dest  $(wc -c < "public/$dest") bytes"
done < scripts/migration/lovable-assets.txt
