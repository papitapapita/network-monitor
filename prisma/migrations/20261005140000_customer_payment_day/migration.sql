-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "payment_day" SMALLINT NOT NULL DEFAULT 30;

-- CUS-024: the two collection groups.
ALTER TABLE "customers" ADD CONSTRAINT "customers_payment_day_check" CHECK ("payment_day" IN (15, 30));
