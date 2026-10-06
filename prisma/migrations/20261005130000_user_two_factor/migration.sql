-- AlterTable
ALTER TABLE "users" ADD COLUMN     "recovery_code_hashes" VARCHAR(64)[] DEFAULT ARRAY[]::VARCHAR(64)[],
ADD COLUMN     "two_factor_enabled_at" TIMESTAMPTZ,
ADD COLUMN     "two_factor_last_step" INTEGER,
ADD COLUMN     "two_factor_secret" VARCHAR(255);

-- IDN-160: two-factor is on only with a secret; codes are kept only while it
-- is on, and at most ten recovery codes at a time.
ALTER TABLE "users" ADD CONSTRAINT "users_two_factor_check" CHECK (
  ("two_factor_enabled_at" IS NULL OR "two_factor_secret" IS NOT NULL)
  AND (
    "two_factor_enabled_at" IS NOT NULL
    OR ("two_factor_last_step" IS NULL AND cardinality("recovery_code_hashes") = 0)
  )
  AND cardinality("recovery_code_hashes") <= 10
);
