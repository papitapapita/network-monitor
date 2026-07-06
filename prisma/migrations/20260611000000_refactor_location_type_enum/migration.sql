-- Rename POP → POINT_OF_PRESENCE (renames the enum value and all column data automatically)
ALTER TYPE "location_type" RENAME VALUE 'POP' TO 'POINT_OF_PRESENCE';

-- Add CUSTOMER_PREMISES
ALTER TYPE "location_type" ADD VALUE IF NOT EXISTS 'CUSTOMER_PREMISES';

-- Migrate any existing rows that use the removed types before dropping them
UPDATE "locations" SET "type" = 'TOWER'::"location_type" WHERE "type" = 'NODE'::"location_type";
UPDATE "locations" SET "type" = 'OTHER'::"location_type" WHERE "type" = 'WAREHOUSE'::"location_type";

-- Remove NODE and WAREHOUSE by recreating the enum without them
CREATE TYPE "location_type_new" AS ENUM ('TOWER', 'DATACENTER', 'POINT_OF_PRESENCE', 'OFFICE', 'CUSTOMER_PREMISES', 'OTHER');
ALTER TABLE "locations" ALTER COLUMN "type" TYPE "location_type_new" USING "type"::text::"location_type_new";
DROP TYPE "location_type";
ALTER TYPE "location_type_new" RENAME TO "location_type";
