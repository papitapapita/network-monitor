-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "scheduled_end_time" VARCHAR(5),
ADD COLUMN     "scheduled_start_time" VARCHAR(5);

-- Mirrors the Ticket aggregate so a direct write cannot store a half block,
-- a block with no day, or a block that ends before it starts. Zero-padded
-- HH:mm strings compare correctly as text.
ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_time_block_both_or_neither"
CHECK (("scheduled_start_time" IS NULL) = ("scheduled_end_time" IS NULL));

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_time_block_requires_date"
CHECK ("scheduled_start_time" IS NULL OR "scheduled_for" IS NOT NULL);

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_time_block_end_after_start"
CHECK ("scheduled_start_time" IS NULL OR "scheduled_end_time" > "scheduled_start_time");
