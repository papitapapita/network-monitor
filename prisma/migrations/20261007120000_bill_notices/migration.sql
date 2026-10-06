
-- AlterTable
ALTER TABLE "billing_settings" ADD COLUMN     "reminder_whatsapp_template" VARCHAR(512);

-- CreateTable
CREATE TABLE "bill_reminders" (
    "id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "sent_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bill_reminders_bill_id_sent_on_key" ON "bill_reminders"("bill_id", "sent_on");

-- AddForeignKey
ALTER TABLE "bill_reminders" ADD CONSTRAINT "bill_reminders_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

