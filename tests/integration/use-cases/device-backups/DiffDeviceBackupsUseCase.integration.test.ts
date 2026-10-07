// Source: src/application/device-backups/use-cases/DiffDeviceBackupsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { MASKED_SECRET } from 'domain/device-backups';
import {
  cleanDatabase,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { seedDiagnosableDevice } from '../../helpers/linkDiagnosis';
import {
  FakeConfigFetcher,
  FAKE_AIROS_CONFIG
} from '../../helpers/FakeConfigFetcher';
import { buildDeviceBackups } from '../../helpers/deviceBackups';

const CHANGED_CONFIG = FAKE_AIROS_CONFIG.replace(
  'radio.1.mode=master',
  'radio.1.mode=managed'
).replace('$1$secret', '$1$other');

describe('DiffDeviceBackupsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  let clock: Date;
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
    clock = new Date('2026-10-07T08:05:00Z');
  });

  const stack = () =>
    buildDeviceBackups(prisma, fetcher, { clock: () => clock });

  const seedAp = (ip = '10.0.0.10') =>
    seedDiagnosableDevice(prisma, modelId, {
      ip,
      deviceType: 'ACCESS_POINT'
    });

  const backUp = async (deviceId: string, content: string) => {
    fetcher.serve(content);
    const saved = await stack().backUpNow.execute({ deviceId });
    clock = new Date(clock.getTime() + 24 * 60 * 60 * 1000);
    return saved.value.backup.id;
  };

  it('[BKP-070] should show what changed between two stored versions', async () => {
    const deviceId = await seedAp();
    const from = await backUp(deviceId, FAKE_AIROS_CONFIG);
    const to = await backUp(deviceId, CHANGED_CONFIG);

    const result = await stack().diff.execute({
      deviceId,
      fromBackupId: from,
      toBackupId: to
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.from.id).toBe(from);
    expect(result.value.to.id).toBe(to);
    expect(result.value.identical).toBe(false);
    expect(result.value.added).toBe(2);
    expect(result.value.removed).toBe(2);
    expect(result.value.hunks[0].lines).toEqual([
      { kind: 'context', text: 'aaa.1.status=enabled' },
      { kind: 'removed', text: 'radio.1.mode=master' },
      { kind: 'removed', text: `users.1.password=${MASKED_SECRET}` },
      { kind: 'added', text: 'radio.1.mode=managed' },
      { kind: 'added', text: `users.1.password=${MASKED_SECRET}` }
    ]);
  });

  it('[BKP-071] should decrypt the files but return no secret', async () => {
    const deviceId = await seedAp();
    const from = await backUp(deviceId, FAKE_AIROS_CONFIG);
    const to = await backUp(deviceId, CHANGED_CONFIG);

    const result = await stack().diff.execute({
      deviceId,
      fromBackupId: from,
      toBackupId: to
    });

    const body = JSON.stringify(result.value);
    expect(body).not.toContain('$1$secret');
    expect(body).not.toContain('$1$other');
  });

  it('[BKP-070] should compare in either direction', async () => {
    const deviceId = await seedAp();
    const older = await backUp(deviceId, FAKE_AIROS_CONFIG);
    const newer = await backUp(deviceId, CHANGED_CONFIG);

    const result = await stack().diff.execute({
      deviceId,
      fromBackupId: newer,
      toBackupId: older
    });

    expect(result.value.hunks[0].lines[1]).toEqual({
      kind: 'removed',
      text: 'radio.1.mode=managed'
    });
  });

  it('[BKP-070] should find a version identical to itself', async () => {
    const deviceId = await seedAp();
    const only = await backUp(deviceId, FAKE_AIROS_CONFIG);

    const result = await stack().diff.execute({
      deviceId,
      fromBackupId: only,
      toBackupId: only
    });

    expect(result.value.identical).toBe(true);
    expect(result.value.hunks).toEqual([]);
  });

  it('should not compare a backup of another device', async () => {
    const deviceId = await seedAp('10.0.0.10');
    const otherId = await seedAp('10.0.0.11');
    const mine = await backUp(deviceId, FAKE_AIROS_CONFIG);
    const theirs = await backUp(otherId, CHANGED_CONFIG);

    const result = await stack().diff.execute({
      deviceId,
      fromBackupId: mine,
      toBackupId: theirs
    });

    expect(result.error).toBe('Backup not found');
  });

  it('should fail for an unknown backup', async () => {
    const deviceId = await seedAp();
    const from = await backUp(deviceId, FAKE_AIROS_CONFIG);

    const result = await stack().diff.execute({
      deviceId,
      fromBackupId: from,
      toBackupId: GHOST_ID
    });

    expect(result.error).toBe('Backup not found');
  });

  it('should fail for an unknown device', async () => {
    const result = await stack().diff.execute({
      deviceId: GHOST_ID,
      fromBackupId: GHOST_ID,
      toBackupId: GHOST_ID
    });

    expect(result.error).toBe('Device not found');
  });

  it('should fail for a malformed backup id', async () => {
    const deviceId = await seedAp();

    const result = await stack().diff.execute({
      deviceId,
      fromBackupId: INVALID_ID,
      toBackupId: GHOST_ID
    });

    expect(result.error).toMatch(/^Invalid backup ID/);
  });
});
