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
 * Upserts a Ubiquiti LiteBeam 5AC device model with isWireless=true.
 * Returns the device model UUID — use it as `deviceModelId` when creating wireless test devices.
 */
export async function seedWirelessDeviceModel(
  prisma: PrismaClient
): Promise<string> {
  const vendor = await prisma.vendor.upsert({
    where: { slug: 'ubiquiti' },
    update: {},
    create: {
      name: 'Ubiquiti',
      slug: 'ubiquiti',
      description: null
    }
  });

  const model = await prisma.deviceModel.upsert({
    where: {
      vendorId_model: {
        vendorId: vendor.id,
        model: 'LiteBeam 5AC'
      }
    },
    update: {},
    create: {
      vendorId: vendor.id,
      model: 'LiteBeam 5AC',
      deviceType: 'ANTENNA',
      isWireless: true
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

/**
 * Cleans the customers bounded context in FK-safe order:
 * contracted_services (which reference customers/service_plans/devices)
 * must go before customers and service_plans.
 */
export async function cleanCustomers(prisma: PrismaClient): Promise<void> {
  await prisma.contractedService.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.servicePlan.deleteMany();
}

/** Upserts a test customer. Returns its UUID. */
export async function seedCustomer(
  prisma: PrismaClient,
  overrides: {
    fullName?: string;
    phone?: string;
    email?: string | null;
    cedula?: string | null;
  } = {}
): Promise<string> {
  const phone = overrides.phone ?? '3001234567';
  const customer = await prisma.customer.upsert({
    where: { phone },
    update: {},
    create: {
      fullName: overrides.fullName ?? 'Test Customer',
      phone,
      email: overrides.email ?? null,
      cedula: overrides.cedula ?? null
    }
  });
  return customer.id;
}

/** Upserts a test service plan. Returns its UUID. */
export async function seedServicePlan(
  prisma: PrismaClient,
  overrides: {
    name?: string;
    downloadMbps?: number;
    uploadMbps?: number;
    monthlyPrice?: number;
  } = {}
): Promise<string> {
  const name = overrides.name ?? 'Test Plan 50/10';
  const plan = await prisma.servicePlan.upsert({
    where: { name },
    update: {},
    create: {
      name,
      downloadMbps: overrides.downloadMbps ?? 50,
      uploadMbps: overrides.uploadMbps ?? 10,
      monthlyPrice: overrides.monthlyPrice ?? 80000
    }
  });
  return plan.id;
}

/** Creates a bare device (FK target for contracted-service tests). Returns its UUID. */
export async function seedDevice(
  prisma: PrismaClient,
  deviceModelId: string,
  overrides: { name?: string; serialNumber?: string } = {}
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: overrides.name ?? 'Test CPE Device',
      status: 'INVENTORY',
      serialNumber: overrides.serialNumber ?? `SN-${Date.now()}`,
      deviceModelId
    }
  });
  return device.id;
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
