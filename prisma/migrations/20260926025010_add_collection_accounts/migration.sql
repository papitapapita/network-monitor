-- CreateEnum
CREATE TYPE "collection_account_status" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "collection_accounts" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "status" "collection_account_status" NOT NULL DEFAULT 'PENDING',
    "customer_id" UUID,
    "customer_name" VARCHAR(150) NOT NULL,
    "customer_document" VARCHAR(20),
    "customer_phone" VARCHAR(20),
    "customer_email" VARCHAR(255),
    "customer_address" VARCHAR(255),
    "issue_date" TIMESTAMPTZ NOT NULL,
    "due_date" TIMESTAMPTZ,
    "notes" TEXT,
    "paid_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "collection_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_account_line_items" (
    "id" UUID NOT NULL,
    "collection_account_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "collection_account_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_accounts_code_key" ON "collection_accounts"("code");

-- CreateIndex
CREATE INDEX "collection_accounts_customer_id_idx" ON "collection_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "collection_accounts_status_idx" ON "collection_accounts"("status");

-- CreateIndex
CREATE INDEX "collection_accounts_created_at_idx" ON "collection_accounts"("created_at");

-- CreateIndex
CREATE INDEX "collection_account_line_items_collection_account_id_idx" ON "collection_account_line_items"("collection_account_id");

-- AddForeignKey
ALTER TABLE "collection_accounts" ADD CONSTRAINT "collection_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_account_line_items" ADD CONSTRAINT "collection_account_line_items_collection_account_id_fkey" FOREIGN KEY ("collection_account_id") REFERENCES "collection_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
