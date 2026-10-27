-- CreateEnum
CREATE TYPE "speed_test_status" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "speed_test_results" (
    "id" UUID NOT NULL,
    "status" "speed_test_status" NOT NULL,
    "download_mbps" DOUBLE PRECISION,
    "upload_mbps" DOUBLE PRECISION,
    "latency_ms" DOUBLE PRECISION,
    "jitter_ms" DOUBLE PRECISION,
    "server_location" VARCHAR(50),
    "error" VARCHAR(500),
    "started_by_id" UUID,
    "started_by_email" VARCHAR(255) NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "speed_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speed_test_results_started_at_idx" ON "speed_test_results"("started_at" DESC);

-- CreateIndex
CREATE INDEX "speed_test_results_started_by_id_idx" ON "speed_test_results"("started_by_id");

-- AddForeignKey
ALTER TABLE "speed_test_results" ADD CONSTRAINT "speed_test_results_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

