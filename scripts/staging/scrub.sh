#!/usr/bin/env bash
# Pseudonymise a restored copy of the Medic Connect database for staging.
#
#   STAGING_DATABASE_URL='postgresql://...' scripts/staging/scrub.sh
#
# Refuses the live and the old Lovable projects. Asks you to type the staging
# project ref before it runs. See scrub.sql for what it changes.
set -euo pipefail

LIVE_REFS=("zeqiewxlqcmbgvytnahl" "eylgffhvyuykafxydrul")
: "${STAGING_DATABASE_URL:?set STAGING_DATABASE_URL to the connection string of the staging project}"
DIR="$(cd "$(dirname "$0")" && pwd)"

for ref in "${LIVE_REFS[@]}"; do
  if [[ "$STAGING_DATABASE_URL" == *"$ref"* ]]; then
    echo "Refusing: this connection string points at a live project ($ref)." >&2
    exit 1
  fi
done

if [[ "${SCRUB_CONFIRM:-}" == "" ]]; then
  read -r -p "Type the staging project ref to confirm: " SCRUB_CONFIRM
fi
if [[ -z "$SCRUB_CONFIRM" || "$STAGING_DATABASE_URL" != *"$SCRUB_CONFIRM"* ]]; then
  echo "Refusing: the ref you typed is not in STAGING_DATABASE_URL." >&2
  exit 1
fi

psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$DIR/scrub.sql"

echo "Checking for real-looking emails left behind..."
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -At -f "$DIR/scrub-check.sql"
