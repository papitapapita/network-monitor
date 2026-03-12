#!/usr/bin/env bash
# Curl tests for /api/devices endpoints
# Usage: ./device.sh [BASE_URL] [DEVICE_MODEL_ID] [LOCATION_ID]
#   BASE_URL defaults to http://localhost:3000
#   DEVICE_MODEL_ID and LOCATION_ID are optional UUIDs for realistic payloads

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

[ -n "${1:-}" ] && BASE_URL="$1"
DEVICES_URL="$BASE_URL/api/devices"

# Substitute real UUIDs if you have them; otherwise the create request will
# still exercise validation paths.
DEVICE_MODEL_ID="${2:-665ba5b8-e4e1-4965-9b29-51ba27e31d38}"
LOCATION_ID="${3:-}"

# ----------------------------------------
# POST /api/devices — create a device
# ----------------------------------------
header "POST /api/devices — create device"

PAYLOAD=$(cat <<JSON
{
  "deviceModelId": "$DEVICE_MODEL_ID",
  "name": "Core Switch 01",
  "ownerType": "COMPANY",
  "status": "INVENTORY",
  "category": "CORE",
  "serialNumber": "SN-TEST-001",
  "macAddress": "AA:BB:CC:DD:EE:01",
  "description": "Test device created by curl script",
  "monitoringEnabled": false
JSON
)

if [ -n "$LOCATION_ID" ]; then
  PAYLOAD="$PAYLOAD, \"locationId\": \"$LOCATION_ID\""
fi
PAYLOAD="$PAYLOAD }"

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$DEVICES_URL" \
  -H "$CONTENT_TYPE" \
  -d "$PAYLOAD")

BODY=$(echo "$CREATE_RESPONSE" | head -n -1)
STATUS=$(echo "$CREATE_RESPONSE" | tail -n 1)
echo "Status: $STATUS"
echo "$BODY" | pretty

DEVICE_ID=$(echo "$BODY" | (command -v jq &>/dev/null && jq -r '.id' || grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4))
echo "Created device ID: $DEVICE_ID"

# ----------------------------------------
# GET /api/devices — list with pagination
# ----------------------------------------
header "GET /api/devices — list (limit=5, offset=0)"
curl -s -X GET "$DEVICES_URL?limit=5&offset=0" | pretty

header "GET /api/devices — filter by status=INVENTORY"
curl -s -X GET "$DEVICES_URL?status=INVENTORY&limit=10" | pretty

header "GET /api/devices — filter by category=CORE"
curl -s -X GET "$DEVICES_URL?category=CORE&limit=10" | pretty

header "GET /api/devices — filter by ownerType=COMPANY"
curl -s -X GET "$DEVICES_URL?owner=COMPANY&limit=10" | pretty

header "GET /api/devices — free-text search"
curl -s -X GET "$DEVICES_URL?search=Core+Switch&limit=10" | pretty

header "GET /api/devices — sorted by name ASC"
curl -s -X GET "$DEVICES_URL?sortBy=name&sortOrder=ASC&limit=10" | pretty

# ----------------------------------------
# GET /api/devices/:id — get by ID
# ----------------------------------------
header "GET /api/devices/:id — get by ID"
if [ -n "$DEVICE_ID" ] && [ "$DEVICE_ID" != "null" ]; then
  curl -s -X GET "$DEVICES_URL/$DEVICE_ID" | pretty
else
  echo "Skipped: no device ID available (create may have failed)"
fi

# ----------------------------------------
# PATCH /api/devices/:id — update
# ----------------------------------------
header "PATCH /api/devices/:id — update name and description"
if [ -n "$DEVICE_ID" ] && [ "$DEVICE_ID" != "null" ]; then
  curl -s -X PATCH "$DEVICES_URL/$DEVICE_ID" \
    -H "$CONTENT_TYPE" \
    -d '{
      "name": "Core Switch 01 (updated)",
      "description": "Updated by curl test",
      "monitoringEnabled": true
    }' | pretty
else
  echo "Skipped: no device ID available"
fi

header "PATCH /api/devices/:id — change status to ACTIVE (requires IP address)"
if [ -n "$DEVICE_ID" ] && [ "$DEVICE_ID" != "null" ]; then
  curl -s -X PATCH "$DEVICES_URL/$DEVICE_ID" \
    -H "$CONTENT_TYPE" \
    -d '{
      "status": "ACTIVE",
      "ipAddress": "192.168.1.100"
    }' | pretty
else
  echo "Skipped: no device ID available"
fi

# ----------------------------------------
# Error cases
# ----------------------------------------
header "GET /api/devices/:id — invalid UUID (expect 400)"
curl -s -X GET "$DEVICES_URL/not-a-uuid" | pretty

header "GET /api/devices/:id — non-existent ID (expect 404)"
curl -s -X GET "$DEVICES_URL/00000000-0000-4000-a000-000000000000" | pretty

header "POST /api/devices — missing required fields (expect 400)"
curl -s -X POST "$DEVICES_URL" \
  -H "$CONTENT_TYPE" \
  -d '{"name": "Incomplete Device"}' | pretty

header "POST /api/devices — invalid MAC address (expect 400)"
curl -s -X POST "$DEVICES_URL" \
  -H "$CONTENT_TYPE" \
  -d '{
    "deviceModelId": "'"$DEVICE_MODEL_ID"'",
    "name": "Bad MAC Device",
    "ownerType": "COMPANY",
    "macAddress": "not-a-mac"
  }' | pretty

header "POST /api/devices — invalid IPv4 address (expect 400)"
curl -s -X POST "$DEVICES_URL" \
  -H "$CONTENT_TYPE" \
  -d '{
    "deviceModelId": "'"$DEVICE_MODEL_ID"'",
    "name": "Bad IP Device",
    "ownerType": "COMPANY",
    "ipAddress": "999.999.999.999"
  }' | pretty
