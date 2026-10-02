#!/usr/bin/env bash
# Builds nms-backend and nms-frontend from the checked-out repos, then
# restarts every customer install on them; each backend applies its pending
# migrations as it starts (docs/operations/new-customer.md).
#
#   deploy/customer/update-customers.sh              build, then update all
#   deploy/customer/update-customers.sh --build-only build the images only
#   deploy/customer/update-customers.sh <name>...    build, then update these
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${NMS_CUSTOMERS_DIR:-$HOME/nms-customers}"
BACKEND_REPO="${NMS_BACKEND_REPO:-$(cd "$HERE/../.." && pwd)}"
FRONTEND_REPO="${NMS_FRONTEND_REPO:-$(cd "$BACKEND_REPO/.." && pwd)/frontend}"

BUILD_ONLY=false
if [ "${1:-}" = --build-only ]; then
  BUILD_ONLY=true
  shift
fi

[ -f "$FRONTEND_REPO/package.json" ] ||
  { echo "error: no frontend repo at $FRONTEND_REPO; set NMS_FRONTEND_REPO" >&2; exit 1; }

echo "Building nms-backend from $BACKEND_REPO ($(git -C "$BACKEND_REPO" rev-parse --short HEAD))"
docker build -t nms-backend:latest "$BACKEND_REPO"
echo "Building nms-frontend from $FRONTEND_REPO ($(git -C "$FRONTEND_REPO" rev-parse --short HEAD))"
docker build -t nms-frontend:latest "$FRONTEND_REPO"

$BUILD_ONLY && exit 0

if [ $# -gt 0 ]; then
  NAMES=("$@")
else
  NAMES=()
  for env in "$ROOT"/*/.env; do
    [ -f "$env" ] && NAMES+=("$(basename "$(dirname "$env")")")
  done
fi

for name in "${NAMES[@]}"; do
  dir="$ROOT/$name"
  [ -f "$dir/.env" ] || { echo "error: $dir is not a customer install" >&2; exit 1; }
  echo "Updating $name"
  cp "$HERE/compose.yml" "$dir/compose.yml"
  docker compose --project-directory "$dir" up -d
done

docker image prune -f >/dev/null
echo "Done. Check each install with: docker compose --project-directory $ROOT/<name> ps"
