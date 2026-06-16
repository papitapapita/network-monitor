-- CreateEnum
CREATE TYPE "contracted_service_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "device_status" ADD VALUE 'COMMISSIONING';

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "cedula" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "download_mbps" INTEGER NOT NULL,
    "upload_mbps" INTEGER NOT NULL,
    "monthly_price" DECIMAL(12,2) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracted_services" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "service_plan_id" UUID NOT NULL,
    "device_id" UUID,
    "status" "contracted_service_status" NOT NULL DEFAULT 'PENDING',
    "start_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contracted_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_cedula_key" ON "customers"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "service_plans_name_key" ON "service_plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "contracted_services_device_id_key" ON "contracted_services"("device_id");

-- CreateIndex
CREATE INDEX "contracted_services_customer_id_idx" ON "contracted_services"("customer_id");

-- CreateIndex
CREATE INDEX "contracted_services_status_idx" ON "contracted_services"("status");

-- AddForeignKey
ALTER TABLE "contracted_services" ADD CONSTRAINT "contracted_services_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracted_services" ADD CONSTRAINT "contracted_services_service_plan_id_fkey" FOREIGN KEY ("service_plan_id") REFERENCES "service_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracted_services" ADD CONSTRAINT "contracted_services_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
