// Source: src/application/device-backups/use-cases/DownloadDeviceBackupUseCase.ts

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
import {
  FakeConfigFetcher,
  FAKE_AIROS_CONFIG
} from '../../helpers/FakeConfigFetcher';
import {
  buildDeviceBackups,
  FAKE_ROUTEROS_EXPORT,
  seedRouter
} from '../../helpers/deviceBackups';
import { BackupFormat } from 'domain/device-backups';

describe('DownloadDeviceBackupUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  const now = new Date('2026-10-07T08:05:00Z');
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

  const seedBackedUpAp = async (ip: string, name?: string) => {
    const deviceId = await seedDiagnosableDevice(prisma, modelId, {
      ip,
      deviceType: 'ACCESS_POINT'
    });
    if (name)
      await prisma.device.update({
        where: { id: deviceId },
        data: { name }
      });
    const saved = await stack().backUpNow.execute({ deviceId });
    return { deviceId, backupId: saved.value.backup.id };
  };

  it('[BKP-008] should return exactly the file the device sent', async () => {
    const { deviceId, backupId } = await seedBackedUpAp(
      '10.0.0.10',
      'AP Torre Norte (sector 2)'
    );

    const result = await stack().download.execute({
      deviceId,
      backupId
    });

    expect(result.value).toEqual({
      fileName: 'AP-Torre-Norte-sector-2-20261007-0805Z.cfg',
      contentType: 'text/plain; charset=utf-8',
      content: FAKE_AIROS_CONFIG
    });
  });

  it('[BKP-054] should name a RouterOS export as a script /import takes', async () => {
    const deviceId = await seedRouter(prisma, { ip: '10.0.0.1' });
    fetcher.serve(FAKE_ROUTEROS_EXPORT, BackupFormat.ROUTEROS_EXPORT);
    const saved = await stack().backUpNow.execute({ deviceId });

    const result = await stack().download.execute({
      deviceId,
      backupId: saved.value.backup.id
    });

    expect(result.value).toEqual({
      fileName: 'Router-10-0-0-1-20261007-0805Z.rsc',
      contentType: 'text/plain; charset=utf-8',
      content: FAKE_ROUTEROS_EXPORT
    });
  });

  it('should not serve one device’s backup under another device', async () => {
    const first = await seedBackedUpAp('10.0.0.10');
    const second = await seedBackedUpAp('10.0.0.11');

    const result = await stack().download.execute({
      deviceId: second.deviceId,
      backupId: first.backupId
    });

    expect(result.error).toBe('Backup not found');
  });

  it('[BKP-031] should lose the backups with the device', async () => {
    const { deviceId } = await seedBackedUpAp('10.0.0.10');

    await prisma.device.delete({ where: { id: deviceId } });

    expect(await prisma.configBackup.count()).toBe(0);
    expect(await prisma.deviceBackupState.count()).toBe(0);
  });

  it('should fail for an unknown backup', async () => {
    const { deviceId } = await seedBackedUpAp('10.0.0.10');

    const result = await stack().download.execute({
      deviceId,
      backupId: GHOST_ID
    });

    expect(result.error).toBe('Backup not found');
  });

  it('should fail for an unknown device', async () => {
    const { backupId } = await seedBackedUpAp('10.0.0.10');

    const result = await stack().download.execute({
      deviceId: GHOST_ID,
      backupId
    });

    expect(result.error).toBe('Device not found');
  });

  it('should fail for a malformed backup id', async () => {
    const { deviceId } = await seedBackedUpAp('10.0.0.10');

    const result = await stack().download.execute({
      deviceId,
      backupId: INVALID_ID
    });

    expect(result.error).toMatch(/^Invalid backup ID/);
  });
});
