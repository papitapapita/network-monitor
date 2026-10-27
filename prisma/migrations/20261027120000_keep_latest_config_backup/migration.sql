-- BKP-030: only the latest configuration of each device is kept. Removes the
-- older versions saved while up to 30 were kept.
DELETE FROM "config_backups" cb
USING (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "device_id"
           ORDER BY "taken_at" DESC, "id" DESC
         ) AS "rank"
  FROM "config_backups"
) ranked
WHERE cb."id" = ranked."id"
  AND ranked."rank" > 1;
