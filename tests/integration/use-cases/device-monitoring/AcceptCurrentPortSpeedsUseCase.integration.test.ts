// Source: src/application/device-monitoring/use-cases/AcceptCurrentPortSpeedsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from '../../../../src/domain/shared/core';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  PORT_SPEED_ROUTER_DID_NOT_ANSWER,
  PORT_SPEED_ROUTER_NOT_FOUND,
  PORT_SPEED_ROUTER_NOT_READABLE
} from '../../../../src/application/device-monitoring/use-cases';
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
  expectedSpeedsOf,
  seedExpectedSpeed,
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

describe('AcceptCurrentPortSpeedsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
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
    coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: await seedMikrotikModel(prisma),
      ip: '10.0.0.1'
    });
  });

  const accept = (deviceId = coreId) =>
    buildPortSpeeds(prisma, reader).acceptCurrent.execute({
      deviceId
    });

  it("[MON-144] should store every linked port's rate as its expected speed", async () => {
    reader.serve('10.0.0.1', [
      linkedPort('ether1', 1000),
      linkedPort('ether2', 100),
      unlinkedPort('ether3')
    ]);

    const result = await accept();

    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
      ether1: 1000,
      ether2: 100
    });
    expect(result.value.ports.map((p) => p.verdict)).toEqual([
      'OK',
      'OK',
      'NO_LINK'
    ]);
  });

  it('[MON-144] should overwrite linked ports and keep the rest', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    await seedExpectedSpeed(prisma, coreId, 'ether3', 1000);
    reader.serve('10.0.0.1', [
      linkedPort('ether1', 100),
      unlinkedPort('ether3')
    ]);

    await accept();

    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
      ether1: 100,
      ether3: 1000
    });
  });

  it('[MON-144] should change nothing when the router does not answer', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.answer(
      '10.0.0.1',
      Result.fail('RouterOS API error: timeout')
    );

    const result = await accept();

    expect(result.error).toBe(
      `${PORT_SPEED_ROUTER_DID_NOT_ANSWER}: RouterOS API error: timeout`
    );
    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
      ether1: 1000
    });
  });

  it('[MON-145] should refuse a router it cannot read', async () => {
    const noLoginId = await seedRouter(prisma, {
      name: 'No login',
      deviceModelId: await seedMikrotikModel(prisma),
      login: null
    });

    const result = await accept(noLoginId);

    expect(result.error).toBe(
      `${PORT_SPEED_ROUTER_NOT_READABLE}: The router has no username and password saved`
    );
  });

  it('should refuse an unknown device', async () => {
    expect((await accept(GHOST_ID)).error).toBe(
      PORT_SPEED_ROUTER_NOT_FOUND
    );
  });

  it('should refuse a malformed device id', async () => {
    expect((await accept(INVALID_ID)).error).toMatch(
      /^Invalid device ID/
    );
  });
});
