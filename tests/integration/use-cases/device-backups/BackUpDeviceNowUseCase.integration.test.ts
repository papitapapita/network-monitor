// Source: src/application/device-backups/use-cases/BackUpDeviceNowUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { BACKUP_REFUSALS } from 'application/device-backups';
import { CredentialsEncryption } from 'infrastructure/crypto';
import {
  cleanDatabase,
  seedDeviceModel,
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

// Covers a backup taken on request against the real tables: the file is
// stored encrypted, a repeat keeps one version, and every attempt — refused,
// failed or saved — lands in the device's backup state.
describe('BackUpDeviceNowUseCase — integration', () => {
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
    now = new Date('2026-10-07T08:00:00Z');
    await cleanDatabase(prisma);
    modelId = await seedWirelessDeviceModel(prisma);
  });

  const build = (serverOnSite = true) =>
    buildDeviceBackups(prisma, fetcher, {
      serverOnSite,
      clock: () => now
    }).backUpNow;

  const seedAp = (opts: { withCredentials?: boolean } = {}) =>
    seedDiagnosableDevice(prisma, modelId, {
      ip: '10.0.0.10',
      deviceType: 'ACCESS_POINT',
      ...opts
    });

  it('[BKP-001] [BKP-040] should save the file encrypted', async () => {
    const deviceId = await seedAp();

    const result = await build().execute({ deviceId });

    expect(result.value.outcome).toBe('SAVED');
    expect(result.value.backup).toMatchObject({
      deviceId,
      format: 'AIROS_CFG',
      trigger: 'MANUAL',
      sizeBytes: Buffer.byteLength(FAKE_AIROS_CONFIG)
    });
    const row = await prisma.configBackup.findFirstOrThrow({
      where: { deviceId }
    });
    expect(row.encryptedContent).not.toContain('radio.1.mode');
    expect(CredentialsEncryption.decrypt(row.encryptedContent)).toBe(
      FAKE_AIROS_CONFIG
    );
    expect(fetcher.calls).toEqual([
      { ipAddress: '10.0.0.10', username: 'ubnt' }
    ]);
  });

  it('[BKP-006] should keep one version when the device still holds it', async () => {
    const deviceId = await seedAp();
    await build().execute({ deviceId });
    now = new Date('2026-10-08T08:00:00Z');

    const result = await build().execute({ deviceId });

    expect(result.value.outcome).toBe('UNCHANGED');
    const rows = await prisma.configBackup.findMany({
      where: { deviceId }
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].lastCheckedAt).toEqual(now);
    expect(rows[0].takenAt).toEqual(new Date('2026-10-07T08:00:00Z'));
  });

  it('[BKP-020] should record a device failure in the backup state', async () => {
    const deviceId = await seedAp();
    fetcher.fail('HTTPS_TIMEOUT (10.0.0.10:443)');

    const result = await build().execute({ deviceId });

    expect(result.error).toBe(
      'Backup failed: HTTPS_TIMEOUT (10.0.0.10:443)'
    );
    const state = await prisma.deviceBackupState.findUniqueOrThrow({
      where: { deviceId }
    });
    expect(state).toMatchObject({
      lastOutcome: 'FAILED',
      lastError: 'HTTPS_TIMEOUT (10.0.0.10:443)',
      consecutiveFailures: 1,
      failingSince: now
    });
  });

  it('[BKP-014] should refuse an access point with no credentials', async () => {
    const deviceId = await seedAp({ withCredentials: false });

    const result = await build().execute({ deviceId });

    expect(result.error).toBe(
      `Cannot back up this device: ${BACKUP_REFUSALS.NO_CREDENTIALS}`
    );
    expect(fetcher.calls).toHaveLength(0);
  });

  it('[BKP-014] should refuse a station', async () => {
    const deviceId = await seedDiagnosableDevice(prisma, modelId, {
      ip: '10.0.0.20',
      deviceType: 'STATION'
    });

    const result = await build().execute({ deviceId });

    expect(result.error).toBe(
      `Cannot back up this device: ${BACKUP_REFUSALS.NOT_ACCESS_POINT}`
    );
  });

  it('[BKP-014] should refuse a vendor with no fetcher', async () => {
    const routerId = (
      await prisma.device.create({
        data: {
          name: 'Router',
          status: 'ACTIVE',
          ipAddress: '10.0.0.1',
          deviceModelId: await seedDeviceModel(prisma)
        }
      })
    ).id;
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId: routerId,
        ipAddress: '10.0.0.1',
        deviceType: 'ACCESS_POINT'
      }
    });
    await prisma.deviceCredentials.create({
      data: {
        deviceId: routerId,
        httpUsername: 'admin',
        httpPassword: CredentialsEncryption.encrypt('x')
      }
    });

    const result = await build().execute({ deviceId: routerId });

    expect(result.error).toBe(
      `Cannot back up this device: ${BACKUP_REFUSALS.UNSUPPORTED_VENDOR}`
    );
  });

  it('[BKP-015] should refuse when this server is off site', async () => {
    const deviceId = await seedAp();

    const result = await build(false).execute({ deviceId });

    expect(result.error).toBe(
      `Cannot back up this device: ${BACKUP_REFUSALS.OUT_OF_REACH}`
    );
  });

  it('should fail for a deleted device', async () => {
    const deviceId = await seedAp();
    await prisma.device.update({
      where: { id: deviceId },
      data: { deletedAt: new Date() }
    });

    const result = await build().execute({ deviceId });

    expect(result.error).toBe('Device not found');
  });

  it('should fail for an unknown device', async () => {
    const result = await build().execute({ deviceId: GHOST_ID });

    expect(result.error).toBe('Device not found');
  });

  it('should fail for a malformed id', async () => {
    const result = await build().execute({ deviceId: INVALID_ID });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
