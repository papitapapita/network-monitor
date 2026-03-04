// ============================================================================
// ISP Watch — V1 Seed Data
// Run with: npx prisma db seed
// ============================================================================
// Configure in package.json:
// "prisma": { "seed": "ts-node prisma/seed.ts" }
// ============================================================================

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  DeviceType,
  Vendors
} from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

async function main() {
  console.log('Seeding device models...');

  const models = [
    // ── Ubiquiti ──
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'LiteBeam 5AC Gen2',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'AirGrid M5 HP',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'LiteAP AC',
      deviceType: DeviceType.RADIO
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'LiteBeam 5AC',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'PowerBeam 5AC',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'PowerBeam 5AC 400 ISO',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'PowerBeam 5AC 500',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'PowerBeam M5 400-ISO',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'PowerBeam M5 300',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'PowerBeam M5 400',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'Rocket 5AC Lite',
      deviceType: DeviceType.RADIO
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'Rocket 5AC PTP',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.UBIQUITI,
      model: 'Rocket M5',
      deviceType: DeviceType.RADIO
    },

    // ── Mimosa ──
    {
      manufacturer: Vendors.MIMOSA,
      model: 'C5x',
      deviceType: DeviceType.ANTENNA
    },
    {
      manufacturer: Vendors.MIMOSA,
      model: 'C5c',
      deviceType: DeviceType.ANTENNA
    },

    // ── MikroTik ──
    {
      manufacturer: Vendors.MIKROTIK,
      model: 'RB960PGS',
      deviceType: DeviceType.ROUTERBOARD
    },
    {
      manufacturer: Vendors.MIKROTIK,
      model: 'CSS106-1G-4P-1S',
      deviceType: DeviceType.SWITCH
    },
    {
      manufacturer: Vendors.MIKROTIK,
      model: 'RB4011iGS+',
      deviceType: DeviceType.ROUTERBOARD
    },
    {
      manufacturer: Vendors.MIKROTIK,
      model: 'RB750UPr2',
      deviceType: DeviceType.ROUTERBOARD
    },

    // ── Tenda ──
    {
      manufacturer: Vendors.TENDA,
      model: 'N301',
      deviceType: DeviceType.ROUTER
    },

    // ── TP-Link ──
    {
      manufacturer: Vendors.TP_LINK,
      model: 'TL-WR840N',
      deviceType: DeviceType.ROUTER
    }
  ];

  for (const m of models) {
    await prisma.deviceModel.upsert({
      where: {
        manufacturer_model: {
          manufacturer: m.manufacturer,
          model: m.model
        }
      },
      update: {},
      create: m
    });
  }

  console.log(`Seeded ${models.length} device models.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
