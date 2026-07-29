-- Device category becomes a deployment role rather than a mix of role and
-- hardware kind. Hardware kind already lives on device_models.device_type.
--
--   AP               -> ACCESS_POINT       (renamed for clarity)
--   ROUTERBOARD      -> GATEWAY            (where upstream internet enters)
--   SMART_SWITCH     -> AGGREGATION_SWITCH (node switch radios converge on)
--   SMART_SWITCH_POE -> AGGREGATION_SWITCH (PoE is a hardware trait, not a role)
--
-- Rewritten as a type swap rather than RENAME VALUE because SMART_SWITCH and
-- SMART_SWITCH_POE collapse onto a single role, and Postgres cannot drop an
-- enum value in place.

CREATE TYPE "device_category_new" AS ENUM (
  'CPE',
  'WIRELESS_CPE',
  'ACCESS_POINT',
  'GATEWAY',
  'AGGREGATION_SWITCH',
  'OTHER'
);

ALTER TABLE "devices"
  ALTER COLUMN "category" TYPE "device_category_new"
  USING (
    CASE "category"::text
      WHEN 'AP' THEN 'ACCESS_POINT'
      WHEN 'ROUTERBOARD' THEN 'GATEWAY'
      WHEN 'SMART_SWITCH' THEN 'AGGREGATION_SWITCH'
      WHEN 'SMART_SWITCH_POE' THEN 'AGGREGATION_SWITCH'
      ELSE "category"::text
    END
  )::"device_category_new";

DROP TYPE "device_category";

ALTER TYPE "device_category_new" RENAME TO "device_category";
