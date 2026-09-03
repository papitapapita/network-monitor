// Source: src/application/notifications/use-cases/BulkUpsertDeviceNotificationPoliciesUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { BulkUpsertDeviceNotificationPoliciesUseCase } from 'application/notifications/use-cases/BulkUpsertDeviceNotificationPoliciesUseCase';
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

describe('BulkUpsertDeviceNotificationPoliciesUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: BulkUpsertDeviceNotificationPoliciesUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    const policyRepo = new PrismaDeviceNotificationPolicyRepository(
      prisma
    );
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    const upsert = new UpsertDeviceNotificationPolicyUseCase(
      policyRepo,
      deviceRepo,
      logger
    );
    useCase = new BulkUpsertDeviceNotificationPoliciesUseCase(
      upsert,
      logger
    );
    deviceModelId = await seedDeviceModel(prisma);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('[NOT-176] applies the same window to every device in the list', async () => {
    const deviceIdA = await seedDevice(prisma, deviceModelId, {
      serialNumber: 'SN-BULK-INT-A'
    });
    const deviceIdB = await seedDevice(prisma, deviceModelId, {
      serialNumber: 'SN-BULK-INT-B'
    });

    const result = await useCase.execute({
      deviceIds: [deviceIdA, deviceIdB],
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: null
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.updated).toHaveLength(2);
    expect(result.value.failed).toHaveLength(0);

    const rows = await prisma.deviceNotificationPolicy.findMany({
      where: { deviceId: { in: [deviceIdA, deviceIdB] } }
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.quietHoursStart === '22:00')).toBe(
      true
    );
  });

  it('[NOT-176] buckets a nonexistent device under failed without aborting the rest', async () => {
    const deviceIdA = await seedDevice(prisma, deviceModelId, {
      serialNumber: 'SN-BULK-INT-C'
    });

    const result = await useCase.execute({
      deviceIds: [deviceIdA, GHOST_ID],
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: null
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.updated).toHaveLength(1);
    expect(result.value.failed).toEqual([
      { id: GHOST_ID, error: expect.stringMatching(/not found/i) }
    ]);
  });

  it('fails validation before touching the database when deviceIds is empty', async () => {
    const result = await useCase.execute({
      deviceIds: [],
      quietHoursStart: null,
      quietHoursEnd: null,
      alertDelayMinutes: null
    });

    expect(result.isFailure).toBe(true);
  });
});
