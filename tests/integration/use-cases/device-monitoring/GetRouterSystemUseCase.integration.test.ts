// Source: src/application/device-monitoring/use-cases/GetRouterSystemUseCase.ts

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
import {
  FakeRouterOsPrinter,
  rb4011
} from '../../helpers/FakeRouterOsPrinter';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';
import {
  buildRouterSystems,
  systemStateOf
} from '../../helpers/routerSystems';
import { FakeAlertPublisher } from '../../helpers/FakeAlertPublisher';

describe('GetRouterSystemUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  let coreId: string;
  const printer = new FakeRouterOsPrinter();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    printer.reset();
    await cleanDatabase(prisma);
    modelId = await seedMikrotikModel(prisma);
    coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
  });

  it('[MON-163] should read only that router now and keep the reading', async () => {
    await seedRouter(prisma, {
      name: 'Borde',
      deviceModelId: modelId,
      ip: '10.0.0.2'
    });
    printer.serve('10.0.0.1', rb4011());
    const systems = buildRouterSystems(prisma, printer);

    const result = await systems.get.execute({ deviceId: coreId });

    expect(printer.batches.map((b) => b.connection.host)).toEqual([
      '10.0.0.1'
    ]);
    expect(result.value.router).toMatchObject({
      deviceId: coreId,
      name: 'Core',
      readAt: systems.now.toISOString(),
      system: expect.objectContaining({ identity: 'Core-Insetel' })
    });
    expect(await systemStateOf(prisma, coreId)).toMatchObject({
      identity: 'Core-Insetel',
      readAt: systems.now
    });
  });

  it('[MON-163] should answer a router that does not answer with its error', async () => {
    printer.refuse('10.0.0.1', 'RouterOS API error: timeout');

    const result = await buildRouterSystems(
      prisma,
      printer
    ).get.execute({
      deviceId: coreId
    });

    expect(result.value.router).toMatchObject({
      system: null,
      lastError: 'RouterOS API error: timeout'
    });
  });

  it('[MON-171] [MON-175] should tell of a reboot this read reveals, and judge no health', async () => {
    const publisher = new FakeAlertPublisher();
    const read = (now: Date) =>
      buildRouterSystems(prisma, printer, {
        publisher,
        now
      }).get.execute({
        deviceId: coreId
      });
    printer.serve('10.0.0.1', rb4011());
    await read(new Date('2026-10-28T15:00:00Z'));
    const rebooted = rb4011();
    rebooted['/system/resource/print'] = [
      {
        ...rebooted['/system/resource/print']![0],
        uptime: '1m',
        'cpu-load': '99'
      }
    ];
    printer.serve('10.0.0.1', rebooted);

    const result = await read(new Date('2026-10-28T15:10:00Z'));

    expect(result.value.router.bootedAt).toBe(
      '2026-10-28T15:09:00.000Z'
    );
    expect(publisher.sent).toEqual([
      expect.objectContaining({ type: 'router_rebooted' })
    ]);
    expect(await systemStateOf(prisma, coreId)).toMatchObject({
      highCpuChecks: 0,
      healthIssues: []
    });
  });

  it('[MON-163] should refuse a device that is not one of the routers', async () => {
    const result = await buildRouterSystems(
      prisma,
      printer
    ).get.execute({
      deviceId: GHOST_ID
    });

    expect(result.error).toBe(PORT_SPEED_ROUTER_NOT_FOUND);
  });

  it('should refuse a malformed id', async () => {
    const result = await buildRouterSystems(
      prisma,
      printer
    ).get.execute({
      deviceId: INVALID_ID
    });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
