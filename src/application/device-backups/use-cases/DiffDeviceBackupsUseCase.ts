import { Result } from 'domain/shared/core';
import { ConfigBackupId, DeviceId } from 'domain/shared/ids';
import {
  ConfigBackup,
  ConfigDiff,
  ConfigNormalizer,
  ConfigSecretMasker,
  IConfigBackupRepository
} from 'domain/device-backups';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DeviceBackupDiffDTO,
  DiffDeviceBackupsRequestDTO
} from '../dtos';
import { IBackupTargetsQuery } from '../interfaces';
import { ConfigBackupMapper } from '../mappers';

export const BACKUP_DIFF_FORMAT_MISMATCH =
  'Invalid comparison: the two backups have different formats';

export class DiffDeviceBackupsUseCase extends UseCase<
  DiffDeviceBackupsRequestDTO,
  DeviceBackupDiffDTO
> {
  constructor(
    private readonly targets: IBackupTargetsQuery,
    private readonly backups: IConfigBackupRepository,
    logger: ILogger
  ) {
    super(logger, 'DiffDeviceBackupsUseCase');
  }

  protected async executeImpl(
    request: DiffDeviceBackupsRequestDTO
  ): Promise<Result<DeviceBackupDiffDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure)
      return this.fail(`Invalid device ID: ${deviceId.error}`);
    const fromId = ConfigBackupId.parse(request.fromBackupId);
    if (fromId.isFailure)
      return this.fail(`Invalid backup ID: ${fromId.error}`);
    const toId = ConfigBackupId.parse(request.toBackupId);
    if (toId.isFailure)
      return this.fail(`Invalid backup ID: ${toId.error}`);

    const candidate = await this.targets.findByDevice(deviceId.value);
    if (candidate.isFailure) return Result.fail(candidate.error);
    if (!candidate.value) return this.fail('Device not found');

    const from = await this.load(deviceId.value, fromId.value);
    if (from.isFailure) return Result.fail(from.error);
    const to = await this.load(deviceId.value, toId.value);
    if (to.isFailure) return Result.fail(to.error);

    const format = from.value.backup.format;
    if (format !== to.value.backup.format)
      return this.fail(BACKUP_DIFF_FORMAT_MISMATCH);

    // BKP-070: what changed in the configuration, not in how it was served.
    const difference = ConfigDiff.compare(
      ConfigNormalizer.normalize(format, from.value.content),
      ConfigNormalizer.normalize(format, to.value.content)
    );

    return this.ok({
      from: ConfigBackupMapper.toDTO(from.value.backup),
      to: ConfigBackupMapper.toDTO(to.value.backup),
      identical: difference.hunks.length === 0,
      added: difference.added,
      removed: difference.removed,
      // BKP-071: masked after comparing, so a changed password still shows.
      hunks: difference.hunks.map((hunk) => ({
        ...hunk,
        lines: hunk.lines.map((line) => ({
          kind: line.kind,
          text: ConfigSecretMasker.maskLine(format, line.text)
        }))
      }))
    });
  }

  // Lines of a device's configuration, even masked, stay out of the logs.
  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'hunks' in data)
      return { ...(data as object), hunks: '[redacted]' };
    return data;
  }

  private async load(
    deviceId: DeviceId,
    backupId: ConfigBackupId
  ): Promise<Result<{ backup: ConfigBackup; content: string }>> {
    const backup = await this.backups.findById(backupId);
    if (backup.isFailure) return Result.fail(backup.error);
    if (!backup.value || !backup.value.deviceId.equals(deviceId))
      return Result.fail('Backup not found');

    const content = await this.backups.findContent(backupId);
    if (content.isFailure) return Result.fail(content.error);
    if (content.value === null)
      return Result.fail('Backup not found');
    return Result.ok({
      backup: backup.value,
      content: content.value
    });
  }
}
