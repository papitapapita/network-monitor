#!/usr/bin/env bash
# Shared configuration for curl endpoint tests

BASE_URL="${BASE_URL:-http://localhost:3000}"
CONTENT_TYPE="Content-Type: application/json"

# Pretty-print JSON if jq is available, otherwise raw output
pretty() {
  if command -v jq &>/dev/null; then
    jq .
  else
    cat
  fi
}

# Print a section header
header() {
  echo ""
  echo "========================================"
  echo "  $1"
  echo "========================================"
}
