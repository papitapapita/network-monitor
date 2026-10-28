// Source: src/application/device-monitoring/use-cases/SetPortExpectedSpeedUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
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
import { FakeRouterPortReader } from '../../helpers/FakeRouterPortReader';
import {
  buildPortSpeeds,
  expectedSpeedsOf,
  seedExpectedSpeed,
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

describe('SetPortExpectedSpeedUseCase — integration', () => {
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
      deviceModelId: await seedMikrotikModel(prisma)
    });
  });

  const set = (
    deviceId: string,
    portName: string,
    expectedMbps: number | null
  ) =>
    buildPortSpeeds(prisma, reader).setExpected.execute({
      deviceId,
      portName,
      expectedMbps
    });

  it('[MON-142] should store the speed a port should link at, without reading the router', async () => {
    const result = await set(coreId, 'ether2', 1000);

    expect(result.value).toEqual({
      deviceId: coreId,
      portName: 'ether2',
      expectedMbps: 1000,
      alertOnNoLink: false
    });
    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
      ether2: 1000
    });
    expect(reader.reads).toEqual([]);
  });

  it('[MON-142] should change a stored speed in place', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether2', 1000);

    await set(coreId, 'ether2', 100);

    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
      ether2: 100
    });
    expect(await prisma.portExpectedSpeed.count()).toBe(1);
  });

  it('[MON-142] should clear a stored speed', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether2', 1000);
    await seedExpectedSpeed(prisma, coreId, 'ether3', 1000);

    const result = await set(coreId, 'ether2', null);

    expect(result.value.expectedMbps).toBeNull();
    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
      ether3: 1000
    });
  });

  it("[MON-142] should keep each router's ports apart", async () => {
    const edgeId = await seedRouter(prisma, {
      name: 'Edge',
      deviceModelId: await seedMikrotikModel(prisma)
    });

    await set(coreId, 'ether1', 1000);
    await set(edgeId, 'ether1', 100);

    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
      ether1: 1000
    });
    expect(await expectedSpeedsOf(prisma, edgeId)).toEqual({
      ether1: 100
    });
  });

  it('[MON-142] should refuse a speed ports do not link at', async () => {
    const result = await set(coreId, 'ether2', 500);

    expect(result.error).toMatch(/must be one of/);
    expect(await prisma.portExpectedSpeed.count()).toBe(0);
  });

  it('[MON-140] should refuse a device that is not one of the MikroTiks', async () => {
    const customerId = await seedRouter(prisma, {
      name: 'Customer hAP',
      deviceModelId: await seedMikrotikModel(prisma),
      owner: 'CLIENT'
    });

    expect((await set(customerId, 'ether1', 100)).error).toBe(
      PORT_SPEED_ROUTER_NOT_FOUND
    );
    expect((await set(GHOST_ID, 'ether1', 100)).error).toBe(
      PORT_SPEED_ROUTER_NOT_FOUND
    );
  });

  it('[MON-149] should store the no-link alert and keep it when only the speed changes', async () => {
    const setup = buildPortSpeeds(prisma, reader).setExpected;
    await setup.execute({
      deviceId: coreId,
      portName: 'ether1',
      expectedMbps: 1000,
      alertOnNoLink: true
    });
    await set(coreId, 'ether1', 100);

    const row = await prisma.portExpectedSpeed.findFirstOrThrow({
      where: { deviceId: coreId, portName: 'ether1' }
    });
    expect([row.expectedMbps, row.alertOnNoLink]).toEqual([
      100,
      true
    ]);

    await setup.execute({
      deviceId: coreId,
      portName: 'ether1',
      expectedMbps: 100,
      alertOnNoLink: false
    });
    const off = await prisma.portExpectedSpeed.findFirstOrThrow({
      where: { deviceId: coreId, portName: 'ether1' }
    });
    expect(off.alertOnNoLink).toBe(false);
  });

  it('should refuse a malformed device id', async () => {
    const result = await set(INVALID_ID, 'ether1', 100);

    expect(result.error).toMatch(/^Invalid device ID/);
  });

  it("should drop the router's speeds with the router", async () => {
    await set(coreId, 'ether1', 1000);

    await prisma.device.delete({ where: { id: coreId } });

    expect(await prisma.portExpectedSpeed.count()).toBe(0);
  });
});
