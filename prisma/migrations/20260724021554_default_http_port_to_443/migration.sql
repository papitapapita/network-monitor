-- Device polling moved from SNMP to the airOS 8 HTTP API, and AirOsHttpClient
-- speaks HTTPS only -- there is no plaintext request path. A row defaulted to
-- port 80 would therefore never poll successfully.
--
-- DeviceCredentialsMapper.extractCreateData already defaults to 443, so this
-- default only applies to rows written outside the application (manual SQL,
-- seeds, backfills). No existing row uses 80, so no data migration is needed.

-- AlterTable
ALTER TABLE "device_credentials" ALTER COLUMN "http_port" SET DEFAULT 443;
