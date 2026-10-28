-- CreateTable
CREATE TABLE "port_expected_speeds" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "port_name" VARCHAR(64) NOT NULL,
    "expected_mbps" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "port_expected_speeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "port_expected_speeds_device_id_port_name_key" ON "port_expected_speeds"("device_id", "port_name");

-- AddForeignKey
ALTER TABLE "port_expected_speeds" ADD CONSTRAINT "port_expected_speeds_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
