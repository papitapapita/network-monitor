// Source: src/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpsertDeviceNotificationPolicyUseCase } from 'application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase';
import { PrismaDeviceNotificationPolicyRepository } from 'infrastructure/persistence/PrismaDeviceNotificationPolicyRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedDevice,
  GHOST_ID
} from '../../helpers/db';

describe('UpsertDeviceNotificationPolicyUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpsertDeviceNotificationPolicyUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new UpsertDeviceNotificationPolicyUseCase(
      new PrismaDeviceNotificationPolicyRepository(prisma),
      new PrismaDeviceRepository(prisma),
      new WinstonLogger()
    );
    deviceModelId = await seedDeviceModel(prisma);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('creates a policy row when none exists yet', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);

    const result = await useCase.execute({
      deviceId,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: 10
    });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.deviceNotificationPolicy.findUnique({
      where: { deviceId }
    });
    expect(row).not.toBeNull();
    expect(row!.quietHoursStart).toBe('22:00');
    expect(row!.alertDelayMinutes).toBe(10);
  });

  it('updates the existing row in place rather than creating a second one', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);
    await useCase.execute({
      deviceId,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: null
    });

    await useCase.execute({
      deviceId,
      quietHoursStart: '20:00',
      quietHoursEnd: '06:00',
      alertDelayMinutes: 5
    });

    const rows = await prisma.deviceNotificationPolicy.findMany({
      where: { deviceId }
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].quietHoursStart).toBe('20:00');
    expect(rows[0].alertDelayMinutes).toBe(5);
  });

  it('[NOT-170] clears the window back to null on request', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);
    await useCase.execute({
      deviceId,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: null
    });

    const result = await useCase.execute({
      deviceId,
      quietHoursStart: null,
      quietHoursEnd: null,
      alertDelayMinutes: null
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.quietHoursStart).toBeNull();
    expect(result.value.quietHoursEnd).toBeNull();
  });

  it('fails with a not-found error when the device does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({
      deviceId: GHOST_ID,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: null
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('[NOT-171] fails when quietHoursStart is set without quietHoursEnd', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);

    const result = await useCase.execute({
      deviceId,
      quietHoursStart: '22:00',
      quietHoursEnd: null,
      alertDelayMinutes: null
    });

    expect(result.isFailure).toBe(true);
  });

  it('[NOT-173] fails for a negative alert delay override', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);

    const result = await useCase.execute({
      deviceId,
      quietHoursStart: null,
      quietHoursEnd: null,
      alertDelayMinutes: -1
    });

    expect(result.isFailure).toBe(true);
  });
});
