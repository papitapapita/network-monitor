/*
  Warnings:

  - You are about to drop the column `manufacturer` on the `device_models` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[vendor_id,model]` on the table `device_models` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `vendor_id` to the `device_models` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: rename the vendors enum so the "vendors" name is free for the new table.
-- The manufacturer column keeps working because it still references the renamed type.
ALTER TYPE "vendors" RENAME TO "vendors_old";

-- Step 2: add vendor_id as nullable so we can backfill before enforcing NOT NULL
ALTER TABLE "device_models" ADD COLUMN "vendor_id" UUID;

-- Step 3: create the vendors table (name is now free)
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendors_name_key" ON "vendors"("name");
CREATE UNIQUE INDEX "vendors_slug_key" ON "vendors"("slug");

-- Step 4: seed a vendor row for every enum value
INSERT INTO "vendors" ("id", "name", "slug", "updated_at")
VALUES
    (gen_random_uuid(), 'TP-Link',  'tp-link',  NOW()),
    (gen_random_uuid(), 'MikroTik', 'mikrotik', NOW()),
    (gen_random_uuid(), 'Ubiquiti', 'ubiquiti', NOW()),
    (gen_random_uuid(), 'Mimosa',   'mimosa',   NOW()),
    (gen_random_uuid(), 'Tenda',    'tenda',    NOW()),
    (gen_random_uuid(), 'Other',    'other',    NOW());

-- Step 5: backfill vendor_id using the manufacturer column (still alive, now typed as vendors_old)
UPDATE "device_models" dm
SET "vendor_id" = vnd."id"
FROM "vendors" vnd
WHERE vnd."slug" = CASE dm.manufacturer::text
    WHEN 'TP_LINK'  THEN 'tp-link'
    WHEN 'MIKROTIK' THEN 'mikrotik'
    WHEN 'UBIQUITI' THEN 'ubiquiti'
    WHEN 'MIMOSA'   THEN 'mimosa'
    WHEN 'TENDA'    THEN 'tenda'
    WHEN 'OTHER'    THEN 'other'
END;

-- Step 6: enforce NOT NULL now that every row has a vendor_id
ALTER TABLE "device_models" ALTER COLUMN "vendor_id" SET NOT NULL;

-- Step 7: drop old unique index and manufacturer column, then the old enum
DROP INDEX "device_models_manufacturer_model_key";
ALTER TABLE "device_models" DROP COLUMN "manufacturer";
DROP TYPE "vendors_old";

-- Step 8: add new unique index and FK
CREATE UNIQUE INDEX "device_models_vendor_id_model_key" ON "device_models"("vendor_id", "model");

ALTER TABLE "device_models" ADD CONSTRAINT "device_models_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
