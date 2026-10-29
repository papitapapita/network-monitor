// Source: src/application/device-inventory/use-cases/ListAddressMismatchesUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListAddressMismatchesUseCase } from 'application/device-inventory/use-cases';
import { RouterSurvey } from 'application/device-monitoring/services';
import { PrismaDeviceAddressQuery } from 'infrastructure/persistence';
import { PrismaPortSpeedTargetsQuery } from 'infrastructure/monitoring/port-speeds';
import { RouterHostQueryAdapter } from 'infrastructure/monitoring/router-hosts';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  createTestPrisma,
  cleanDatabase,
  seedWirelessDeviceModel,
  seedNetworkDevice
} from '../../helpers/db';
import { FakeRouterHostReader } from '../../helpers/FakeRouterHostReader';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

describe('ListAddressMismatchesUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: ListAddressMismatchesUseCase;
  let radioModelId: string;
  let core: string;
  const reader = new FakeRouterHostReader();

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new ListAddressMismatchesUseCase(
      new PrismaDeviceAddressQuery(prisma),
      new RouterHostQueryAdapter(
        new RouterSurvey(
          new PrismaPortSpeedTargetsQuery(prisma, true),
          reader
        )
      ),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    reader.reset();
    await cleanDatabase(prisma);
    radioModelId = await seedWirelessDeviceModel(prisma);
    core = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: await seedMikrotikModel(prisma),
      ip: '10.0.7.254'
    });
  });

  async function seedRadio(
    name: string,
    ipAddress: string,
    macAddress: string,
    status: 'ACTIVE' | 'INVENTORY' = 'ACTIVE'
  ): Promise<string> {
    const id = await seedNetworkDevice(prisma, radioModelId, {
      name,
      ipAddress,
      status
    });
    await prisma.device.update({
      where: { id },
      data: { macAddress }
    });
    return id;
  }

  it('[DEV-219] lists a device whose IP the router gives to another device', async () => {
    const ap = await seedRadio(
      'AP 32',
      '10.0.7.21',
      '24:A4:3C:00:00:21'
    );
    const sta = await seedRadio(
      'Cliente Virgüez',
      '10.0.7.80',
      '24:A4:3C:00:00:80'
    );
    reader.serve('10.0.7.254', {
      arp: [
        {
          ipAddress: '10.0.7.21',
          macAddress: '24:A4:3C:00:00:80',
          interface: 'bridge-lan'
        }
      ]
    });

    const result = await useCase.execute({});

    expect(result.value).toEqual({
      mismatches: [
        {
          deviceId: ap,
          deviceName: 'AP 32',
          ipAddress: '10.0.7.21',
          macAddressesOnFile: ['24:A4:3C:00:00:21'],
          seenMacAddress: '24:A4:3C:00:00:80',
          kind: 'OTHER_DEVICE',
          otherDeviceId: sta,
          otherDeviceName: 'Cliente Virgüez',
          seenBy: [{ routerDeviceId: core, routerName: 'Core' }]
        }
      ],
      unreadRouters: []
    });
  });

  it('[DEV-219] accepts the MAC the radio last reported', async () => {
    const ap = await seedRadio(
      'AP 32',
      '10.0.7.21',
      '24:A4:3C:00:00:21'
    );
    await prisma.wirelessSnapshot.create({
      data: {
        deviceId: ap,
        deviceType: 'ACCESS_POINT',
        collectedAt: new Date(),
        collectionMethod: 'HTTP',
        macAddress: '26:A4:3C:00:00:21'
      }
    });
    reader.serve('10.0.7.254', {
      arp: [
        {
          ipAddress: '10.0.7.21',
          macAddress: '26:A4:3C:00:00:21',
          interface: 'bridge-lan'
        }
      ]
    });

    const result = await useCase.execute({});

    expect(result.value.mismatches).toEqual([]);
  });

  it('[DEV-219] skips a device out of service', async () => {
    await seedRadio(
      'AP viejo',
      '10.0.7.21',
      '24:A4:3C:00:00:21',
      'INVENTORY'
    );
    reader.serve('10.0.7.254', {
      arp: [
        {
          ipAddress: '10.0.7.21',
          macAddress: 'DE:AD:00:00:00:01',
          interface: 'bridge-lan'
        }
      ]
    });

    const result = await useCase.execute({});

    expect(result.value.mismatches).toEqual([]);
  });

  it('[DEV-219] reports a router that refused its address tables', async () => {
    reader.serve('10.0.7.254', { arp: null, leases: null });

    const result = await useCase.execute({});

    expect(result.value.unreadRouters).toEqual([
      {
        deviceId: core,
        name: 'Core',
        reason:
          'The router did not answer its ARP table or DHCP leases'
      }
    ]);
  });
});
