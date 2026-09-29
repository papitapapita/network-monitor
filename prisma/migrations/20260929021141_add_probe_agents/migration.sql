-- CreateEnum
CREATE TYPE "agent_status" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "probe_agents" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "status" "agent_status" NOT NULL DEFAULT 'PENDING',
    "pairing_code_hash" CHAR(64),
    "pairing_expires_at" TIMESTAMPTZ,
    "token_hash" CHAR(64),
    "enrolled_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "last_seen_at" TIMESTAMPTZ,
    "agent_version" VARCHAR(32),
    "clock_offset_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "probe_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "probe_agents_name_key" ON "probe_agents"("name");

-- CreateIndex
CREATE UNIQUE INDEX "probe_agents_pairing_code_hash_key" ON "probe_agents"("pairing_code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "probe_agents_token_hash_key" ON "probe_agents"("token_hash");
