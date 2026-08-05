-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ticket_category" AS ENUM ('CONNECTIVITY', 'INSTALLATION', 'HARDWARE_FAILURE', 'MAINTENANCE', 'RELOCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ticket_origin" AS ENUM ('MANUAL', 'DEVICE_ALERT', 'WIRELESS_ALERT');

-- CreateTable
CREATE TABLE "technicians" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "priority" "ticket_priority" NOT NULL DEFAULT 'NORMAL',
    "category" "ticket_category" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "customer_id" UUID,
    "device_id" UUID,
    "technician_id" UUID,
    "address_street" VARCHAR(255),
    "address_municipality" VARCHAR(100),
    "address_neighborhood" VARCHAR(150),
    "address_reference" VARCHAR(255),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "scheduled_for" DATE,
    "origin" "ticket_origin" NOT NULL DEFAULT 'MANUAL',
    "origin_alert_id" UUID,
    "resolution_notes" TEXT,
    "cancel_reason" VARCHAR(255),
    "created_by" UUID,
    "assigned_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technicians_phone_key" ON "technicians"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_email_key" ON "technicians"("email");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_user_id_key" ON "technicians"("user_id");

-- CreateIndex
CREATE INDEX "technicians_is_active_idx" ON "technicians"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_code_key" ON "tickets"("code");

-- CreateIndex
CREATE INDEX "tickets_technician_id_scheduled_for_idx" ON "tickets"("technician_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "tickets_status_scheduled_for_idx" ON "tickets"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "tickets_customer_id_idx" ON "tickets"("customer_id");

-- CreateIndex
CREATE INDEX "tickets_device_id_idx" ON "tickets"("device_id");

-- CreateIndex
CREATE INDEX "tickets_origin_origin_alert_id_idx" ON "tickets"("origin", "origin_alert_id");

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
