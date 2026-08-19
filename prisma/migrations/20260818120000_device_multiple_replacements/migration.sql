-- A device may be replaced more than once over its life: a unit retired into
-- INVENTORY after an upgrade can go back into service elsewhere and later be
-- replaced again. The unique index capped the lineage at one successor per
-- row, which made that second swap impossible to record.
--
-- Dropping it turns `replacedBy` into a collection. The current successor is
-- the most recently created row pointing at this one; the earlier rows stay as
-- the record of the previous service lives.
DROP INDEX IF EXISTS "devices_replaces_device_id_key";

-- The unique index was also the lookup path for the back-reference. Replace it
-- with a plain one so resolving "what replaced this unit" stays an index scan.
CREATE INDEX IF NOT EXISTS "devices_replaces_device_id_idx"
  ON "devices" ("replaces_device_id");
