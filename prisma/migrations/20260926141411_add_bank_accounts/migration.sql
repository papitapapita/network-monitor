-- CreateEnum
CREATE TYPE "bank_account_type" AS ENUM ('SAVINGS', 'CHECKING');

-- CreateTable
CREATE TABLE "collection_account_payment_accounts" (
    "id" UUID NOT NULL,
    "collection_account_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_type" "bank_account_type" NOT NULL,
    "account_number" VARCHAR(30) NOT NULL,

    CONSTRAINT "collection_account_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_type" "bank_account_type" NOT NULL,
    "account_number" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_account_payment_accounts_collection_account_id_idx" ON "collection_account_payment_accounts"("collection_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_bank_name_account_number_key" ON "bank_accounts"("bank_name", "account_number");

-- AddForeignKey
ALTER TABLE "collection_account_payment_accounts" ADD CONSTRAINT "collection_account_payment_accounts_collection_account_id_fkey" FOREIGN KEY ("collection_account_id") REFERENCES "collection_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
