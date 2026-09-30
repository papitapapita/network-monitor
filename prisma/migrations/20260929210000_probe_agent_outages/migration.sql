-- CreateTable
CREATE TABLE "probe_agent_outages" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "silent_since" TIMESTAMPTZ NOT NULL,
    "offline_since" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,
    "end_reason" VARCHAR(16),

    CONSTRAINT "probe_agent_outages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "probe_agent_outages_agent_id_offline_since_idx" ON "probe_agent_outages"("agent_id", "offline_since" DESC);

-- AddForeignKey
ALTER TABLE "probe_agent_outages" ADD CONSTRAINT "probe_agent_outages_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "probe_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- At most one open outage per agent (AGT-026). Prisma cannot express a
-- partial index, so it lives here only.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "probe_agent_outages_one_open_per_agent"
  ON "probe_agent_outages"("agent_id") WHERE "ended_at" IS NULL;

-- Agents already offline when this ships get their open outage now, so the
-- first reconnection has a row to close.
INSERT INTO "probe_agent_outages" ("id", "agent_id", "silent_since", "offline_since")
SELECT gen_random_uuid(), "id", COALESCE("last_seen_at", "enrolled_at", "offline_since"), "offline_since"
FROM "probe_agents"
WHERE "offline_since" IS NOT NULL;
