#!/usr/bin/env bash
# Regenerate src/lib/database.types.ts from the hosted Supabase schema.
set -euo pipefail
: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF}"
curl -sSf -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:-proxy-injected}" \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/types/typescript?included_schemas=public" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).types))' \
  > src/lib/database.types.ts
echo "types written"
