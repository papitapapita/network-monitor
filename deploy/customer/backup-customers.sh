#!/usr/bin/env bash
# Dumps every customer's database into <customer>/backups and keeps the last
# $KEEP_DAYS days. Meant for a nightly cron (docs/operations/new-customer.md).
set -euo pipefail

ROOT="${NMS_CUSTOMERS_DIR:-$HOME/nms-customers}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
FAILED=0

for env in "$ROOT"/*/.env; do
  [ -f "$env" ] || continue
  dir="$(dirname "$env")"
  name="$(basename "$dir")"
  out="$dir/backups/$name-$STAMP.dump"
  mkdir -p "$dir/backups"
  if docker compose --project-directory "$dir" exec -T db \
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$out.part"; then
    mv "$out.part" "$out"
    chmod 600 "$out"
    echo "$name: $out"
  else
    rm -f "$out.part"
    echo "$name: backup FAILED" >&2
    FAILED=1
  fi
  find "$dir/backups" -name '*.dump' -mtime "+$KEEP_DAYS" -delete
done

exit "$FAILED"
