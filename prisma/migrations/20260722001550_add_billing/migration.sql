-- CreateEnum
CREATE TYPE "bill_status" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "status" "bill_status" NOT NULL DEFAULT 'PENDING',
    "issue_date" TIMESTAMPTZ NOT NULL,
    "due_date" TIMESTAMPTZ NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_line_items" (
    "id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "contracted_service_id" UUID NOT NULL,
    "service_plan_id" UUID NOT NULL,
    "plan_name" VARCHAR(100) NOT NULL,
    "monthly_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "bill_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bills_customer_id_idx" ON "bills"("customer_id");

-- CreateIndex
CREATE INDEX "bills_status_idx" ON "bills"("status");

-- CreateIndex
CREATE INDEX "bills_period_year_period_month_idx" ON "bills"("period_year", "period_month");

-- CreateIndex
CREATE INDEX "bill_line_items_bill_id_idx" ON "bill_line_items"("bill_id");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (partial unique index — DB backstop against duplicate non-cancelled bills per customer+period)
CREATE UNIQUE INDEX "bills_customer_period_active_key"
ON "bills"("customer_id", "period_year", "period_month")
WHERE "status" <> 'CANCELLED';

