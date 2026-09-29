-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "agent_id" UUID;

-- CreateIndex
CREATE INDEX "devices_agent_id_idx" ON "devices"("agent_id");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "probe_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
