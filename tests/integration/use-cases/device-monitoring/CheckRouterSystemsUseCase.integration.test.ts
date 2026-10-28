// Source: src/application/device-monitoring/use-cases/CheckRouterSystemsUseCase.ts

import { refuseRouterOsCommand } from '../../../../src/agent/protocol/messages';
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
import { FakeAlertPublisher } from '../../helpers/FakeAlertPublisher';

// rb4011() with some of its resource or health fields changed.
function rb4011With(
  resource: Record<string, string>,
  health: Record<string, string> = {}
) {
  const served = rb4011();
  return {
    ...served,
    '/system/resource/print': [
      { ...served['/system/resource/print']![0], ...resource }
    ],
    '/system/health/print': served['/system/health/print']!.map(
      (row) =>
        health[row.name!] !== undefined
          ? { ...row, value: health[row.name!]! }
          : row
    )
  };
}

describe('CheckRouterSystemsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  const printer = new FakeRouterOsPrinter();
  const publisher = new FakeAlertPublisher();
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
    publisher.reset();
    await cleanDatabase(prisma);
    modelId = await seedMikrotikModel(prisma);
  });

  const check = (now = AT) =>
    buildRouterSystems(prisma, printer, { publisher }).check.execute({
      now
    });

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
      failed: [],
      rebooted: 0,
      healthRaised: 0,
      healthRecovered: 0
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

  it('[MON-161] [MON-180] should read only allowed commands, in one batch per router', async () => {
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
      '/interface/ethernet/print',
      '/ip/service/print',
      '/user/print',
      '/ip/neighbor/discovery-settings/print'
    ]);
    expect(
      printer.batches[0]!.commands.map(refuseRouterOsCommand)
    ).toEqual(Array(8).fill(null));
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
      failed: [],
      rebooted: 0,
      healthRaised: 0,
      healthRecovered: 0
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

  describe('reboots', () => {
    let coreId: string;
    // 5 minutes of uptime at LATER: it started at 15:05
    const BOOTED = new Date('2026-10-28T15:05:00Z');

    beforeEach(async () => {
      coreId = await seedRouter(prisma, {
        name: 'Core',
        deviceModelId: modelId,
        ip: '10.0.0.1'
      });
      printer.serve('10.0.0.1', rb4011());
      await check(AT);
      printer.serve('10.0.0.1', rb4011With({ uptime: '5m' }));
    });

    const downAlert = (
      fields: Partial<{
        startedAt: Date;
        resolvedAt: Date | null;
        notifiedAt: Date | null;
        causedByAlertId: string | null;
        deviceId: string;
      }>
    ) =>
      prisma.alertEvent.create({
        data: {
          deviceId: coreId,
          type: 'device_unreachable',
          source: 'Disponibilidad',
          startedAt: new Date('2026-10-28T15:04:00Z'),
          resolvedAt: new Date('2026-10-28T15:06:00Z'),
          notifiedAt: new Date('2026-10-28T15:04:30Z'),
          ...fields
        }
      });

    it('[MON-170] [MON-171] should tell of a reboot no down alert reported', async () => {
      const result = await check(LATER);

      expect(result.value.rebooted).toBe(1);
      expect(publisher.sent).toEqual([
        expect.objectContaining({
          deviceId: coreId,
          type: 'router_rebooted',
          summary: 'El router "Core" se reinició',
          occurredAt: BOOTED,
          resolved: false
        })
      ]);
    });

    it('[MON-171] should stay silent when a down notice covers the reboot', async () => {
      await downAlert({});

      await check(LATER);

      expect(publisher.sent).toEqual([]);
    });

    it('[MON-171] should stay silent when the outage is still open', async () => {
      await downAlert({ resolvedAt: null });

      await check(LATER);

      expect(publisher.sent).toEqual([]);
    });

    it('[MON-171] should stay silent when its down alert was rolled into one that was sent', async () => {
      const upstreamId = await seedRouter(prisma, {
        name: 'Torre',
        deviceModelId: modelId,
        ip: '10.0.0.9'
      });
      const root = await downAlert({ deviceId: upstreamId });
      await downAlert({ notifiedAt: null, causedByAlertId: root.id });

      await check(LATER);

      expect(publisher.sent).toEqual([]);
    });

    it('[MON-171] should tell of the reboot when the down alert was never sent', async () => {
      await downAlert({ notifiedAt: null });

      await check(LATER);

      expect(publisher.sent).toHaveLength(1);
    });

    it('[MON-171] should tell of the reboot when the only down notice is older', async () => {
      await downAlert({
        startedAt: new Date('2026-10-28T12:00:00Z'),
        resolvedAt: new Date('2026-10-28T12:30:00Z')
      });

      await check(LATER);

      expect(publisher.sent).toHaveLength(1);
    });

    it('[MON-171] should not count a down notice of another device', async () => {
      const otherId = await seedRouter(prisma, {
        name: 'Otro',
        deviceModelId: modelId,
        ip: '10.0.0.9'
      });
      await downAlert({ deviceId: otherId });

      await check(LATER);

      expect(publisher.sent).toHaveLength(1);
    });
  });

  describe('health', () => {
    let coreId: string;
    // up since the same boot at every check, so no reboot is seen
    const upAt = (now: Date) =>
      `${(now.getTime() - Date.parse('2026-10-28T12:00:00Z')) / 1000}s`;
    const serve = (
      now: Date,
      resource: Record<string, string> = {},
      health: Record<string, string> = {}
    ) =>
      printer.serve(
        '10.0.0.1',
        rb4011With({ uptime: upAt(now), ...resource }, health)
      );

    beforeEach(async () => {
      coreId = await seedRouter(prisma, {
        name: 'Core',
        deviceModelId: modelId,
        ip: '10.0.0.1'
      });
    });

    it('[MON-173] [MON-174] [MON-175] should raise a hot router once and keep it open', async () => {
      serve(AT, {}, { temperature: '80' });
      const first = await check(AT);
      serve(LATER, {}, { temperature: '80' });
      const second = await check(LATER);

      expect(first.value.healthRaised).toBe(1);
      expect(second.value.healthRaised).toBe(0);
      expect(publisher.sent).toEqual([
        expect.objectContaining({
          type: 'router_health',
          summary: 'Temperatura de 80 °C en "Core" (más de 75 °C)',
          resolved: false
        })
      ]);
      expect(await systemStateOf(prisma, coreId)).toMatchObject({
        healthIssues: ['TEMPERATURE']
      });
    });

    it('[MON-174] should announce the recovery', async () => {
      serve(AT, {}, { temperature: '80' });
      await check(AT);
      serve(LATER);

      const result = await check(LATER);

      expect(result.value.healthRecovered).toBe(1);
      expect(publisher.sent[1]).toMatchObject({
        summary: 'Se normalizó la temperatura en "Core" (41 °C)',
        resolved: true
      });
      expect(await systemStateOf(prisma, coreId)).toMatchObject({
        healthIssues: []
      });
    });

    it('[MON-173] should keep the CPU streak between checks', async () => {
      serve(AT, { 'cpu-load': '96' });
      await check(AT);
      expect(await systemStateOf(prisma, coreId)).toMatchObject({
        highCpuChecks: 1,
        healthIssues: []
      });
      serve(LATER, { 'cpu-load': '96' });
      await check(LATER);

      expect(await systemStateOf(prisma, coreId)).toMatchObject({
        highCpuChecks: 2,
        healthIssues: ['CPU']
      });
      expect(publisher.sent).toHaveLength(1);
    });

    it('[MON-172] should judge against the thresholds saved for the install', async () => {
      await prisma.routerHealthThresholds.create({
        data: {
          cpuPercent: 90,
          minFreeMemoryPercent: 10,
          minFreeDiskPercent: 5,
          maxTemperatureC: 75,
          minVoltage: 24.5
        }
      });
      serve(AT);

      const result = await check(AT);

      expect(result.value.healthRaised).toBe(1);
      expect(publisher.sent[0]).toMatchObject({
        summary: 'Voltaje de 24,1 V en "Core" (menos de 24,5 V)'
      });
    });
  });
});
