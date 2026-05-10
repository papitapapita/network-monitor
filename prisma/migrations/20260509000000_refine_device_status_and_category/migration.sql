-- Migrate existing rows to valid new enum values before altering types
UPDATE "devices" SET "status" = 'INVENTORY' WHERE "status" = 'MAINTENANCE';
UPDATE "devices" SET "status" = 'DAMAGED'   WHERE "status" = 'DECOMMISSIONED';
UPDATE "devices" SET "category" = NULL
  WHERE "category" IN ('CORE', 'DISTRIBUTION', 'POE', 'ACCESS_POINT', 'CLIENT_CPE');

-- Recreate device_status: remove DECOMMISSIONED and MAINTENANCE
ALTER TABLE "devices" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "device_status" RENAME TO "device_status_old";
CREATE TYPE "device_status" AS ENUM ('ACTIVE', 'DAMAGED', 'INVENTORY');
ALTER TABLE "devices"
  ALTER COLUMN "status" TYPE "device_status"
  USING "status"::text::"device_status";
ALTER TABLE "devices"
  ALTER COLUMN "status" SET DEFAULT 'INVENTORY'::"device_status";
DROP TYPE "device_status_old";

-- Recreate device_category: replace old network-role values with new hardware categories
ALTER TYPE "device_category" RENAME TO "device_category_old";
CREATE TYPE "device_category" AS ENUM ('CPE', 'AP', 'ROUTERBOARD', 'SMART_SWITCH', 'SMART_SWITCH_POE', 'OTHER');
ALTER TABLE "devices"
  ALTER COLUMN "category" TYPE "device_category"
  USING "category"::text::"device_category";
DROP TYPE "device_category_old";
