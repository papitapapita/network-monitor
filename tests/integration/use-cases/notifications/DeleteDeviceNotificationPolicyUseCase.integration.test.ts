// Source: src/application/notifications/use-cases/DeleteDeviceNotificationPolicyUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { DeleteDeviceNotificationPolicyUseCase } from 'application/notifications/use-cases/DeleteDeviceNotificationPolicyUseCase';
import { PrismaDeviceNotificationPolicyRepository } from 'infrastructure/persistence/PrismaDeviceNotificationPolicyRepository';
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

describe('DeleteDeviceNotificationPolicyUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: DeleteDeviceNotificationPolicyUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new DeleteDeviceNotificationPolicyUseCase(
      new PrismaDeviceNotificationPolicyRepository(prisma),
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

  it('[NOT-170] deletes an existing policy row', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);
    await prisma.deviceNotificationPolicy.create({
      data: {
        deviceId,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        alertDelayMinutes: null,
        updatedAt: new Date()
      }
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.deviceNotificationPolicy.findUnique({
      where: { deviceId }
    });
    expect(row).toBeNull();
  });

  it('is idempotent when the device never had a policy row', async () => {
    const deviceId = await seedDevice(prisma, deviceModelId);

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
  });

  it('succeeds even for a device id that does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.isSuccess).toBe(true);
  });

  it('fails when deviceId is not a valid UUID', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });
});
