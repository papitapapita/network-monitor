import { PrismaClient } from '../../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Removes all rows from tables that integration tests write to.
 * Deletes Devices first so cascade rules clean up child rows
 * (device_states, ping_results, polling_configurations, alert_events).
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.device.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Upserts the MikroTik vendor and RB4011iGS+ device model.
 * Returns the device model UUID — use it as `deviceModelId` when creating test devices.
 */
export async function seedDeviceModel(prisma: PrismaClient): Promise<string> {
  const vendor = await prisma.vendor.upsert({
    where: { slug: 'mikrotik' },
    update: {},
    create: {
      name: 'MikroTik',
      slug: 'mikrotik',
      description: null
    }
  });

  const model = await prisma.deviceModel.upsert({
    where: {
      vendorId_model: {
        vendorId: vendor.id,
        model: 'RB4011iGS+'
      }
    },
    update: {},
    create: {
      vendorId: vendor.id,
      model: 'RB4011iGS+',
      deviceType: 'ROUTERBOARD'
    }
  });
  return model.id;
}

/**
 * Upserts a test Tower location.
 * Returns its UUID — use it as `locationId` when creating test devices.
 */
export async function seedLocation(prisma: PrismaClient): Promise<string> {
  const location = await prisma.location.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      name: 'Test Tower Location',
      type: 'TOWER'
    }
  });
  return location.id;
}

/**
 * Polls the DB until a PollingConfiguration row appears for the given device.
 * DeviceProvisionedHandler is fire-and-forget, so the row may not exist immediately.
 */
export async function waitForPollingConfig(
  prisma: PrismaClient,
  deviceId: string,
  timeoutMs = 2000
): Promise<void> {
  const interval = 100;
  const maxAttempts = Math.ceil(timeoutMs / interval);
  for (let i = 0; i < maxAttempts; i++) {
    const config = await prisma.pollingConfiguration.findFirst({
      where: { deviceId }
    });
    if (config) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(
    `PollingConfiguration for device ${deviceId} did not appear within ${timeoutMs}ms`
  );
}

/**
 * Creates a device with monitoringEnabled=true and an IP address,
 * then waits for the DeviceProvisionedHandler to create its PollingConfiguration.
 * Returns { deviceId, pollingConfigId }.
 */
export async function seedMonitoredDevice(
  prisma: PrismaClient,
  deviceModelId: string,
  ipAddress = '192.168.99.1'
): Promise<{ deviceId: string; pollingConfigId: string }> {
  const device = await prisma.device.create({
    data: {
      name: 'Monitored Test Device',
      owner: 'COMPANY',
      status: 'ACTIVE',
      monitoringEnabled: true,
      ipAddress,
      deviceModelId
    }
  });

  // Manually create the PollingConfiguration since we're bypassing the event handler
  // by inserting directly into DB (no EventDispatcher in this path)
  const pollingConfig = await prisma.pollingConfiguration.create({
    data: {
      deviceId: device.id,
      ipAddress,
      enabled: true,
      pingIntervalSecs: 60,
      failuresBeforeDown: 3
    }
  });

  return { deviceId: device.id, pollingConfigId: pollingConfig.id };
}

/**
 * Cleans all catalog and device data in FK-safe order.
 * Use in tests that create vendors or device models.
 */
export async function cleanCatalog(prisma: PrismaClient): Promise<void> {
  await prisma.device.deleteMany();
  await prisma.deviceModel.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.location.deleteMany();
}

/**
 * Upserts a test vendor. Returns its UUID.
 */
export async function seedVendor(
  prisma: PrismaClient,
  overrides: { name?: string; slug?: string; description?: string | null } = {}
): Promise<string> {
  const vendor = await prisma.vendor.upsert({
    where: { slug: overrides.slug ?? 'test-vendor' },
    update: {},
    create: {
      name: overrides.name ?? 'Test Vendor',
      slug: overrides.slug ?? 'test-vendor',
      description: overrides.description ?? null
    }
  });
  return vendor.id;
}

/** Known-valid UUIDs that will never exist in the test DB */
export const GHOST_ID = '00000000-0000-4000-8000-000000000001';
export const INVALID_ID = 'not-a-uuid';

/**
 * Creates a standalone PrismaClient backed by DATABASE_URL.
 * Use this in tests that cannot call setupDependencies() (e.g. because the
 * full DI container requires third-party env vars like TELEGRAM credentials).
 * Call prisma.$disconnect() in afterAll.
 */
export function createTestPrisma(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
  });
  return new PrismaClient({ adapter });
}
