#!/usr/bin/env bash
# Curl tests for /api/locations endpoints
# Usage: ./location.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:3000

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

[ -n "${1:-}" ] && BASE_URL="$1"
LOCATIONS_URL="$BASE_URL/api/locations"

# ----------------------------------------
# POST /api/locations — create a location
# ----------------------------------------
header "POST /api/locations — create location"
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$LOCATIONS_URL" \
  -H "$CONTENT_TYPE" \
  -d '{
    "name": "Tower Alpha",
    "type": "TOWER",
    "municipality": "Bogotá",
    "neighborhood": "Chapinero",
    "address": "Cra 7 #45-12",
    "latitude": 4.651,
    "longitude": -74.058,
    "altitude": 2600
  }')

BODY=$(echo "$CREATE_RESPONSE" | head -n -1)
STATUS=$(echo "$CREATE_RESPONSE" | tail -n 1)
echo "Status: $STATUS"
echo "$BODY" | pretty

# Extract the created ID for subsequent requests
LOCATION_ID=$(echo "$BODY" | (command -v jq &>/dev/null && jq -r '.id' || grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4))
echo "Created location ID: $LOCATION_ID"

# ----------------------------------------
# GET /api/locations — list with pagination
# ----------------------------------------
header "GET /api/locations — list (limit=5, offset=0)"
curl -s -X GET "$LOCATIONS_URL?limit=5&offset=0" | pretty

header "GET /api/locations — filter by type=TOWER"
curl -s -X GET "$LOCATIONS_URL?type=TOWER&limit=10" | pretty

# ----------------------------------------
# GET /api/locations/:id — get by ID
# ----------------------------------------
header "GET /api/locations/:id — get by ID"
if [ -n "$LOCATION_ID" ] && [ "$LOCATION_ID" != "null" ]; then
  curl -s -X GET "$LOCATIONS_URL/$LOCATION_ID" | pretty
else
  echo "Skipped: no location ID available (create may have failed)"
fi

# ----------------------------------------
# PATCH /api/locations/:id — update
# ----------------------------------------
header "PATCH /api/locations/:id — update name and address"
if [ -n "$LOCATION_ID" ] && [ "$LOCATION_ID" != "null" ]; then
  curl -s -X PATCH "$LOCATIONS_URL/$LOCATION_ID" \
    -H "$CONTENT_TYPE" \
    -d '{
      "name": "Tower Alpha (updated)",
      "address": "Cra 7 #45-99"
    }' | pretty
else
  echo "Skipped: no location ID available"
fi

# ----------------------------------------
# Error cases
# ----------------------------------------
header "GET /api/locations/:id — invalid UUID (expect 400)"
curl -s -X GET "$LOCATIONS_URL/not-a-uuid" | pretty

header "GET /api/locations/:id — non-existent ID (expect 404)"
curl -s -X GET "$LOCATIONS_URL/00000000-0000-4000-a000-000000000000" | pretty

header "POST /api/locations — missing required fields (expect 400)"
curl -s -X POST "$LOCATIONS_URL" \
  -H "$CONTENT_TYPE" \
  -d '{"municipality": "Bogotá"}' | pretty

header "POST /api/locations — unpaired coordinates (expect 400)"
curl -s -X POST "$LOCATIONS_URL" \
  -H "$CONTENT_TYPE" \
  -d '{
    "name": "Bad Location",
    "type": "NODE",
    "latitude": 4.651
  }' | pretty
