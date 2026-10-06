
-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'BANK_TRANSFER', 'NEQUI', 'DAVIPLATA', 'BRE_B', 'OTHER');

-- CreateTable
CREATE TABLE "bill_payments" (
    "id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL,
    "reference" VARCHAR(100),
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_at" TIMESTAMPTZ NOT NULL,
    "recorded_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bill_payments_bill_id_key" ON "bill_payments"("bill_id");

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

