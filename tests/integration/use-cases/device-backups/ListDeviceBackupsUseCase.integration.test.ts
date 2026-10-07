// Source: src/application/device-backups/use-cases/ListDeviceBackupsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { seedDiagnosableDevice } from '../../helpers/linkDiagnosis';
import { FakeConfigFetcher } from '../../helpers/FakeConfigFetcher';
import { buildDeviceBackups } from '../../helpers/deviceBackups';

describe('ListDeviceBackupsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  let now: Date;
  const fetcher = new FakeConfigFetcher();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    fetcher.reset();
    await cleanDatabase(prisma);
    modelId = await seedWirelessDeviceModel(prisma);
  });

  const stack = () =>
    buildDeviceBackups(prisma, fetcher, { clock: () => now });

  const seedAp = () =>
    seedDiagnosableDevice(prisma, modelId, {
      ip: '10.0.0.10',
      deviceType: 'ACCESS_POINT'
    });

  it('[BKP-042] should list versions newest first, without the file', async () => {
    const deviceId = await seedAp();
    now = new Date('2026-10-07T08:00:00Z');
    await stack().backUpNow.execute({ deviceId });
    fetcher.serve('aaa.1.status=disabled\n');
    now = new Date('2026-10-08T08:00:00Z');
    await stack().backUpNow.execute({ deviceId });

    const result = await stack().list.execute({ deviceId });

    expect(result.value.backups.map((b) => b.takenAt)).toEqual([
      '2026-10-08T08:00:00.000Z',
      '2026-10-07T08:00:00.000Z'
    ]);
    expect(JSON.stringify(result.value)).not.toContain(
      'aaa.1.status'
    );
    expect(result.value.state).toMatchObject({
      lastOutcome: 'SAVED',
      lastSuccessAt: '2026-10-08T08:00:00.000Z',
      consecutiveFailures: 0
    });
  });

  it('[BKP-020] should show a device that keeps failing', async () => {
    const deviceId = await seedAp();
    fetcher.fail('Authentication failed: HTTP 401');
    now = new Date('2026-10-07T08:00:00Z');
    await stack().backUpNow.execute({ deviceId });
    now = new Date('2026-10-08T08:00:00Z');
    await stack().backUpNow.execute({ deviceId });

    const result = await stack().list.execute({ deviceId });

    expect(result.value.backups).toEqual([]);
    expect(result.value.state).toMatchObject({
      lastOutcome: 'FAILED',
      lastError: 'Authentication failed: HTTP 401',
      failingSince: '2026-10-07T08:00:00.000Z',
      consecutiveFailures: 2,
      lastSuccessAt: null
    });
  });

  it('should answer an empty list for a device never backed up', async () => {
    const deviceId = await seedAp();

    const result = await stack().list.execute({ deviceId });

    expect(result.value).toEqual({
      deviceId,
      state: null,
      backups: []
    });
  });

  it('should fail for an unknown device', async () => {
    const result = await stack().list.execute({ deviceId: GHOST_ID });

    expect(result.error).toBe('Device not found');
  });

  it('should fail for a malformed id', async () => {
    const result = await stack().list.execute({
      deviceId: INVALID_ID
    });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
