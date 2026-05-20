// ============================================================================
// ISP Watch — Development Seed
// Run with: npm run db:seed
// ============================================================================
// Uses the application use-case layer exclusively — no raw Prisma calls.
// Covers every edge case for wireless monitoring:
//   WIRELESS_CPE: healthy / degraded / critical / polling-disabled / no-ip / no-config
//   AP: full config with client limit
//   CPE (wired): must NOT have wireless config — tests the guard
//   ROUTERBOARD, SMART_SWITCH: infrastructure-only, no wireless
//   INVENTORY: spare unit, no category or IP yet
// ============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { WinstonLogger } from '../src/infrastructure/logging/WinstonLogger';
import {
  PrismaVendorRepository,
  PrismaDeviceModelRepository,
  PrismaLocationRepository,
  PrismaDeviceRepository
} from '../src/infrastructure/persistence';
import { PrismaWirelessPollingConfigRepository } from '../src/infrastructure/wireless-monitoring/repositories/PrismaWirelessPollingConfigRepository';
import { PrismaDeviceCredentialsRepository } from '../src/infrastructure/wireless-monitoring/repositories/PrismaDeviceCredentialsRepository';
import { DeviceId } from '../src/domain/shared/ids';
import { CreateVendorUseCase } from '../src/application/device-inventory/use-cases/CreateVendorUseCase';
import { CreateDeviceModelUseCase } from '../src/application/device-inventory/use-cases/CreateDeviceModelUseCase';
import { CreateLocationUseCase } from '../src/application/device-inventory/use-cases/CreateLocationUseCase';
import { CreateDeviceUseCase } from '../src/application/device-inventory/use-cases/CreateDeviceUseCase';
import { CreateWirelessConfigUseCase } from '../src/application/wireless-monitoring/use-cases/CreateWirelessConfigUseCase';

// ── bootstrap ─────────────────────────────────────────────────────────────────

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL
  })
});
const logger = new WinstonLogger();

const vendorRepo = new PrismaVendorRepository(prisma);
const deviceModelRepo = new PrismaDeviceModelRepository(prisma);
const locationRepo = new PrismaLocationRepository(prisma);
const deviceRepo = new PrismaDeviceRepository(prisma);
const wirelessConfigRepo = new PrismaWirelessPollingConfigRepository(
  prisma
);
const credentialsRepo = new PrismaDeviceCredentialsRepository(prisma);

const createVendor = new CreateVendorUseCase(vendorRepo, logger);
const createDeviceModel = new CreateDeviceModelUseCase(
  deviceModelRepo,
  vendorRepo,
  logger
);
const createLocation = new CreateLocationUseCase(
  locationRepo,
  logger
);
const createDevice = new CreateDeviceUseCase(deviceRepo, logger);
const createWirelessConfig = new CreateWirelessConfigUseCase(
  deviceRepo,
  wirelessConfigRepo,
  logger
);

// ── helpers ───────────────────────────────────────────────────────────────────

function fail(context: string, error: string | undefined): never {
  throw new Error(`[seed] ${context}: ${error}`);
}

// For idempotency: when a use-case create returns "already exists", fall back to
// a direct Prisma lookup to recover the existing row's ID. Creates always go
// through the use-case layer; lookups for re-runs use Prisma directly.

async function upsertVendor(
  name: string,
  slug: string,
  description?: string
) {
  const result = await createVendor.execute({
    name,
    slug,
    description
  });
  if (result.isSuccess) return result.value;
  if (result.error!.includes('already exists')) {
    const row = await prisma.vendor.findUnique({ where: { slug } });
    if (row) return { id: row.id, name: row.name, slug: row.slug };
  }
  fail(`createVendor(${slug})`, result.error);
}

async function upsertDeviceModel(
  vendorId: string,
  model: string,
  deviceType: string
) {
  const result = await createDeviceModel.execute({
    vendorId,
    model,
    deviceType
  });
  if (result.isSuccess) return result.value;
  if (result.error!.includes('already exists')) {
    const row = await prisma.deviceModel.findFirst({
      where: { vendorId, model }
    });
    if (row) return { id: row.id, model: row.model, vendorId };
  }
  fail(`createDeviceModel(${model})`, result.error);
}

async function upsertLocation(
  name: string,
  type: string,
  extras: Record<string, unknown> = {}
) {
  const result = await createLocation.execute({
    name,
    type,
    ...extras
  });
  if (result.isSuccess) return result.value;
  if (result.error!.includes('already exists')) {
    const row = await prisma.location.findFirst({ where: { name } });
    if (row) return { id: row.id, name: row.name };
  }
  fail(`createLocation(${name})`, result.error);
}

async function upsertDevice(
  dto: Parameters<typeof createDevice.execute>[0]
) {
  const result = await createDevice.execute(dto);
  if (result.isSuccess) return result.value;
  if (
    result.error!.includes('already exists') ||
    result.error!.includes('already in use') ||
    result.error!.includes('already assigned')
  ) {
    const row = dto.macAddress
      ? await prisma.device.findFirst({
          where: { macAddress: dto.macAddress }
        })
      : await prisma.device.findFirst({
          where: { ipAddress: dto.ipAddress ?? undefined }
        });
    if (row) return { id: row.id };
  }
  fail(`createDevice(${dto.name})`, result.error);
}

async function upsertWirelessConfig(
  dto: Parameters<typeof createWirelessConfig.execute>[0]
) {
  const result = await createWirelessConfig.execute(dto);
  if (result.isSuccess) return result.value;
  if (result.error!.includes('already exists')) return null;
  fail(
    `createWirelessConfig(deviceId=${dto.deviceId})`,
    result.error
  );
}

async function seedCredentials(
  deviceId: string,
  httpPassword: string
) {
  const idResult = DeviceId.parse(deviceId);
  if (idResult.isFailure)
    fail(`DeviceId.parse(${deviceId})`, idResult.error);
  const result = await credentialsRepo.save(idResult.value, {
    snmpVersion: 2,
    snmpCommunity: 'public',
    snmpV3AuthUser: null,
    snmpV3AuthProto: null,
    snmpV3AuthKey: null,
    snmpV3PrivProto: null,
    snmpV3PrivKey: null,
    httpUsername: 'ubnt',
    httpPassword,
    snmpPort: 161,
    httpPort: 80
  });
  if (result.isFailure)
    fail(`seedCredentials(${deviceId})`, result.error);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ==========================================================================
  // 1. Vendors
  // ==========================================================================
  console.log('Seeding vendors...');

  const [ubiquiti, mikrotik, mimosa, tenda, tplink] =
    await Promise.all([
      upsertVendor(
        'Ubiquiti',
        'ubiquiti',
        'Ubiquiti Inc. — AirOS wireless equipment'
      ),
      upsertVendor(
        'MikroTik',
        'mikrotik',
        'MikroTik — RouterOS routers and switches'
      ),
      upsertVendor(
        'Mimosa',
        'mimosa',
        'Mimosa Networks — wireless backhaul'
      ),
      upsertVendor('Tenda', 'tenda', 'Tenda — consumer routers'),
      upsertVendor(
        'TP-Link',
        'tp-link',
        'TP-Link — consumer networking'
      )
    ]);

  // ==========================================================================
  // 2. Device models
  // ==========================================================================
  console.log('Seeding device models...');

  const [
    litebeam5acGen2,
    airgridM5Hp,
    liteapAc,
    rocketM5,
    mimosaC5x,
    rb960,
    css106,
    tendaN301
  ] = await Promise.all([
    upsertDeviceModel(ubiquiti.id, 'LiteBeam 5AC Gen2', 'ANTENNA'),
    upsertDeviceModel(ubiquiti.id, 'AirGrid M5 HP', 'ANTENNA'),
    upsertDeviceModel(ubiquiti.id, 'LiteAP AC', 'RADIO'),
    upsertDeviceModel(ubiquiti.id, 'Rocket M5', 'RADIO'),
    upsertDeviceModel(mimosa.id, 'C5x', 'ANTENNA'),
    upsertDeviceModel(mikrotik.id, 'RB960PGS', 'ROUTERBOARD'),
    upsertDeviceModel(mikrotik.id, 'CSS106-1G-4P-1S', 'SWITCH'),
    upsertDeviceModel(tenda.id, 'N301', 'ROUTER')
  ]);

  // ==========================================================================
  // 3. Locations
  // ==========================================================================
  console.log('Seeding locations...');

  const [towerNorth, towerSouth, nodeEast] = await Promise.all([
    upsertLocation('Torre Norte', 'TOWER', {
      municipality: 'São Paulo',
      neighborhood: 'Centro',
      latitude: -23.5489,
      longitude: -46.6388,
      altitude: 45
    }),
    upsertLocation('Torre Sul', 'TOWER', {
      municipality: 'São Paulo',
      neighborhood: 'Ipiranga',
      latitude: -23.589,
      longitude: -46.61,
      altitude: 38
    }),
    upsertLocation('Nó Leste', 'NODE', {
      municipality: 'São Paulo',
      neighborhood: 'Mooca',
      latitude: -23.552,
      longitude: -46.6
    })
  ]);

  // ==========================================================================
  // 4. Devices
  // ==========================================================================
  console.log('Seeding devices...');

  // ── WIRELESS_CPE: healthy, full config ───────────────────────────────────
  const cpe01 = await upsertDevice({
    deviceModelId: litebeam5acGen2.id,
    locationId: towerNorth.id,
    name: 'CPE-NORTE-001',
    status: 'ACTIVE',
    category: 'WIRELESS_CPE',
    ownerType: 'CLIENT',
    ipAddress: '10.10.1.1',
    macAddress: 'DC:9F:DB:11:11:01',
    serialNumber: 'SN-LB5G2-001',
    monitoringEnabled: true,
    description:
      'Healthy CPE — good signal, all metrics within threshold'
  });

  // ── WIRELESS_CPE: degraded signal, active WARNING alert ──────────────────
  const cpe02 = await upsertDevice({
    deviceModelId: airgridM5Hp.id,
    locationId: towerNorth.id,
    name: 'CPE-NORTE-002',
    status: 'ACTIVE',
    category: 'WIRELESS_CPE',
    ownerType: 'CLIENT',
    ipAddress: '10.10.1.2',
    macAddress: 'DC:9F:DB:11:11:02',
    serialNumber: 'SN-AG5HP-002',
    monitoringEnabled: true,
    description:
      'Degraded signal — WARNING alert active on signalRxDbm'
  });

  // ── WIRELESS_CPE: critical signal, two active CRITICAL alerts ────────────
  const cpe03 = await upsertDevice({
    deviceModelId: litebeam5acGen2.id,
    locationId: towerSouth.id,
    name: 'CPE-SUL-001',
    status: 'ACTIVE',
    category: 'WIRELESS_CPE',
    ownerType: 'CLIENT',
    ipAddress: '10.10.2.1',
    macAddress: 'DC:9F:DB:22:22:01',
    serialNumber: 'SN-LB5G2-003',
    monitoringEnabled: true,
    description:
      'Very weak signal — CRITICAL on signal and CCQ, link near drop'
  });

  // ── WIRELESS_CPE: polling disabled ───────────────────────────────────────
  const cpe04 = await upsertDevice({
    deviceModelId: airgridM5Hp.id,
    locationId: towerNorth.id,
    name: 'CPE-NORTE-003',
    status: 'ACTIVE',
    category: 'WIRELESS_CPE',
    ownerType: 'CLIENT',
    ipAddress: '10.10.1.3',
    macAddress: 'DC:9F:DB:11:11:03',
    monitoringEnabled: true,
    description:
      'Polling disabled — customer requested maintenance window'
  });

  // ── WIRELESS_CPE: config registered but no IP for polling ────────────────
  const cpe05 = await upsertDevice({
    deviceModelId: mimosaC5x.id,
    locationId: towerSouth.id,
    name: 'CPE-SUL-002',
    status: 'ACTIVE',
    category: 'WIRELESS_CPE',
    ownerType: 'CLIENT',
    ipAddress: '10.10.2.2',
    macAddress: 'DC:9F:DB:22:22:02',
    monitoringEnabled: true,
    description:
      'IP not yet set on wireless config — collector will fail gracefully'
  });

  // ── WIRELESS_CPE: no wireless config registered yet ──────────────────────
  const cpe06 = await upsertDevice({
    deviceModelId: litebeam5acGen2.id,
    locationId: nodeEast.id,
    name: 'CPE-LESTE-001',
    status: 'ACTIVE',
    category: 'WIRELESS_CPE',
    ownerType: 'CLIENT',
    ipAddress: '10.10.3.1',
    macAddress: 'DC:9F:DB:33:33:01',
    monitoringEnabled: true,
    description:
      'POST /api/devices/:id/wireless/config to register polling'
  });

  // ── AP: sector antenna, ACCESS_POINT type, 30 client limit ───────────────
  const ap01 = await upsertDevice({
    deviceModelId: liteapAc.id,
    locationId: towerNorth.id,
    name: 'AP-NORTE-001',
    status: 'ACTIVE',
    category: 'AP',
    ownerType: 'COMPANY',
    ipAddress: '10.0.1.1',
    macAddress: 'DC:9F:DB:AA:AA:01',
    serialNumber: 'SN-LITAP-001',
    monitoringEnabled: true,
    description:
      'Sector antenna — north tower, 30 provisioned client slots'
  });

  // ── AP: south sector, cleared alert in history ───────────────────────────
  const ap02 = await upsertDevice({
    deviceModelId: rocketM5.id,
    locationId: towerSouth.id,
    name: 'AP-SUL-001',
    status: 'ACTIVE',
    category: 'AP',
    ownerType: 'COMPANY',
    ipAddress: '10.0.2.1',
    macAddress: 'DC:9F:DB:BB:BB:01',
    serialNumber: 'SN-RKTM5-001',
    monitoringEnabled: true,
    description:
      'South sector — previously had a cleared client-count WARNING'
  });

  // ── CPE (wired): must be rejected by canHaveWirelessConfig() ─────────────
  const wiredCpe01 = await upsertDevice({
    deviceModelId: tendaN301.id,
    locationId: nodeEast.id,
    name: 'ROUTER-LESTE-001',
    status: 'ACTIVE',
    category: 'CPE',
    ownerType: 'CLIENT',
    ipAddress: '192.168.1.1',
    macAddress: 'C8:3A:35:AA:BB:CC',
    monitoringEnabled: false,
    description:
      'Wired CPE router — POST /wireless/config must return 400'
  });

  // ── ROUTERBOARD: infrastructure, no wireless ─────────────────────────────
  await upsertDevice({
    deviceModelId: rb960.id,
    locationId: towerNorth.id,
    name: 'RB-NORTE-001',
    status: 'ACTIVE',
    category: 'ROUTERBOARD',
    ownerType: 'COMPANY',
    ipAddress: '10.0.0.1',
    macAddress: '4C:5E:0C:00:00:01',
    serialNumber: 'SN-RB960-001',
    monitoringEnabled: false,
    description:
      'MikroTik router at north tower — not wireless-capable'
  });

  // ── SMART_SWITCH: infrastructure, no wireless ────────────────────────────
  await upsertDevice({
    deviceModelId: css106.id,
    locationId: towerNorth.id,
    name: 'SW-NORTE-001',
    status: 'ACTIVE',
    category: 'SMART_SWITCH',
    ownerType: 'COMPANY',
    ipAddress: '10.0.0.10',
    macAddress: '4C:5E:0C:00:01:01',
    monitoringEnabled: false,
    description: 'Distribution switch — not wireless-capable'
  });

  // ── INVENTORY: spare unit, no category or IP ─────────────────────────────
  await upsertDevice({
    deviceModelId: litebeam5acGen2.id,
    name: 'CPE-SPARE-001',
    status: 'INVENTORY',
    ownerType: 'COMPANY',
    macAddress: 'DC:9F:DB:FF:FF:01',
    serialNumber: 'SN-SPARE-001',
    monitoringEnabled: false,
    description: 'New unit in stock — no category or IP assigned yet'
  });

  // ==========================================================================
  // 5. Wireless Polling Configurations (via CreateWirelessConfigUseCase)
  // ==========================================================================
  console.log('Seeding wireless configs...');

  await Promise.all([
    // cpe01 — enabled, 5 min interval, 20 Mbps link
    upsertWirelessConfig({
      deviceId: cpe01.id,
      deviceType: 'STATION',
      ipAddress: '10.10.1.1',
      enabled: true,
      intervalSecs: 300,
      linkCapacityBps: 20_000_000
    }),

    // cpe02 — enabled, degraded signal
    upsertWirelessConfig({
      deviceId: cpe02.id,
      deviceType: 'STATION',
      ipAddress: '10.10.1.2',
      enabled: true,
      intervalSecs: 300,
      linkCapacityBps: 10_000_000
    }),

    // cpe03 — enabled, critical signal
    upsertWirelessConfig({
      deviceId: cpe03.id,
      deviceType: 'STATION',
      ipAddress: '10.10.2.1',
      enabled: true,
      intervalSecs: 300,
      linkCapacityBps: 5_000_000
    }),

    // cpe04 — explicitly disabled polling
    upsertWirelessConfig({
      deviceId: cpe04.id,
      deviceType: 'STATION',
      ipAddress: '10.10.1.3',
      enabled: false,
      intervalSecs: 3600
    }),

    // cpe05 — no IP on config: will fail gracefully at poll time
    upsertWirelessConfig({
      deviceId: cpe05.id,
      deviceType: 'STATION',
      ipAddress: null,
      enabled: true,
      intervalSecs: 300
    }),

    // cpe06 — intentionally left with no config
    // ap01 — ACCESS_POINT type, 30 client limit
    upsertWirelessConfig({
      deviceId: ap01.id,
      deviceType: 'ACCESS_POINT',
      ipAddress: '10.0.1.1',
      enabled: true,
      intervalSecs: 300,
      linkCapacityBps: 100_000_000,
      clientsProvisionedLimit: 30
    }),

    // ap02 — ACCESS_POINT, longer interval
    upsertWirelessConfig({
      deviceId: ap02.id,
      deviceType: 'ACCESS_POINT',
      ipAddress: '10.0.2.1',
      enabled: true,
      intervalSecs: 600,
      linkCapacityBps: 100_000_000,
      clientsProvisionedLimit: 20
    })
  ]);

  // ==========================================================================
  // 6. Device Credentials (via PrismaDeviceCredentialsRepository.save)
  // ==========================================================================
  // Uses the repository directly — no application use case exists for credentials.
  // save() is idempotent (upserts). All devices that have a wireless config need
  // credentials so PollWirelessDeviceUseCase can authenticate to the device.
  // ==========================================================================
  console.log('Seeding device credentials...');

  await Promise.all([
    seedCredentials(cpe01.id, 'ubnt'), // healthy CPE — default password
    seedCredentials(cpe02.id, 'ubnt'), // degraded CPE
    seedCredentials(cpe03.id, 'ubnt'), // critical CPE
    seedCredentials(cpe04.id, 'ubnt'), // polling disabled — credentials still needed for manual trigger
    seedCredentials(cpe05.id, 'ubnt'), // no IP on config — will fail at collection, not auth
    seedCredentials(ap01.id, 'ubnt-ap-north'), // AP, non-default password
    seedCredentials(ap02.id, 'ubnt-ap-south') // AP, non-default password
    // cpe06 intentionally has no credentials — POST /wireless/config not yet called
  ]);

  // Demonstrate the guard: wired CPE must be rejected
  const guardResult = await createWirelessConfig.execute({
    deviceId: wiredCpe01.id,
    deviceType: 'STATION',
    ipAddress: '192.168.1.1',
    enabled: true,
    intervalSecs: 300
  });
  if (guardResult.isSuccess) {
    throw new Error(
      '[seed] BUG: wired CPE accepted a wireless config — canHaveWirelessConfig() guard is broken'
    );
  }
  if (!guardResult.error!.includes('not wireless-capable')) {
    throw new Error(
      `[seed] Unexpected error from guard: ${guardResult.error}`
    );
  }
  console.log(
    `  ✓ Guard verified: wired CPE correctly rejected (${guardResult.error})`
  );

  // ==========================================================================
  // Summary
  // ==========================================================================
  const [vendors, models, locations, devices, configs, creds] =
    await Promise.all([
      prisma.vendor.count(),
      prisma.deviceModel.count(),
      prisma.location.count(),
      prisma.device.count(),
      prisma.wirelessPollingConfiguration.count(),
      prisma.deviceCredentials.count()
    ]);

  console.log(`
Done!
  ${vendors} vendors · ${models} device models · ${locations} locations
  ${devices} devices:
    WIRELESS_CPE  6  (healthy / degraded / critical / disabled / no-ip / no-config)
    AP            2  (full config, cleared-alert history)
    CPE           1  (wired — wireless guard verified ✓)
    ROUTERBOARD   1
    SMART_SWITCH  1
    INVENTORY     1  (spare, no category)
  ${configs} wireless polling configurations
  ${creds} device credential sets (SNMPv2 + HTTP, encrypted at rest)
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
