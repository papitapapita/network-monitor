import { PrismaClient } from '../../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Removes all rows from tables that integration tests write to.
 * Deletes Devices first so cascade rules clean up child rows
 * (device_states, ping_results, polling_configurations, alert_events).
 */
export async function cleanDatabase(
  prisma: PrismaClient
): Promise<void> {
  await prisma.device.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Upserts the MikroTik vendor and RB4011iGS+ device model.
 * Returns the device model UUID — use it as `deviceModelId` when creating test devices.
 */
export async function seedDeviceModel(
  prisma: PrismaClient,
  overrides: { imageUrl?: string | null } = {}
): Promise<string> {
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
    update: { imageUrl: overrides.imageUrl ?? null },
    create: {
      vendorId: vendor.id,
      model: 'RB4011iGS+',
      deviceType: 'ROUTERBOARD',
      imageUrl: overrides.imageUrl ?? null
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
export async function seedLocation(
  prisma: PrismaClient
): Promise<string> {
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
export async function cleanCatalog(
  prisma: PrismaClient
): Promise<void> {
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
  overrides: {
    name?: string;
    slug?: string;
    description?: string | null;
  } = {}
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
export async function cleanCustomers(
  prisma: PrismaClient
): Promise<void> {
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

/**
 * Cleans the billing bounded context in FK-safe order:
 * bill_line_items (which reference bills) must go before bills, and
 * bills (which reference customers, Restrict) must go before cleanCustomers().
 */
export async function cleanBills(
  prisma: PrismaClient
): Promise<void> {
  await prisma.billLineItem.deleteMany();
  await prisma.bill.deleteMany();
}

/**
 * Creates a contracted service in ACTIVE status directly via Prisma,
 * bypassing the PENDING -> ACTIVE activation flow used by the
 * contracted-service HTTP API. Useful for billing tests that only care
 * about the customer having an active, billable service.
 * Returns its UUID.
 */
export async function seedActiveContractedService(
  prisma: PrismaClient,
  customerId: string,
  servicePlanId: string,
  overrides: { deviceId?: string | null; startDate?: Date } = {}
): Promise<string> {
  const service = await prisma.contractedService.create({
    data: {
      customerId,
      servicePlanId,
      deviceId: overrides.deviceId ?? null,
      status: 'ACTIVE',
      startDate: overrides.startDate ?? new Date()
    }
  });
  return service.id;
}

/**
 * Cleans the tickets bounded context in FK-safe order: tickets reference
 * technicians, so they must go first. Call this before cleanCustomers() —
 * tickets also reference customers.
 */
export async function cleanTickets(
  prisma: PrismaClient
): Promise<void> {
  await prisma.ticket.deleteMany();
  await prisma.technician.deleteMany();
}

/** Upserts a test technician. Returns its UUID. */
export async function seedTechnician(
  prisma: PrismaClient,
  overrides: {
    fullName?: string;
    phone?: string;
    email?: string | null;
    isActive?: boolean;
  } = {}
): Promise<string> {
  const phone = overrides.phone ?? '+573001112233';
  const technician = await prisma.technician.upsert({
    where: { phone },
    update: {},
    create: {
      fullName: overrides.fullName ?? 'Test Technician',
      phone,
      email: overrides.email ?? null,
      isActive: overrides.isActive ?? true
    }
  });
  return technician.id;
}

/**
 * Creates a ticket directly via Prisma, bypassing the aggregate so a test can
 * put one straight into any status. Returns its UUID.
 */
export async function seedTicket(
  prisma: PrismaClient,
  overrides: {
    title?: string;
    description?: string;
    category?:
      | 'CONNECTIVITY'
      | 'INSTALLATION'
      | 'HARDWARE_FAILURE'
      | 'MAINTENANCE'
      | 'RELOCATION'
      | 'OTHER';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    status?:
      | 'OPEN'
      | 'ASSIGNED'
      | 'IN_PROGRESS'
      | 'RESOLVED'
      | 'CANCELLED';
    customerId?: string | null;
    deviceId?: string | null;
    technicianId?: string | null;
    scheduledFor?: Date | null;
    origin?: 'MANUAL' | 'DEVICE_ALERT' | 'WIRELESS_ALERT';
    originAlertId?: string | null;
    assignedAt?: Date | null;
  } = {}
): Promise<string> {
  const status = overrides.status ?? 'OPEN';
  const ticket = await prisma.ticket.create({
    data: {
      title: overrides.title ?? 'Test ticket',
      description: overrides.description ?? 'Something is broken.',
      category: overrides.category ?? 'CONNECTIVITY',
      priority: overrides.priority ?? 'NORMAL',
      status,
      customerId: overrides.customerId ?? null,
      deviceId: overrides.deviceId ?? null,
      technicianId: overrides.technicianId ?? null,
      scheduledFor: overrides.scheduledFor ?? null,
      origin: overrides.origin ?? 'MANUAL',
      originAlertId: overrides.originAlertId ?? null,
      assignedAt:
        overrides.assignedAt ??
        (status === 'OPEN' ? null : new Date())
    }
  });
  return ticket.id;
}

/**
 * Cleans the quoting bounded context in FK-safe order: quotation_line_items
 * (which reference quotations) must go before quotations.
 */
export async function cleanQuotations(
  prisma: PrismaClient
): Promise<void> {
  await prisma.quotationLineItem.deleteMany();
  await prisma.quotation.deleteMany();
}

/**
 * Creates a quotation with one line item directly via Prisma, bypassing the
 * aggregate so a test can put one straight into any status. Returns its UUID.
 */
export async function seedQuotation(
  prisma: PrismaClient,
  deviceModelId: string,
  overrides: {
    customerId?: string | null;
    customerName?: string;
    status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
    validUntil?: Date;
    unitPrice?: number;
    quantity?: number;
  } = {}
): Promise<string> {
  const status = overrides.status ?? 'DRAFT';
  const isSent = status !== 'DRAFT';
  const deviceModel = await prisma.deviceModel.findUniqueOrThrow({
    where: { id: deviceModelId }
  });
  const quotation = await prisma.quotation.create({
    data: {
      status,
      customerId: overrides.customerId ?? null,
      customerName: overrides.customerName ?? 'Test Prospect',
      validUntil:
        overrides.validUntil ??
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sentAt: isSent ? new Date() : null,
      acceptedAt: status === 'ACCEPTED' ? new Date() : null,
      rejectedAt: status === 'REJECTED' ? new Date() : null,
      rejectionReason: status === 'REJECTED' ? 'Too expensive' : null,
      expiredAt: status === 'EXPIRED' ? new Date() : null,
      lineItems: {
        create: [
          {
            deviceModelId,
            deviceModelName: 'RB4011iGS+',
            vendorName: 'MikroTik',
            deviceType: 'ROUTERBOARD',
            imageUrl: deviceModel.imageUrl,
            description: 'Test line item',
            unitPrice: overrides.unitPrice ?? 100,
            quantity: overrides.quantity ?? 1
          }
        ]
      }
    }
  });
  return quotation.id;
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
