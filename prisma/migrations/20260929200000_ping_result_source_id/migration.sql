-- AlterTable
ALTER TABLE "ping_results" ADD COLUMN     "source_result_id" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "ping_results_source_result_id_key" ON "ping_results"("source_result_id");
