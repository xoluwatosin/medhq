#!/usr/bin/env bash
# Reapply the original permissions (GRANT/REVOKE) from the Lovable Cloud backup.
#
#   DATABASE_URL='<session pooler URI>' scripts/migration/apply-acls.sh /path/to/medicconnect_261003.backup
#
# restore.sh restores each ACL entry as a whole, and every entry failed because
# it also granted to sandbox_exec, a Lovable-only role. This script drops the
# sandbox_exec grants and replays the rest.
#
# Done in one transaction: first reset every table, sequence and function in
# public and private to Postgres's built-in defaults, then apply the backup's
# GRANT/REVOKE statements on top. That recreates the original permissions
# exactly, including objects whose original permissions were the defaults
# (those have no entry in the backup). If any statement fails, nothing
# changes.
set -euo pipefail

BACKUP="${1:?usage: apply-acls.sh <path to medicconnect_261003.backup>}"
: "${DATABASE_URL:?set DATABASE_URL to the Session pooler connection string}"
DIR="$(cd "$(dirname "$0")" && pwd)"
SQL="$(mktemp)"
trap 'rm -f "$SQL"' EXIT

{
  cat <<'RESET'
revoke all on all tables in schema public, private from public, anon, authenticated, service_role;
revoke all on all sequences in schema public, private from public, anon, authenticated, service_role;
revoke all on all functions in schema public, private from anon, authenticated, service_role;
grant execute on all functions in schema public, private to public;
RESET
  pg_restore -f - -L "$DIR/acl.list" "$BACKUP" | grep -v 'sandbox_exec'
} > "$SQL"

echo "Statements to apply: $(grep -cE '^(GRANT|REVOKE|ALTER DEFAULT)' "$SQL")"
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$SQL"
echo "Permissions applied."
