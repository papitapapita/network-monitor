-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_sign_ins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sign_in_paused_until" TIMESTAMPTZ;

-- IDN-044: a pause only follows the free failures.
ALTER TABLE "users" ADD CONSTRAINT "users_sign_in_pause_check" CHECK (
  "failed_sign_ins" >= 0
  AND ("sign_in_paused_until" IS NULL OR "failed_sign_ins" >= 5)
);
