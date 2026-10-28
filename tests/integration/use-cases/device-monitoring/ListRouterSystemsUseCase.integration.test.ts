// Source: src/application/device-monitoring/use-cases/ListRouterSystemsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import {
  FakeRouterOsPrinter,
  rb4011
} from '../../helpers/FakeRouterOsPrinter';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';
import { buildRouterSystems } from '../../helpers/routerSystems';

describe('ListRouterSystemsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  const printer = new FakeRouterOsPrinter();
  const AT = new Date('2026-10-28T15:00:00Z');

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
  });

  it('[MON-162] should list every router by name with its stored reading, reading none', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    const edgeId = await seedRouter(prisma, {
      name: 'Borde',
      deviceModelId: modelId,
      ip: '10.0.0.2'
    });
    printer.serve('10.0.0.1', rb4011());
    const systems = buildRouterSystems(prisma, printer);
    await systems.check.execute({ now: AT });
    printer.reset();

    const result = await systems.list.execute();

    expect(printer.batches).toEqual([]);
    expect(result.value.routers.map((r) => r.name)).toEqual([
      'Borde',
      'Core'
    ]);
    expect(result.value.routers[0]).toMatchObject({
      deviceId: edgeId,
      readable: true,
      system: null,
      readAt: null,
      lastError: 'No answer set for 10.0.0.2',
      attemptedAt: AT.toISOString()
    });
    expect(result.value.routers[1]).toMatchObject({
      deviceId: coreId,
      readable: true,
      reason: null,
      readAt: AT.toISOString(),
      lastError: null,
      system: expect.objectContaining({
        identity: 'Core-Insetel',
        serialNumber: 'D4440E1A2B3C',
        totalMemoryBytes: 1073741824
      })
    });
  });

  it('[MON-162] should say why a router is never read', async () => {
    await seedRouter(prisma, {
      name: 'Sin IP',
      deviceModelId: modelId,
      ip: null
    });

    const result = await buildRouterSystems(
      prisma,
      printer
    ).list.execute();

    expect(result.value.routers).toEqual([
      expect.objectContaining({
        readable: false,
        reason: 'The router has no IP address',
        system: null,
        attemptedAt: null
      })
    ]);
  });

  it('[MON-162] should list nothing when there are no MikroTiks', async () => {
    const result = await buildRouterSystems(
      prisma,
      printer
    ).list.execute();

    expect(result.value.routers).toEqual([]);
  });
});
