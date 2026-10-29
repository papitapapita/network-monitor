// Source: src/application/device-inventory/use-cases/GetDeviceNetworkLocationUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetDeviceNetworkLocationUseCase } from 'application/device-inventory/use-cases';
import { RouterSurvey } from 'application/device-monitoring/services';
import { PrismaDeviceAddressQuery } from 'infrastructure/persistence';
import { PrismaPortSpeedTargetsQuery } from 'infrastructure/monitoring/port-speeds';
import { RouterHostQueryAdapter } from 'infrastructure/monitoring/router-hosts';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  createTestPrisma,
  cleanDatabase,
  seedWirelessDeviceModel,
  seedNetworkDevice,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { FakeRouterHostReader } from '../../helpers/FakeRouterHostReader';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

const CORE_MAC = '48:8F:5A:00:00:01';
const HEX_MAC = '48:8F:5A:00:00:02';
const LABEL_MAC = '24:A4:3C:00:00:21';
const RADIO_MAC = '26:A4:3C:00:00:21';

describe('GetDeviceNetworkLocationUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetDeviceNetworkLocationUseCase;
  let routerModelId: string;
  let radioModelId: string;
  const reader = new FakeRouterHostReader();

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetDeviceNetworkLocationUseCase(
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
    routerModelId = await seedMikrotikModel(prisma);
    radioModelId = await seedWirelessDeviceModel(prisma);
  });

  async function seedNetwork(): Promise<{ hex: string; ap: string }> {
    await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: routerModelId,
      ip: '10.0.7.254',
      category: 'GATEWAY'
    });
    const hex = await seedRouter(prisma, {
      name: 'Hex Norte',
      deviceModelId: routerModelId,
      ip: '10.0.7.1'
    });
    const ap = await seedNetworkDevice(prisma, radioModelId, {
      name: 'AP 32',
      ipAddress: '10.0.7.21'
    });
    reader.serve('10.0.7.254', {
      bridgeHosts: [
        { macAddress: CORE_MAC, port: 'bridge-lan', local: true },
        { macAddress: HEX_MAC, port: 'ether4', local: false },
        { macAddress: RADIO_MAC, port: 'ether4', local: false }
      ]
    });
    reader.serve('10.0.7.1', {
      ports: [{ name: 'ether2', comment: 'AP 32' }],
      bridgeHosts: [
        { macAddress: HEX_MAC, port: 'bridge', local: true },
        { macAddress: CORE_MAC, port: 'ether1', local: false },
        { macAddress: RADIO_MAC, port: 'ether2', local: false }
      ]
    });
    return { hex, ap };
  }

  it('[DEV-199] finds a radio by the MAC it last reported and places it behind the closest port', async () => {
    const { hex, ap } = await seedNetwork();
    await prisma.device.update({
      where: { id: ap },
      data: { macAddress: LABEL_MAC }
    });
    await prisma.wirelessSnapshot.create({
      data: {
        deviceId: ap,
        deviceType: 'ACCESS_POINT',
        collectedAt: new Date(),
        collectionMethod: 'HTTP',
        macAddress: RADIO_MAC
      }
    });

    const result = await useCase.execute({ deviceId: ap });

    expect(result.value).toEqual({
      deviceId: ap,
      deviceName: 'AP 32',
      macAddresses: [LABEL_MAC, RADIO_MAC],
      location: {
        routerDeviceId: hex,
        routerName: 'Hex Norte',
        port: 'ether2',
        portComment: 'AP 32',
        macAddress: RADIO_MAC,
        closest: true
      },
      sightings: [
        expect.objectContaining({
          routerName: 'Core',
          closest: false
        }),
        expect.objectContaining({
          routerName: 'Hex Norte',
          closest: true
        })
      ],
      unreadRouters: []
    });
  });

  it('[DEV-199] finds a router by the MAC its RouterBOARD reports', async () => {
    const { hex } = await seedNetwork();
    const at = new Date();
    await prisma.routerSystemState.create({
      data: {
        deviceId: hex,
        macAddress: HEX_MAC,
        readAt: at,
        attemptedAt: at
      }
    });

    const result = await useCase.execute({ deviceId: hex });

    expect(result.value.location).toMatchObject({
      routerName: 'Core',
      port: 'ether4'
    });
  });

  it('[DEV-199] answers with the routers it could not read', async () => {
    const { ap } = await seedNetwork();
    const silent = await seedRouter(prisma, {
      name: 'Hex Sur',
      deviceModelId: routerModelId,
      login: null
    });

    const result = await useCase.execute({ deviceId: ap });

    expect(result.value.location).toBeNull();
    expect(result.value.unreadRouters).toEqual([
      {
        deviceId: silent,
        name: 'Hex Sur',
        reason: 'The router has no username and password saved'
      }
    ]);
  });

  it('[DEV-199] fails for a device in the recycle bin', async () => {
    const { ap } = await seedNetwork();
    await prisma.device.update({
      where: { id: ap },
      data: { deletedAt: new Date() }
    });

    const result = await useCase.execute({ deviceId: ap });

    expect(result.error).toBe(`Device not found: ${ap}`);
  });

  it('[DEV-199] fails for an unknown device', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.error).toBe(`Device not found: ${GHOST_ID}`);
  });

  it('[DEV-199] rejects a malformed id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.error).toContain('Invalid device ID');
  });
});
