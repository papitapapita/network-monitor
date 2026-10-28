-- AlterTable
ALTER TABLE "port_expected_speeds" ADD COLUMN     "alerted_at" TIMESTAMPTZ,
ADD COLUMN     "slow_checks" INTEGER NOT NULL DEFAULT 0;
