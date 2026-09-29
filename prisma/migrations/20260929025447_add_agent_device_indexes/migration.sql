-- AlterTable
ALTER TABLE "probe_agents" ADD COLUMN     "next_device_index" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "probe_agent_device_indexes" (
    "agent_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "device_index" INTEGER NOT NULL,

    CONSTRAINT "probe_agent_device_indexes_pkey" PRIMARY KEY ("agent_id","device_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "probe_agent_device_indexes_agent_id_device_index_key" ON "probe_agent_device_indexes"("agent_id", "device_index");

-- AddForeignKey
ALTER TABLE "probe_agent_device_indexes" ADD CONSTRAINT "probe_agent_device_indexes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "probe_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probe_agent_device_indexes" ADD CONSTRAINT "probe_agent_device_indexes_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
