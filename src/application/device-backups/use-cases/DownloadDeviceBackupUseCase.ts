import { Result } from 'domain/shared/core';
import { ConfigBackupId, DeviceId } from 'domain/shared/ids';
import {
  BackupFormat,
  IConfigBackupRepository
} from 'domain/device-backups';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DeviceBackupFileDTO,
  DownloadDeviceBackupRequestDTO
} from '../dtos';
import { IBackupTargetsQuery } from '../interfaces';

const EXTENSIONS: Record<BackupFormat, string> = {
  [BackupFormat.AIROS_CFG]: 'cfg',
  // BKP-054: what RouterOS's `/import` takes back.
  [BackupFormat.ROUTEROS_EXPORT]: 'rsc'
};

export class DownloadDeviceBackupUseCase extends UseCase<
  DownloadDeviceBackupRequestDTO,
  DeviceBackupFileDTO
> {
  constructor(
    private readonly targets: IBackupTargetsQuery,
    private readonly backups: IConfigBackupRepository,
    logger: ILogger
  ) {
    super(logger, 'DownloadDeviceBackupUseCase');
  }

  protected async executeImpl(
    request: DownloadDeviceBackupRequestDTO
  ): Promise<Result<DeviceBackupFileDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure)
      return this.fail(`Invalid device ID: ${deviceId.error}`);
    const backupId = ConfigBackupId.parse(request.backupId);
    if (backupId.isFailure)
      return this.fail(`Invalid backup ID: ${backupId.error}`);

    const candidate = await this.targets.findByDevice(deviceId.value);
    if (candidate.isFailure) return Result.fail(candidate.error);
    if (!candidate.value) return this.fail('Device not found');

    const backup = await this.backups.findById(backupId.value);
    if (backup.isFailure) return Result.fail(backup.error);
    if (
      !backup.value ||
      !backup.value.deviceId.equals(deviceId.value)
    )
      return this.fail('Backup not found');

    const content = await this.backups.findContent(backupId.value);
    if (content.isFailure) return Result.fail(content.error);
    if (content.value === null) return this.fail('Backup not found');

    return this.ok({
      fileName: this.fileName(
        candidate.value.deviceName,
        backup.value.takenAt,
        EXTENSIONS[backup.value.format]
      ),
      contentType: 'text/plain; charset=utf-8',
      content: content.value
    });
  }

  // The file holds device passwords and wireless keys (BKP-041).
  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'content' in data)
      return { ...(data as object), content: '[redacted]' };
    return data;
  }

  private fileName(deviceName: string, takenAt: Date, ext: string) {
    const slug =
      deviceName
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'device';
    const stamp = takenAt
      .toISOString()
      .slice(0, 16)
      .replace(/[-:]/g, '')
      .replace('T', '-');
    return `${slug}-${stamp}Z.${ext}`;
  }
}
