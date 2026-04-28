#!/usr/bin/env bash
# curl-tests.sh — Manual smoke tests for all HTTP endpoints
# Usage: ./curl-tests.sh [BASE_URL]
# Default base URL: http://localhost:3000

BASE="${1:-http://localhost:3000}"
SEP="─────────────────────────────────────────"

# IDs captured from create responses — override these to reuse existing records
LOCATION_ID="${LOCATION_ID:-}"
DEVICE_MODEL_ID="${DEVICE_MODEL_ID:-279a4711-aef5-4a31-aff6-cddb1c9918ba}"
DEVICE_ID="${DEVICE_ID:-}"

pass() { echo -e "\033[32m[PASS]\033[0m $1"; }
fail() { echo -e "\033[31m[FAIL]\033[0m $1"; }
info() { echo -e "\033[36m[INFO]\033[0m $1"; }
section() { echo -e "\n$SEP\n  $1\n$SEP"; }

run() {
  local label="$1"; shift
  echo ""
  info "$label"
  echo "  $ $*"
  local body
  body=$(eval "$@" 2>&1)
  echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
}

# ─────────────────────────────────────────
#  HEALTH CHECK
# ─────────────────────────────────────────
section "Health Check"

run "GET /health" \
  curl -s -X GET "$BASE/health"

# ─────────────────────────────────────────
#  LOCATIONS
# ─────────────────────────────────────────
section "POST /api/locations — create a location (minimal)"

LOCATION_RESPONSE=$(curl -s -X POST "$BASE/api/locations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tower Alpha",
    "type": "TOWER"
  }')
echo "$LOCATION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOCATION_RESPONSE"
if [ -z "$LOCATION_ID" ]; then
  LOCATION_ID=$(echo "$LOCATION_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null)
  [ -n "$LOCATION_ID" ] && info "Captured LOCATION_ID=$LOCATION_ID"
fi

echo ""
section "POST /api/locations — create a location (full)"

run "POST /api/locations (full body)" \
  curl -s -X POST "'$BASE/api/locations'" \
  -H "'Content-Type: application/json'" \
  -d "'{
    \"name\": \"Main Datacenter\",
    \"type\": \"DATACENTER\",
    \"municipality\": \"São Paulo\",
    \"neighborhood\": \"Centro\",
    \"address\": \"Rua das Flores, 100\",
    \"latitude\": -23.5505,
    \"longitude\": -46.6333,
    \"altitude\": 760
  }'"

echo ""
section "POST /api/locations — validation errors"

run "Missing required fields" \
  curl -s -X POST "'$BASE/api/locations'" \
  -H "'Content-Type: application/json'" \
  -d "'{\"name\": \"\"}'"

run "Invalid location type" \
  curl -s -X POST "'$BASE/api/locations'" \
  -H "'Content-Type: application/json'" \
  -d "'{\"name\": \"Test\", \"type\": \"INVALID_TYPE\"}'"

run "Unpaired coordinates (lat without lon)" \
  curl -s -X POST "'$BASE/api/locations'" \
  -H "'Content-Type: application/json'" \
  -d "'{\"name\": \"Test\", \"type\": \"TOWER\", \"latitude\": -23.5}'"

echo ""
section "GET /api/locations — list (default pagination)"

run "GET /api/locations" \
  curl -s -X GET "'$BASE/api/locations'"

run "GET /api/locations?limit=5&offset=0" \
  curl -s -X GET "'$BASE/api/locations?limit=5&offset=0'"

run "GET /api/locations?type=TOWER" \
  curl -s -X GET "'$BASE/api/locations?type=TOWER'"

run "GET /api/locations?limit=101 (exceeds max)" \
  curl -s -X GET "'$BASE/api/locations?limit=101'"

echo ""
section "GET /api/locations/:id"

if [ -n "$LOCATION_ID" ]; then
  run "GET /api/locations/$LOCATION_ID (exists)" \
    curl -s -X GET "'$BASE/api/locations/$LOCATION_ID'"
else
  info "Skipping GET by ID — no LOCATION_ID captured. Set LOCATION_ID=<uuid> and re-run."
fi

run "GET /api/locations/not-a-uuid (invalid ID)" \
  curl -s -X GET "'$BASE/api/locations/not-a-uuid'"

run "GET /api/locations/00000000-0000-4000-a000-000000000000 (not found)" \
  curl -s -X GET "'$BASE/api/locations/00000000-0000-4000-a000-000000000000'"

# ─────────────────────────────────────────
#  DEVICES
# ─────────────────────────────────────────
section "POST /api/devices — create a device (minimal)"

DEVICE_RESPONSE=$(curl -s -X POST "$BASE/api/devices" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceModelId\": \"$DEVICE_MODEL_ID\",
    \"name\": \"Router-01\",
    \"ownerType\": \"COMPANY\"
  }")
echo "$DEVICE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DEVICE_RESPONSE"
if [ -z "$DEVICE_ID" ]; then
  DEVICE_ID=$(echo "$DEVICE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null)
  [ -n "$DEVICE_ID" ] && info "Captured DEVICE_ID=$DEVICE_ID"
fi

echo ""
section "POST /api/devices — create a device (full)"

FULL_LOCATION="${LOCATION_ID:-00000000-0000-4000-a000-000000000002}"
run "POST /api/devices (full body)" \
  curl -s -X POST "'$BASE/api/devices'" \
  -H "'Content-Type: application/json'" \
  -d "'{
    \"deviceModelId\": \"$DEVICE_MODEL_ID\",
    \"name\": \"Switch-Core-01\",
    \"ownerType\": \"CLIENT\",
    \"status\": \"ACTIVE\",
    \"category\": \"CORE\",
    \"locationId\": \"$FULL_LOCATION\",
    \"serialNumber\": \"SN-2024-0042\",
    \"macAddress\": \"AA:BB:CC:DD:EE:FF\",
    \"ipAddress\": \"192.168.1.1\",
    \"description\": \"Core switch for main DC\",
    \"installedDate\": \"2024-01-15T00:00:00.000Z\",
    \"monitoringEnabled\": true
  }'"

echo ""
section "POST /api/devices — validation errors"

run "Missing required fields" \
  curl -s -X POST "'$BASE/api/devices'" \
  -H "'Content-Type: application/json'" \
  -d "'{\"name\": \"Test\"}'"

run "Invalid ownerType" \
  curl -s -X POST "'$BASE/api/devices'" \
  -H "'Content-Type: application/json'" \
  -d "'{
    \"deviceModelId\": \"$DEVICE_MODEL_ID\",
    \"name\": \"Test\",
    \"ownerType\": \"UNKNOWN\"
  }'"

run "Invalid macAddress format" \
  curl -s -X POST "'$BASE/api/devices'" \
  -H "'Content-Type: application/json'" \
  -d "'{
    \"deviceModelId\": \"$DEVICE_MODEL_ID\",
    \"name\": \"Test\",
    \"ownerType\": \"COMPANY\",
    \"macAddress\": \"not-a-mac\"
  }'"

run "Invalid ipAddress" \
  curl -s -X POST "'$BASE/api/devices'" \
  -H "'Content-Type: application/json'" \
  -d "'{
    \"deviceModelId\": \"$DEVICE_MODEL_ID\",
    \"name\": \"Test\",
    \"ownerType\": \"COMPANY\",
    \"ipAddress\": \"999.999.999.999\"
  }'"

echo ""
section "GET /api/devices — list (default pagination)"

run "GET /api/devices" \
  curl -s -X GET "'$BASE/api/devices'"

run "GET /api/devices?limit=5&offset=0" \
  curl -s -X GET "'$BASE/api/devices?limit=5&offset=0'"

run "GET /api/devices?status=ACTIVE" \
  curl -s -X GET "'$BASE/api/devices?status=ACTIVE'"

run "GET /api/devices?category=CORE" \
  curl -s -X GET "'$BASE/api/devices?category=CORE'"

run "GET /api/devices?owner=COMPANY" \
  curl -s -X GET "'$BASE/api/devices?owner=COMPANY'"

run "GET /api/devices?monitoringEnabled=true" \
  curl -s -X GET "'$BASE/api/devices?monitoringEnabled=true'"

run "GET /api/devices?search=Router" \
  curl -s -X GET "'$BASE/api/devices?search=Router'"

run "GET /api/devices?sortBy=name&sortOrder=ASC" \
  curl -s -X GET "'$BASE/api/devices?sortBy=name&sortOrder=ASC'"

run "GET /api/devices?deviceModelId=$DEVICE_MODEL_ID" \
  curl -s -X GET "'$BASE/api/devices?deviceModelId=$DEVICE_MODEL_ID'"

run "GET /api/devices?limit=101 (exceeds max)" \
  curl -s -X GET "'$BASE/api/devices?limit=101'"

echo ""
section "GET /api/devices/:id"

if [ -n "$DEVICE_ID" ]; then
  run "GET /api/devices/$DEVICE_ID (exists)" \
    curl -s -X GET "'$BASE/api/devices/$DEVICE_ID'"
else
  info "Skipping GET by ID — no DEVICE_ID captured. Set DEVICE_ID=<uuid> and re-run."
fi

run "GET /api/devices/not-a-uuid (invalid ID)" \
  curl -s -X GET "'$BASE/api/devices/not-a-uuid'"

run "GET /api/devices/00000000-0000-4000-a000-000000000000 (not found)" \
  curl -s -X GET "'$BASE/api/devices/00000000-0000-4000-a000-000000000000'"

echo ""
info "Done."
