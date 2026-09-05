import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN' } });
  console.log(`Created admin: ${email}`);
}

async function seedDeviceModels() {
  const vendors = await prisma.vendor.findMany();
  const vendorId = (slug: string): string => {
    const vendor = vendors.find((v) => v.slug === slug);
    if (!vendor) {
      throw new Error(`Seed vendor not found: ${slug}. Create it first.`);
    }
    return vendor.id;
  };

  const models: {
    vendorSlug: string;
    model: string;
    deviceType:
      | 'ANTENNA'
      | 'RADIO'
      | 'ROUTER'
      | 'ROUTERBOARD'
      | 'SERVER'
      | 'SWITCH'
      | 'OTHER';
    isWireless: boolean;
  }[] = [
    { vendorSlug: 'mikrotik', model: 'RB4011iGS+', deviceType: 'ROUTERBOARD', isWireless: false },
    { vendorSlug: 'mikrotik', model: 'RB750Gr3 hEX', deviceType: 'ROUTERBOARD', isWireless: false },
    { vendorSlug: 'mikrotik', model: 'CCR2004-16G-2S+', deviceType: 'ROUTER', isWireless: false },
    { vendorSlug: 'ubiquiti', model: 'LiteBeam 5AC Gen2', deviceType: 'ANTENNA', isWireless: true },
    { vendorSlug: 'ubiquiti', model: 'NanoBeam 5AC Gen2', deviceType: 'ANTENNA', isWireless: true },
    { vendorSlug: 'ubiquiti', model: 'airFiber 5XHD', deviceType: 'RADIO', isWireless: true },
    { vendorSlug: 'ubiquiti', model: 'EdgeSwitch 24', deviceType: 'SWITCH', isWireless: false },
    { vendorSlug: 'mimosa', model: 'B5c', deviceType: 'ANTENNA', isWireless: true },
    { vendorSlug: 'mimosa', model: 'C5c', deviceType: 'ANTENNA', isWireless: true },
    { vendorSlug: 'tp-link', model: 'CPE510', deviceType: 'ANTENNA', isWireless: true },
    { vendorSlug: 'tp-link', model: 'TL-SG1024', deviceType: 'SWITCH', isWireless: false },
    { vendorSlug: 'tenda', model: 'O6', deviceType: 'ANTENNA', isWireless: true }
  ];

  const created: Record<string, string> = {};
  for (const m of models) {
    const row = await prisma.deviceModel.upsert({
      where: {
        vendorId_model: { vendorId: vendorId(m.vendorSlug), model: m.model }
      },
      update: {},
      create: {
        vendorId: vendorId(m.vendorSlug),
        model: m.model,
        deviceType: m.deviceType,
        isWireless: m.isWireless
      }
    });
    created[m.model] = row.id;
  }
  console.log(`Seeded ${models.length} device models`);
  return created;
}

async function seedDevices(
  deviceModelIdByModel: Record<string, string>
): Promise<void> {
  const tower = await prisma.location.upsert({
    where: { id: '00000000-0000-4000-a000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-a000-000000000001',
      name: 'Main Tower',
      type: 'TOWER',
      municipality: 'Santo Domingo'
    }
  });
  const warehouse = await prisma.location.upsert({
    where: { id: '00000000-0000-4000-a000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-a000-000000000002',
      name: 'Main Warehouse',
      type: 'OTHER',
      municipality: 'Santo Domingo'
    }
  });

  const devices: {
    name: string;
    model: string;
    locationId: string | null;
    status: 'ACTIVE' | 'INVENTORY';
    ipAddress: string | null;
    macAddress: string | null;
    category: 'GATEWAY' | 'WIRELESS_CPE' | 'AGGREGATION_SWITCH' | null;
  }[] = [
    {
      name: 'Core Router - Main Tower',
      model: 'RB4011iGS+',
      locationId: tower.id,
      status: 'ACTIVE',
      ipAddress: '10.10.0.1',
      macAddress: '00:0C:42:AA:BB:01',
      category: 'GATEWAY'
    },
    {
      name: 'AF5XHD - Main Tower Link',
      model: 'airFiber 5XHD',
      locationId: tower.id,
      status: 'ACTIVE',
      ipAddress: '10.10.0.10',
      macAddress: '24:A4:3C:AA:BB:02',
      category: 'WIRELESS_CPE'
    },
    {
      name: 'EdgeSwitch 24 - Main Tower',
      model: 'EdgeSwitch 24',
      locationId: tower.id,
      status: 'ACTIVE',
      ipAddress: '10.10.0.2',
      macAddress: '04:18:D6:AA:BB:03',
      category: 'AGGREGATION_SWITCH'
    },
    {
      name: 'LiteBeam - Client CPE Spare',
      model: 'LiteBeam 5AC Gen2',
      locationId: warehouse.id,
      status: 'INVENTORY',
      ipAddress: null,
      macAddress: null,
      category: null
    },
    {
      name: 'CPE510 - Spare Unit',
      model: 'CPE510',
      locationId: warehouse.id,
      status: 'INVENTORY',
      ipAddress: null,
      macAddress: null,
      category: null
    },
    {
      name: 'hEX Router - Spare',
      model: 'RB750Gr3 hEX',
      locationId: warehouse.id,
      status: 'INVENTORY',
      ipAddress: null,
      macAddress: null,
      category: null
    }
  ];

  let createdCount = 0;
  for (const d of devices) {
    const existing = await prisma.device.findFirst({
      where: { name: d.name, deletedAt: null }
    });
    if (existing) continue;
    await prisma.device.create({
      data: {
        name: d.name,
        deviceModelId: deviceModelIdByModel[d.model],
        locationId: d.locationId,
        status: d.status,
        category: d.category,
        ipAddress: d.ipAddress,
        macAddress: d.macAddress
      }
    });
    createdCount++;
  }
  console.log(`Seeded ${createdCount} devices`);
}

async function main() {
  await seedAdmin();
  const deviceModelIdByModel = await seedDeviceModels();
  await seedDevices(deviceModelIdByModel);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
