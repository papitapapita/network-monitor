// Source: src/application/device-backups/use-cases/DiffDeviceBackupsUseCase.ts

import { Result } from '../../../../src/domain/shared/core/Result';
import {
  BACKUP_DIFF_FORMAT_MISMATCH,
  DiffDeviceBackupsUseCase
} from '../../../../src/application/device-backups/use-cases';
import {
  BackupFormat,
  BackupTrigger,
  ConfigBackup,
  MASKED_SECRET
} from '../../../../src/domain/device-backups';
import {
  ConfigBackupId,
  DeviceId
} from '../../../../src/domain/shared/ids';
import {
  InMemoryConfigBackupRepository,
  makeCandidate,
  makeLogger
} from '../inMemoryBackups';

const OLD = 'radio.1.mode=master\r\nusers.1.password=old-secret\r\n';
const NEW = 'radio.1.mode=master\nusers.1.password=new-secret\n';

describe('DiffDeviceBackupsUseCase', () => {
  const candidate = makeCandidate();
  let backups: InMemoryConfigBackupRepository;
  let logger: ReturnType<typeof makeLogger>;
  let useCase: DiffDeviceBackupsUseCase;

  const store = async (content: string, takenAt: string) => {
    const backup = ConfigBackup.create({
      deviceId: DeviceId.parse(candidate.deviceId).value,
      format: BackupFormat.AIROS_CFG,
      contentHash: 'a'.repeat(64),
      sizeBytes: content.length,
      trigger: BackupTrigger.SCHEDULED,
      takenAt: new Date(takenAt)
    }).value;
    await backups.add(backup, content);
    return backup.id.toString();
  };

  beforeEach(() => {
    backups = new InMemoryConfigBackupRepository();
    logger = makeLogger();
    useCase = new DiffDeviceBackupsUseCase(
      {
        listScheduled: async () => Result.ok([]),
        findByDevice: async () => Result.ok(candidate)
      },
      backups,
      logger
    );
  });

  it('[BKP-071] should show a changed password as changed, without its values', async () => {
    const from = await store(OLD, '2026-10-07T08:00:00Z');
    const to = await store(NEW, '2026-10-08T08:00:00Z');

    const result = await useCase.execute({
      deviceId: candidate.deviceId,
      fromBackupId: from,
      toBackupId: to
    });

    expect(result.value.identical).toBe(false);
    expect(result.value.hunks[0].lines).toEqual([
      { kind: 'context', text: 'radio.1.mode=master' },
      { kind: 'removed', text: `users.1.password=${MASKED_SECRET}` },
      { kind: 'added', text: `users.1.password=${MASKED_SECRET}` }
    ]);
    expect(JSON.stringify(result.value)).not.toContain('secret');
  });

  it('[BKP-070] should compare the normalized text, not line endings', async () => {
    const from = await store(OLD, '2026-10-07T08:00:00Z');
    const to = await store(
      OLD.replace(/\r/g, ''),
      '2026-10-08T08:00:00Z'
    );

    const result = await useCase.execute({
      deviceId: candidate.deviceId,
      fromBackupId: from,
      toBackupId: to
    });

    expect(result.value.identical).toBe(true);
    expect(result.value.hunks).toEqual([]);
  });

  it('[BKP-043] should never write configuration lines to the log', async () => {
    const from = await store(OLD, '2026-10-07T08:00:00Z');
    const to = await store(NEW, '2026-10-08T08:00:00Z');

    await useCase.execute({
      deviceId: candidate.deviceId,
      fromBackupId: from,
      toBackupId: to
    });

    const logged = JSON.stringify([
      ...logger.info.mock.calls,
      ...logger.debug.mock.calls
    ]);
    expect(logged).not.toContain('radio.1.mode');
    expect(logged).toContain('[redacted]');
  });

  it('should refuse to compare two backups of different formats', async () => {
    const from = await store(OLD, '2026-10-07T08:00:00Z');
    const takenAt = new Date('2026-10-08T08:00:00Z');
    const other = ConfigBackup.reconstitute(ConfigBackupId.create(), {
      deviceId: DeviceId.parse(candidate.deviceId).value,
      format: 'OTHER_FORMAT' as BackupFormat,
      contentHash: 'b'.repeat(64),
      sizeBytes: NEW.length,
      trigger: BackupTrigger.SCHEDULED,
      takenAt,
      lastCheckedAt: takenAt
    });
    await backups.add(other, NEW);

    const result = await useCase.execute({
      deviceId: candidate.deviceId,
      fromBackupId: from,
      toBackupId: other.id.toString()
    });

    expect(result.error).toBe(BACKUP_DIFF_FORMAT_MISMATCH);
  });
});
