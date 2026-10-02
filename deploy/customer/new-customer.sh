#!/usr/bin/env bash
# Creates and starts one customer install (docs/operations/new-customer.md):
# a folder under $NMS_CUSTOMERS_DIR with its own database, secrets, ports and
# subnet, running the nms-backend and nms-frontend images.
#
#   deploy/customer/new-customer.sh <name> [--paid-until YYYY-MM-DD] [--host <hostname>]
set -euo pipefail

usage() {
  echo "usage: $0 <name> [--paid-until YYYY-MM-DD] [--host <hostname>]" >&2
  exit 2
}

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${NMS_CUSTOMERS_DIR:-$HOME/nms-customers}"

[ $# -ge 1 ] || usage
NAME="$1"
shift
PAID_UNTIL=""
HOST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --paid-until) PAID_UNTIL="${2:-}"; shift 2 ;;
    --host) HOST="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

fail() {
  echo "error: $*" >&2
  exit 1
}

[[ "$NAME" =~ ^[a-z][a-z0-9-]{1,30}$ ]] ||
  fail "name must be 2-31 lowercase letters, digits or dashes, starting with a letter"
[ -z "$PAID_UNTIL" ] || [[ "$PAID_UNTIL" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] ||
  fail "--paid-until must be YYYY-MM-DD"

VENDOR_ENV="$ROOT/vendor.env"
[ -f "$VENDOR_ENV" ] ||
  fail "$VENDOR_ENV is missing; copy it from $HERE/vendor.env.example and fill it in"
# shellcheck disable=SC1090
. "$VENDOR_ENV"
for var in TELEGRAM_BOT_TOKEN TELEGRAM_VENDOR_CHAT_ID VENDOR_EMAIL CUSTOMER_DOMAIN INSTALLERS_DIR; do
  [ -n "${!var:-}" ] || fail "$var is empty in $VENDOR_ENV"
done
[ -d "$INSTALLERS_DIR" ] || fail "INSTALLERS_DIR $INSTALLERS_DIR is not a folder"

for image in nms-backend:latest nms-frontend:latest; do
  docker image inspect "$image" >/dev/null 2>&1 ||
    fail "image $image not found; build it with deploy/customer/update-customers.sh"
done

DIR="$ROOT/$NAME"
[ ! -e "$DIR" ] || fail "$DIR already exists"
HOST="${HOST:-$NAME.$CUSTOMER_DOMAIN}"

# Each install gets the next free index: its ports and subnet derive from it.
INDEX=0
for env in "$ROOT"/*/.env; do
  [ -f "$env" ] || continue
  n="$(sed -n 's/^NMS_INDEX=//p' "$env")"
  [ -n "$n" ] && [ "$n" -gt "$INDEX" ] && INDEX="$n"
done
INDEX=$((INDEX + 1))
[ "$INDEX" -le 250 ] || fail "no free index left"
BACKEND_PORT=$((4000 + INDEX * 10))
WEB_PORT=$((BACKEND_PORT + 1))
SUBNET="10.88.$INDEX.0/24"

hex() { openssl rand -hex "$1"; }
DB_PASSWORD="$(hex 24)"
VENDOR_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)"

umask 077
mkdir -p "$DIR/backups"
cp "$HERE/compose.yml" "$DIR/compose.yml"

cat >"$DIR/.env" <<EOF
CUSTOMER=$NAME
NMS_INDEX=$INDEX
HOST=$HOST
BACKEND_PORT=$BACKEND_PORT
WEB_PORT=$WEB_PORT
SUBNET=$SUBNET
INSTALLERS_DIR=$INSTALLERS_DIR
EOF

cat >"$DIR/db.env" <<EOF
POSTGRES_USER=nms
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=nms
EOF

cat >"$DIR/backend.env" <<EOF
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
DATABASE_URL=postgresql://nms:$DB_PASSWORD@db:5432/nms
JWT_SECRET=$(hex 32)
DEVICE_CREDENTIALS_KEY=$(hex 32)
ALLOWED_ORIGINS=https://$HOST
AGENT_PUBLIC_URL=https://$HOST
TRUST_PROXY=$SUBNET
ENABLED_MODULES=monitoring
SERVER_ON_SITE=false
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_VENDOR_CHAT_ID=$TELEGRAM_VENDOR_CHAT_ID
VENDOR_EMAIL=$VENDOR_EMAIL
VENDOR_PASSWORD=$VENDOR_PASSWORD
SUBSCRIPTION_PAID_UNTIL=$PAID_UNTIL
EOF

echo "Starting $NAME (index $INDEX)..."
docker compose --project-directory "$DIR" up -d

CONTAINER="$(docker compose --project-directory "$DIR" ps -q backend)"
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true)"
  [ "$status" = healthy ] && break
  sleep 3
done
if [ "$status" != healthy ]; then
  docker compose --project-directory "$DIR" logs --tail 40 backend >&2
  fail "the backend did not become healthy; $DIR is left as is for a look"
fi

# The vendor account now exists; the password is needed only to create it
# (IDN-011) and must not stay on disk.
sed -i '/^VENDOR_PASSWORD=/d' "$DIR/backend.env"

cat <<EOF

$NAME is running.

  Dashboard   https://$HOST
  Login       $VENDOR_EMAIL
  Password    $VENDOR_PASSWORD   (shown once; change it after signing in)

Cloudflare tunnel, public hostname $HOST (two rules, this order):
  1. path ^/agent/   ->  http://localhost:$BACKEND_PORT
  2. (no path)       ->  http://localhost:$WEB_PORT

Then follow docs/operations/new-customer.md from "After the script".
EOF
