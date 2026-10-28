// Source: src/application/device-monitoring/use-cases/CheckPortSpeedsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from '../../../../src/domain/shared/core';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { PORT_SPEED_LOW_ALERT_TYPE } from '../../../../src/application/device-monitoring/use-cases';
import { QUIET_HOURS_SUPPRESSED } from '../../../../src/application/shared/interfaces';
import { cleanDatabase } from '../../helpers/db';
import {
  FakeRouterPortReader,
  linkedPort,
  unlinkedPort
} from '../../helpers/FakeRouterPortReader';
import { FakeAlertPublisher } from '../../helpers/FakeAlertPublisher';
import { RouterPortConnection } from '../../../../src/application/device-monitoring/interfaces';
import {
  buildPortSpeeds,
  checkStateOf,
  expectedSpeedsOf,
  seedExpectedSpeed,
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

const T1 = new Date('2026-10-28T15:00:00Z');
const T2 = new Date('2026-10-28T15:10:00Z');
const T3 = new Date('2026-10-28T15:20:00Z');

describe('CheckPortSpeedsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  let coreId: string;
  const reader = new FakeRouterPortReader();
  const publisher = new FakeAlertPublisher();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    reader.reset();
    publisher.reset();
    await cleanDatabase(prisma);
    modelId = await seedMikrotikModel(prisma);
    coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
  });

  const check = (now: Date) =>
    buildPortSpeeds(prisma, reader, { publisher }).check.execute({
      now
    });

  it('[MON-147] should alert on the second slow check and keep that in the database', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [
      linkedPort('ether1', 100, 'Torre norte')
    ]);

    await check(T1);
    expect(await checkStateOf(prisma, coreId, 'ether1')).toEqual({
      slowChecks: 1,
      alertedAt: null
    });
    expect(publisher.sent).toHaveLength(0);

    const result = await check(T2);

    expect(result.value.raised).toBe(1);
    expect(await checkStateOf(prisma, coreId, 'ether1')).toEqual({
      slowChecks: 2,
      alertedAt: T2
    });
    expect(publisher.sent).toEqual([
      expect.objectContaining({
        deviceId: coreId,
        type: PORT_SPEED_LOW_ALERT_TYPE,
        resolved: false,
        summary:
          'El puerto ether1 (Torre norte) de "Core" está a 100 Mbps, debería estar a 1 Gbps'
      })
    ]);
  });

  it('[MON-147] should not alert again after a restart while the port stays slow', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 100)]);
    await check(T1);
    await check(T2);
    publisher.reset();

    // a fresh use case, as after a restart: only the database remembers
    await check(T3);

    expect(publisher.sent).toHaveLength(0);
  });

  it('[MON-147] should send a recovery and clear the state once the port is back', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 100)]);
    await check(T1);
    await check(T2);
    publisher.reset();
    reader.serve('10.0.0.1', [linkedPort('ether1', 1000)]);

    const result = await check(T3);

    expect(result.value.recovered).toBe(1);
    expect(publisher.sent).toEqual([
      expect.objectContaining({
        resolved: true,
        summary: 'El puerto ether1 de "Core" volvió a 1 Gbps'
      })
    ]);
    expect(await checkStateOf(prisma, coreId, 'ether1')).toEqual({
      slowChecks: 0,
      alertedAt: null
    });
  });

  it('[MON-147] should recover when the operator lowers the expected speed', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 100)]);
    await check(T1);
    await check(T2);
    publisher.reset();
    await buildPortSpeeds(prisma, reader).setExpected.execute({
      deviceId: coreId,
      portName: 'ether1',
      expectedMbps: 100
    });

    await check(T3);

    expect(publisher.sent.map((n) => n.resolved)).toEqual([true]);
  });

  it('[MON-147] should leave a port without a link alone', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [unlinkedPort('ether1')]);

    await check(T1);
    await check(T2);

    expect(publisher.sent).toHaveLength(0);
    expect(await checkStateOf(prisma, coreId, 'ether1')).toEqual({
      slowChecks: 0,
      alertedAt: null
    });
  });

  it('[MON-149] should alert on a lost link for a port set to, and recover when it is back', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000, true);
    reader.serve('10.0.0.1', [unlinkedPort('ether1')]);

    await check(T1);
    await check(T2);
    expect(publisher.sent).toEqual([
      expect.objectContaining({
        resolved: false,
        summary:
          'El puerto ether1 de "Core" está sin enlace, debería estar a 1 Gbps'
      })
    ]);
    expect(await checkStateOf(prisma, coreId, 'ether1')).toEqual({
      slowChecks: 2,
      alertedAt: T2
    });

    reader.serve('10.0.0.1', [linkedPort('ether1', 1000)]);
    await check(T3);

    expect(publisher.sent[1]).toMatchObject({
      resolved: true,
      summary: 'El puerto ether1 de "Core" volvió a 1 Gbps'
    });
  });

  it('[MON-147] should keep the state of a router that does not answer', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 100)]);
    await check(T1);
    reader.answer('10.0.0.1', Result.fail('timed out'));

    const result = await check(T2);

    expect(result.value.skipped).toEqual([
      { deviceId: coreId, name: 'Core', why: 'timed out' }
    ]);
    expect(await checkStateOf(prisma, coreId, 'ether1')).toEqual({
      slowChecks: 1,
      alertedAt: null
    });
  });

  it('[MON-147] should only read routers that have an expected speed', async () => {
    await seedRouter(prisma, {
      name: 'Edge',
      deviceModelId: modelId,
      ip: '10.0.0.2'
    });
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 1000)]);

    const result = await check(T1);

    expect(reader.reads.map((r) => r.host)).toEqual(['10.0.0.1']);
    expect(result.value.routersChecked).toBe(1);
  });

  it('[MON-147] should not check a router out of service', async () => {
    const storeId = await seedRouter(prisma, {
      name: 'Bodega',
      deviceModelId: modelId,
      ip: '10.0.0.3',
      status: 'INVENTORY'
    });
    await seedExpectedSpeed(prisma, storeId, 'ether1', 1000);

    const result = await check(T1);

    expect(reader.reads).toHaveLength(0);
    expect(result.value.routersChecked).toBe(0);
  });

  it('[MON-148] should send one notice per router however many ports went slow', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    await seedExpectedSpeed(prisma, coreId, 'ether2', 1000);
    reader.serve('10.0.0.1', [
      linkedPort('ether1', 100),
      linkedPort('ether2', 10)
    ]);

    await check(T1);
    await check(T2);

    expect(publisher.sent).toHaveLength(1);
    expect(publisher.sent[0].summary).toBe(
      '2 puertos de "Core" están más lentos de lo que deberían'
    );
  });

  it('[MON-148] should not retry a notice held back by quiet hours', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 100)]);
    publisher.answerWith(Result.fail(QUIET_HOURS_SUPPRESSED));

    await check(T1);
    await check(T2);
    await check(T3);

    expect(publisher.sent).toHaveLength(1);
    expect(
      (await checkStateOf(prisma, coreId, 'ether1')).alertedAt
    ).toEqual(T2);
  });

  it('[MON-147] should keep a speed the operator saved while the check ran', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 100)]);
    const midCheck = new (class extends FakeRouterPortReader {
      async read(connection: RouterPortConnection) {
        await buildPortSpeeds(prisma, reader).setExpected.execute({
          deviceId: coreId,
          portName: 'ether1',
          expectedMbps: 100
        });
        return reader.read(connection);
      }
    })();

    await buildPortSpeeds(prisma, midCheck, {
      publisher
    }).check.execute({ now: T1 });

    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({
      ether1: 100
    });
  });

  it('[MON-147] should drop the state with the expected speed', async () => {
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    reader.serve('10.0.0.1', [linkedPort('ether1', 100)]);
    await check(T1);
    await check(T2);
    await buildPortSpeeds(prisma, reader).setExpected.execute({
      deviceId: coreId,
      portName: 'ether1',
      expectedMbps: null
    });
    publisher.reset();

    await check(T3);

    expect(publisher.sent).toHaveLength(0);
    expect(await expectedSpeedsOf(prisma, coreId)).toEqual({});
  });
});
