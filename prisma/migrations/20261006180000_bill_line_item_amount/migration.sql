-- AlterTable: existing lines charged the full monthly price
ALTER TABLE "bill_line_items" ADD COLUMN "amount" DECIMAL(12,2),
ADD COLUMN "service_from" DATE,
ADD COLUMN "service_to" DATE;

UPDATE "bill_line_items" SET "amount" = "monthly_price";

ALTER TABLE "bill_line_items" ALTER COLUMN "amount" SET NOT NULL;
