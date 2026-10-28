// Source: src/application/device-monitoring/use-cases/CheckRouterSystemsUseCase.ts

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
import {
  buildRouterSystems,
  systemStateOf
} from '../../helpers/routerSystems';

describe('CheckRouterSystemsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  const printer = new FakeRouterOsPrinter();
  const AT = new Date('2026-10-28T15:00:00Z');
  const LATER = new Date('2026-10-28T15:10:00Z');

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

  const check = (now = AT) =>
    buildRouterSystems(prisma, printer).check.execute({ now });

  it('[MON-161] should store what each router said about itself', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', rb4011());

    const result = await check();

    expect(result.value).toEqual({
      routersRead: 1,
      skipped: [],
      failed: []
    });
    const row = await systemStateOf(prisma, coreId);
    expect(row).toMatchObject({
      identity: 'Core-Insetel',
      model: 'RB4011iGS+',
      serialNumber: 'D4440E1A2B3C',
      macAddress: 'DC:2C:6E:00:00:01',
      routerOsVersion: '7.15.3',
      uptimeSeconds: 93600,
      cpuLoadPercent: 9,
      totalMemoryBytes: BigInt(1073741824),
      voltage: expect.closeTo(24.1, 3),
      temperatureC: 41,
      readAt: AT,
      lastError: null,
      attemptedAt: AT
    });
  });

  it('[MON-161] should keep the last reading when a later read fails', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', rb4011());
    await check(AT);
    printer.refuse('10.0.0.1', 'RouterOS API error: timeout');

    const result = await check(LATER);

    expect(result.value.failed).toEqual([
      {
        deviceId: coreId,
        name: 'Core',
        why: 'RouterOS API error: timeout'
      }
    ]);
    expect(await systemStateOf(prisma, coreId)).toMatchObject({
      identity: 'Core-Insetel',
      readAt: AT,
      lastError: 'RouterOS API error: timeout',
      attemptedAt: LATER
    });
  });

  it('[MON-161] should replace the reading on the next good read', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', rb4011('Core-Insetel', 'OLDSERIAL'));
    await check(AT);
    printer.serve('10.0.0.1', rb4011('Core-Nuevo', 'NEWSERIAL'));

    await check(LATER);

    expect(await systemStateOf(prisma, coreId)).toMatchObject({
      identity: 'Core-Nuevo',
      serialNumber: 'NEWSERIAL',
      readAt: LATER
    });
    expect(await prisma.routerSystemState.count()).toBe(1);
  });

  it('[MON-161] should store nothing for a router that cannot be read', async () => {
    const noLogin = await seedRouter(prisma, {
      name: 'Sin clave',
      deviceModelId: modelId,
      login: null
    });

    const result = await check();

    expect(result.value.skipped).toEqual([
      {
        deviceId: noLogin,
        name: 'Sin clave',
        why: 'The router has no username and password saved'
      }
    ]);
    expect(printer.batches).toEqual([]);
    expect(await systemStateOf(prisma, noLogin)).toBeNull();
  });

  it('[MON-161] should read only allowed commands, in one batch per router', async () => {
    await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', rb4011());

    await check();

    expect(printer.batches).toHaveLength(1);
    expect(
      printer.batches[0]!.commands.map((c) => c.command)
    ).toEqual([
      '/system/identity/print',
      '/system/resource/print',
      '/system/routerboard/print',
      '/system/health/print',
      '/interface/ethernet/print'
    ]);
  });

  it('[MON-161] should leave out devices that are not company MikroTiks in service', async () => {
    const radioModel = await seedMikrotikModel(prisma, 'RADIO');
    await seedRouter(prisma, {
      name: 'Radio',
      deviceModelId: radioModel,
      ip: '10.0.0.5'
    });
    await seedRouter(prisma, {
      name: 'En bodega',
      deviceModelId: modelId,
      ip: '10.0.0.6',
      status: 'INVENTORY'
    });

    const result = await check();

    expect(result.value).toEqual({
      routersRead: 0,
      skipped: [],
      failed: []
    });
    expect(printer.batches).toEqual([]);
  });

  it('[MON-161] should drop the state with the device', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', rb4011());
    await check();

    await prisma.device.delete({ where: { id: coreId } });

    expect(await prisma.routerSystemState.count()).toBe(0);
  });
});
