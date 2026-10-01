-- CreateEnum
CREATE TYPE "agent_update_outcome" AS ENUM ('INSTALLED', 'ROLLED_BACK', 'REJECTED');

-- AlterTable
ALTER TABLE "probe_agents" ADD COLUMN     "last_update_at" TIMESTAMPTZ,
ADD COLUMN     "last_update_outcome" "agent_update_outcome",
ADD COLUMN     "last_update_reason" VARCHAR(500),
ADD COLUMN     "last_update_version" VARCHAR(32);

-- AGT-084: version, outcome and time are set together; a reason only
-- accompanies a failure.
ALTER TABLE "probe_agents" ADD CONSTRAINT "probe_agents_last_update_check" CHECK (
  (
    "last_update_version" IS NULL AND "last_update_outcome" IS NULL
    AND "last_update_reason" IS NULL AND "last_update_at" IS NULL
  ) OR (
    "last_update_version" IS NOT NULL AND "last_update_outcome" IS NOT NULL
    AND "last_update_at" IS NOT NULL
    AND ("last_update_reason" IS NULL) = ("last_update_outcome" = 'INSTALLED')
  )
);
