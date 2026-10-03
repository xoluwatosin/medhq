#!/usr/bin/env bash
# Restore the Lovable Cloud backup into the new Supabase project.
#
#   DATABASE_URL='postgresql://postgres.zeqiewxlqcmbgvytnahl:<password>@aws-...pooler.supabase.com:5432/postgres' \
#     scripts/migration/restore.sh ~/Downloads/medicconnect_261003.backup
#
# Use the Session pooler string from the dashboard (Connect button). Needs
# Postgres 18 client tools: `brew install libpq` on macOS, then add
# $(brew --prefix libpq)/bin to PATH.
#
# Only restore.list is restored: the app schemas, auth users and identities,
# storage buckets and storage policies. Supabase's own schemas are already in
# the new project and are left alone. Nothing is dropped, so run this once,
# against an empty project.
set -euo pipefail

BACKUP="${1:?usage: restore.sh <path to medicconnect_261003.backup>}"
: "${DATABASE_URL:?set DATABASE_URL to the Session pooler connection string}"
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$PWD/restore.log"

major="$(pg_restore --version | grep -oE '[0-9]+' | head -1)"
if [ "$major" -lt 18 ]; then
  echo "pg_restore $major found; version 18 or newer is needed for this backup." >&2
  exit 1
fi

echo "Enabling pg_cron and pg_net..."
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
SQL

echo "Restoring (a few minutes)..."
pg_restore --no-owner --verbose -d "$DATABASE_URL" -L "$DIR/restore.list" "$BACKUP" 2> "$LOG" || true

errors="$(grep -c 'pg_restore: error' "$LOG" || true)"
echo
echo "Done with $errors error(s). Full log: $LOG"
echo "Error lines (no data in them) - send these to Claude:"
grep -A1 'pg_restore: error' "$LOG" | grep -vE '^(--|DETAIL|pg_restore: (creating|processing|executing))' | cut -c1-300 | head -60
