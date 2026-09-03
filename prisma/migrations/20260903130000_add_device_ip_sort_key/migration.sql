-- DEV-147 established DB-level ORDER BY for every listing. `sortBy=ipAddress`
-- reused that path directly on `ip_address`, which is a plain VARCHAR — so it
-- sorted lexicographically ("10.0.0.1" before "9.0.0.1"), not by address
-- value.
--
-- `ip_sort_key` is a STORED generated column: Postgres casts the address to
-- `inet` and serializes it with `inet_send()`, the type's own binary wire
-- format (family byte, then netmask, then the address bytes themselves).
-- Comparing that bytea byte-by-byte reproduces `inet`'s comparison order
-- (family, then network, then host), which is what "numeric" means for both
-- IPv4 and IPv6 — including addresses this table doesn't hold today.
--
-- Being generated means Postgres maintains it on every insert and update;
-- nothing in the application ever writes to this column, so there is no
-- write path to keep in sync and no backfill step — the ALTER TABLE below
-- computes it for every existing row immediately.
ALTER TABLE "devices"
  ADD COLUMN "ip_sort_key" BYTEA
  GENERATED ALWAYS AS (inet_send("ip_address"::inet)) STORED;

CREATE INDEX "devices_ip_sort_key_idx" ON "devices"("ip_sort_key");
