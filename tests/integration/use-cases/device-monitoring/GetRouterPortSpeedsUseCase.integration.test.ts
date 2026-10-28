// Source: src/application/device-monitoring/use-cases/GetRouterPortSpeedsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from '../../../../src/domain/shared/core';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { PORT_SPEED_ROUTER_NOT_FOUND } from '../../../../src/application/device-monitoring/use-cases';
import {
  cleanDatabase,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import {
  FakeRouterPortReader,
  linkedPort,
  unlinkedPort
} from '../../helpers/FakeRouterPortReader';
import {
  buildPortSpeeds,
  checkStateOf,
  seedExpectedSpeed,
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

describe('GetRouterPortSpeedsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  let coreId: string;
  const reader = new FakeRouterPortReader();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    reader.reset();
    await cleanDatabase(prisma);
    modelId = await seedMikrotikModel(prisma);
    coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
  });

  const get = (deviceId: string) =>
    buildPortSpeeds(prisma, reader).get.execute({ deviceId });

  it('[MON-150] should read only that router and judge it against its stored speeds', async () => {
    await seedRouter(prisma, {
      name: 'Edge',
      deviceModelId: modelId,
      ip: '10.0.0.2'
    });
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000, true);
    reader.serve(
      '10.0.0.1',
      [linkedPort('ether1', 100, 'Uplink'), unlinkedPort('ether2')],
      'Core-Insetel'
    );

    const result = await get(coreId);

    expect(reader.reads.map((r) => r.host)).toEqual(['10.0.0.1']);
    expect(result.value.router).toMatchObject({
      deviceId: coreId,
      name: 'Core',
      identity: 'Core-Insetel',
      readable: true,
      error: null
    });
    expect(
      result.value.router.ports.map((p) => [
        p.name,
        p.expectedMbps,
        p.alertOnNoLink,
        p.verdict
      ])
    ).toEqual([
      ['ether1', 1000, true, 'SLOW'],
      ['ether2', null, false, 'NO_LINK']
    ]);
  });

  it('[MON-150] should leave the scheduled check state alone', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 100)]);

    await get(coreId);
    await get(coreId);

    expect(await checkStateOf(prisma, coreId, 'ether1')).toEqual({
      slowChecks: 0,
      alertedAt: null
    });
  });

  it('[MON-150] should answer the error of a router that does not answer', async () => {
    reader.answer(
      '10.0.0.1',
      Result.fail('RouterOS API error: timeout')
    );

    const result = await get(coreId);

    expect(result.value.router).toMatchObject({
      readable: true,
      error: 'RouterOS API error: timeout',
      ports: []
    });
  });

  it('[MON-145] should list a router it cannot read with the reason, without trying it', async () => {
    const noLoginId = await seedRouter(prisma, {
      name: 'No login',
      deviceModelId: modelId,
      login: null
    });

    const result = await get(noLoginId);

    expect(result.value.router).toMatchObject({
      readable: false,
      reason: 'The router has no username and password saved'
    });
    expect(reader.reads).toEqual([]);
  });

  it('[MON-140] should refuse a device that is not one of the MikroTiks', async () => {
    const otherVendor = await seedRouter(prisma, {
      name: 'Not a MikroTik',
      deviceModelId: await seedMikrotikModel(prisma, 'ROUTERBOARD', {
        vendorSlug: 'ubiquiti'
      })
    });

    expect((await get(otherVendor)).error).toBe(
      PORT_SPEED_ROUTER_NOT_FOUND
    );
    expect((await get(GHOST_ID)).error).toBe(
      PORT_SPEED_ROUTER_NOT_FOUND
    );
  });

  it('should refuse a malformed device id', async () => {
    const result = await get(INVALID_ID);

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
