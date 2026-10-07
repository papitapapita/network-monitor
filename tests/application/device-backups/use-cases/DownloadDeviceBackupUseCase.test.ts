// Source: src/application/device-backups/use-cases/DownloadDeviceBackupUseCase.ts

import { Result } from '../../../../src/domain/shared/core/Result';
import { DownloadDeviceBackupUseCase } from '../../../../src/application/device-backups/use-cases';
import {
  BackupFormat,
  BackupTrigger,
  ConfigBackup
} from '../../../../src/domain/device-backups';
import { DeviceId } from '../../../../src/domain/shared/ids';
import {
  AIROS_CONFIG,
  InMemoryConfigBackupRepository,
  makeCandidate,
  makeLogger
} from '../inMemoryBackups';

describe('DownloadDeviceBackupUseCase', () => {
  it('[BKP-043] should never write the file to the log', async () => {
    const candidate = makeCandidate();
    const backups = new InMemoryConfigBackupRepository();
    const backup = ConfigBackup.create({
      deviceId: DeviceId.parse(candidate.deviceId).value,
      format: BackupFormat.AIROS_CFG,
      contentHash: 'a'.repeat(64),
      sizeBytes: 10,
      trigger: BackupTrigger.MANUAL,
      takenAt: new Date('2026-10-07T08:00:00Z')
    }).value;
    await backups.add(backup, AIROS_CONFIG);
    const logger = makeLogger();
    const useCase = new DownloadDeviceBackupUseCase(
      {
        listScheduled: async () => Result.ok([]),
        findByDevice: async () => Result.ok(candidate)
      },
      backups,
      logger
    );

    const result = await useCase.execute({
      deviceId: candidate.deviceId,
      backupId: backup.id.toString()
    });

    expect(result.value.content).toBe(AIROS_CONFIG);
    const logged = JSON.stringify([
      ...logger.info.mock.calls,
      ...logger.debug.mock.calls
    ]);
    expect(logged).not.toContain('radio.1.mode');
    expect(logged).toContain('[redacted]');
  });
});
