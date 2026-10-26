-- AlterTable
ALTER TABLE "contracted_services" ADD COLUMN     "payment_day" SMALLINT NOT NULL DEFAULT 30;

-- Each service keeps the day its customer paid by until now.
UPDATE "contracted_services" AS cs
SET "payment_day" = c."payment_day"
FROM "customers" AS c
WHERE cs."customer_id" = c."id";

-- CUS-024: the two collection groups.
ALTER TABLE "contracted_services" ADD CONSTRAINT "contracted_services_payment_day_check" CHECK ("payment_day" IN (15, 30));

-- AlterTable
ALTER TABLE "customers" DROP CONSTRAINT "customers_payment_day_check";
ALTER TABLE "customers" DROP COLUMN "payment_day";

-- BIL-007: one live bill per service and period, no longer per customer.
DROP INDEX "bills_customer_period_active_key";

ALTER TABLE "bills" ADD COLUMN "contracted_service_id" UUID;

-- Bills already holding a single service name it; older multi-service bills stay null.
UPDATE "bills" AS b
SET "contracted_service_id" = li."contracted_service_id"
FROM (
  SELECT "bill_id", MIN("contracted_service_id"::text)::uuid AS "contracted_service_id"
  FROM "bill_line_items"
  GROUP BY "bill_id"
  HAVING COUNT(*) = 1
) AS li
WHERE li."bill_id" = b."id";

CREATE UNIQUE INDEX "bills_service_period_active_key"
ON "bills"("contracted_service_id", "period_year", "period_month")
WHERE "status" <> 'CANCELLED';
