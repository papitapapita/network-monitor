-- CreateType: reachability is three-valued, not a boolean. UNKNOWN means nobody
-- is watching the device — it has never been polled, or monitoring was turned
-- off — and is distinct from DOWN, which is an observed outage.
CREATE TYPE "reachability_status" AS ENUM ('UP', 'DOWN', 'UNKNOWN');

-- AlterTable
ALTER TABLE "device_states"
  ADD COLUMN "status" "reachability_status" NOT NULL DEFAULT 'UNKNOWN';

-- Backfill: a row only exists once the device has been polled, so is_online is
-- a real observation. The last_checked_at guard covers any row that somehow
-- predates that, which must not be presented as an observed outage.
UPDATE "device_states"
  SET "status" = CASE
    WHEN "last_checked_at" IS NULL THEN 'UNKNOWN'::"reachability_status"
    WHEN "is_online" THEN 'UP'::"reachability_status"
    ELSE 'DOWN'::"reachability_status"
  END;

-- AlterTable
ALTER TABLE "device_states" DROP COLUMN "is_online";
