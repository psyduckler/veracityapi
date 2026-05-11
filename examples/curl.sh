#!/usr/bin/env bash
set -euo pipefail
: "${VERACITYAPI_KEY:?set VERACITYAPI_KEY}"
BASE_URL="${VERACITYAPI_BASE_URL:-https://api.veracityapi.com}"

curl "$BASE_URL/v1/analyze" \
  -H "Authorization: Bearer $VERACITYAPI_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text", "content": "Travelers should always be careful in tourist areas because scams can happen anywhere. Keep your belongings close and avoid strangers.",
    "context": { "format": "article", "intended_use": "publish", "domain": "travel" },
    "store_content": false
  }'
