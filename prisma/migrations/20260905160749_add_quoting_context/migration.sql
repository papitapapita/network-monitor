-- CreateEnum
CREATE TYPE "quotation_status" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "device_models" ADD COLUMN     "image_url" VARCHAR(500);

-- The `ip_sort_key` and `replaces_device_id` indexes on `devices` were never
-- declared as `@@index` in schema.prisma (the first is on a generated column
-- Prisma's DSL can't express; the second was a plain oversight), so the
-- schema diff that produced this migration mistook both for orphans and
-- proposed dropping them, plus an invalid `ALTER COLUMN ... DROP DEFAULT` on
-- the generated column. Both indexes are now declared in the schema and
-- recreated here (IF NOT EXISTS, matching migration 20260818120000's style)
-- instead of dropped.
CREATE INDEX IF NOT EXISTS "devices_ip_sort_key_idx"
  ON "devices"("ip_sort_key");

CREATE INDEX IF NOT EXISTS "devices_replaces_device_id_idx"
  ON "devices"("replaces_device_id");

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "status" "quotation_status" NOT NULL DEFAULT 'DRAFT',
    "customer_id" UUID,
    "customer_name" VARCHAR(150) NOT NULL,
    "customer_phone" VARCHAR(20),
    "customer_email" VARCHAR(255),
    "customer_address" VARCHAR(255),
    "valid_until" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "sent_at" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "rejected_at" TIMESTAMPTZ,
    "rejection_reason" VARCHAR(255),
    "expired_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_line_items" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "device_model_id" UUID,
    "device_model_name" VARCHAR(150) NOT NULL,
    "vendor_name" VARCHAR(100) NOT NULL,
    "device_type" VARCHAR(50) NOT NULL,
    "image_url" VARCHAR(500),
    "description" VARCHAR(500) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "quotation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_code_key" ON "quotations"("code");

-- CreateIndex
CREATE INDEX "quotations_customer_id_idx" ON "quotations"("customer_id");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_created_at_idx" ON "quotations"("created_at");

-- CreateIndex
CREATE INDEX "quotation_line_items_quotation_id_idx" ON "quotation_line_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_line_items_device_model_id_idx" ON "quotation_line_items"("device_model_id");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
