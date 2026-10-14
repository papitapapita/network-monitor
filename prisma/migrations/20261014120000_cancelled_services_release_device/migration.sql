-- CUS-106: cancelling a service now releases its device. Services cancelled
-- before this rule still hold theirs, which keeps those devices from backing
-- a new subscription (CUS-100). Device status is deliberately left alone:
-- whether each unit came back is not recorded anywhere.
UPDATE "contracted_services"
SET "device_id" = NULL,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "status" = 'CANCELLED'
  AND "device_id" IS NOT NULL;
