// Source: src/application/device-inventory/use-cases/GetRouterNeighborsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from '../../../../src/domain/shared/core';
import { GetRouterNeighborsUseCase } from 'application/device-inventory/use-cases';
import { RouterSurvey } from 'application/device-monitoring/services';
import {
  PrismaKnownDeviceLookup,
  PrismaTopologyQuery
} from 'infrastructure/persistence';
import { PrismaPortSpeedTargetsQuery } from 'infrastructure/monitoring/port-speeds';
import { RouterNeighborQueryAdapter } from 'infrastructure/monitoring/router-neighbors';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  createTestPrisma,
  cleanDatabase,
  seedWirelessDeviceModel,
  seedNetworkDevice,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import {
  FakeRouterNeighborReader,
  neighbor
} from '../../helpers/FakeRouterNeighborReader';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

describe('GetRouterNeighborsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetRouterNeighborsUseCase;
  let routerModelId: string;
  let radioModelId: string;
  const reader = new FakeRouterNeighborReader();

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetRouterNeighborsUseCase(
      new RouterNeighborQueryAdapter(
        new RouterSurvey(
          new PrismaPortSpeedTargetsQuery(prisma, true),
          reader
        )
      ),
      new PrismaKnownDeviceLookup(prisma),
      new PrismaTopologyQuery(prisma, true),
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

  it('[DEV-198] lists each port, what it hears and the comment it could carry', async () => {
    const core = await seedRouter(prisma, {
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
    reader.serve(
      '10.0.7.1',
      [
        neighbor('ether1', {
          ipAddress: '10.0.7.254',
          identity: 'Core'
        }),
        neighbor('ether1', { ipAddress: '10.0.7.21' }),
        neighbor('ether2 AP 32', {
          ipAddress: '10.0.7.21',
          identity: 'AP 32'
        }),
        neighbor('ether2 AP 32', {
          ipAddress: '10.0.7.90',
          identity: 'CPE Juan',
          remoteInterface: 'ath0'
        })
      ],
      [
        { name: 'ether1', comment: 'Uplink' },
        { name: 'ether2 AP 32', comment: null },
        { name: 'ether3', comment: null }
      ]
    );

    const result = await useCase.execute({ deviceId: hex });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceName).toBe('Hex Norte');
    expect(result.value.reason).toBeNull();
    const [uplink, ether2, ether3] = result.value.ports;
    expect(uplink).toMatchObject({
      port: 'ether1',
      comment: 'Uplink',
      uplink: true,
      suggestedComment: null
    });
    expect(uplink!.neighbors.map((n) => n.knownDeviceId)).toEqual([
      core,
      ap
    ]);
    expect(ether2).toMatchObject({
      port: 'ether2 AP 32',
      uplink: false,
      suggestedComment: 'AP 32'
    });
    expect(
      ether2!.neighbors.map((n) => [
        n.identity,
        n.wireless,
        n.knownDeviceName
      ])
    ).toEqual([
      ['AP 32', false, 'AP 32'],
      ['CPE Juan', true, null]
    ]);
    expect(ether3).toEqual({
      port: 'ether3',
      comment: null,
      uplink: false,
      neighbors: [],
      suggestedComment: null
    });
  });

  it('[DEV-198] answers why the router could not be read', async () => {
    const hex = await seedRouter(prisma, {
      name: 'Hex Norte',
      deviceModelId: routerModelId,
      ip: '10.0.7.1'
    });
    reader.answer(
      '10.0.7.1',
      Result.fail('RouterOS API error: timeout')
    );

    const result = await useCase.execute({ deviceId: hex });

    expect(result.value).toEqual({
      deviceId: hex,
      deviceName: 'Hex Norte',
      reason: 'RouterOS API error: timeout',
      ports: []
    });
  });

  it('fails as not found for a device that is not a MikroTik router', async () => {
    const ap = await seedNetworkDevice(prisma, radioModelId, {
      name: 'AP 32',
      ipAddress: '10.0.7.21'
    });

    const result = await useCase.execute({ deviceId: ap });

    expect(result.error).toBe(`MikroTik router not found: ${ap}`);
    expect(reader.reads).toHaveLength(0);
  });

  it('fails as not found for an unknown id', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.error).toContain('not found');
  });

  it('refuses a malformed id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.error).toContain('Invalid device ID');
  });
});
