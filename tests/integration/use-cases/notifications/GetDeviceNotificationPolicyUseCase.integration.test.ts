// Source: src/application/notifications/use-cases/GetDeviceNotificationPolicyUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetDeviceNotificationPolicyUseCase } from 'application/notifications/use-cases/GetDeviceNotificationPolicyUseCase';
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
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetDeviceNotificationPolicyUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetDeviceNotificationPolicyUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new GetDeviceNotificationPolicyUseCase(
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

  it('[NOT-170] returns always-notify defaults when no policy row exists', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      deviceId,
      quietHoursStart: null,
      quietHoursEnd: null,
      alertDelayMinutes: null,
      updatedAt: null
    });
  });

  it('returns the persisted policy once one has been saved', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);
    await prisma.deviceNotificationPolicy.create({
      data: {
        deviceId,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        alertDelayMinutes: 15,
        updatedAt: new Date()
      }
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.quietHoursStart).toBe('22:00');
    expect(result.value.quietHoursEnd).toBe('07:00');
    expect(result.value.alertDelayMinutes).toBe(15);
  });

  it('fails with a not-found error when the device does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails when deviceId is empty', async () => {
    const result = await useCase.execute({ deviceId: '' });

    expect(result.isFailure).toBe(true);
  });

  it('fails when deviceId is not a valid UUID', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });
});
