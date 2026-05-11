#!/usr/bin/env bash
set -euo pipefail
: "${VERACITY_API_KEY:?set VERACITY_API_KEY}"
BASE_URL="${VERACITY_API_BASE_URL:-https://api.veracityapi.com}"

curl "$BASE_URL/v1/analyze" \
  -H "Authorization: Bearer $VERACITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "content": "Travelers should always be careful in tourist areas because scams can happen anywhere. Keep your belongings close and avoid strangers.",
    "auto_revise": true,
    "context": { "format": "article", "intended_use": "publish", "domain": "travel" },
    "store_content": false
  }'

# Text auto-revise: set auto_revise=true to bill Analyze + revise at $0.010 / 1k characters
# and receive revised_text when recommended_action is revise. Analyze-only remains $0.005 / 1k.
# Evidence type values are strict enums for deterministic agent branching.
