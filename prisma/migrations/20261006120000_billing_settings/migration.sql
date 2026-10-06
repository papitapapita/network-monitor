-- CreateEnum
CREATE TYPE "billing_mode" AS ENUM ('ADVANCE', 'ARREARS');

-- CreateTable
CREATE TABLE "billing_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "automatic_billing_enabled" BOOLEAN NOT NULL,
    "billing_mode" "billing_mode" NOT NULL,
    "issue_lead_days" SMALLINT NOT NULL,
    "grace_days" SMALLINT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_settings_pkey" PRIMARY KEY ("id"),
    -- A single row: the install has one billing cycle.
    CONSTRAINT "billing_settings_single_row" CHECK ("id" = 1)
);
