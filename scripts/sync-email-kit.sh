#!/usr/bin/env bash
# Mirror src/lib/email-kit into the edge runtime so the builder preview and the
# send render from exactly the same source. Deno needs explicit extensions.
set -e
src="src/lib/email-kit"
dst="supabase/functions/_shared/email-kit"
mkdir -p "$dst"
for f in "$src"/*.ts; do
  name=$(basename "$f")
  {
    echo "// GENERATED — do not edit. Run scripts/sync-email-kit.sh after changing src/lib/email-kit."
    sed -E 's#(from "\./[a-zA-Z0-9._-]+)"#\1.ts"#g' "$f"
  } > "$dst/$name"
done
