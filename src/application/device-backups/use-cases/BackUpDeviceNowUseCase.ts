import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { BackupOutcome, BackupTrigger } from 'domain/device-backups';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  BackUpDeviceNowRequestDTO,
  BackUpDeviceNowResponseDTO
} from '../dtos';
import { IBackupTargetsQuery } from '../interfaces';
import { ConfigBackupMapper } from '../mappers';
import { DeviceConfigBackupService } from '../services';

export const BACKUP_NOW_FAILURES = {
  REFUSED: 'Cannot back up this device',
  FAILED: 'Backup failed'
} as const;

export class BackUpDeviceNowUseCase extends UseCase<
  BackUpDeviceNowRequestDTO,
  BackUpDeviceNowResponseDTO
> {
  constructor(
    private readonly targets: IBackupTargetsQuery,
    private readonly backupService: DeviceConfigBackupService,
    logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    super(logger, 'BackUpDeviceNowUseCase');
  }

  protected async executeImpl(
    request: BackUpDeviceNowRequestDTO
  ): Promise<Result<BackUpDeviceNowResponseDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure)
      return this.fail(`Invalid device ID: ${deviceId.error}`);

    const candidate = await this.targets.findByDevice(deviceId.value);
    if (candidate.isFailure) return Result.fail(candidate.error);
    if (!candidate.value) return this.fail('Device not found');

    const attempt = await this.backupService.backUp(
      candidate.value,
      BackupTrigger.MANUAL,
      this.clock()
    );
    if (attempt.isFailure) return Result.fail(attempt.error);

    const outcome = attempt.value;
    if (outcome.outcome === BackupOutcome.FAILED)
      return this.fail(
        `${outcome.refused ? BACKUP_NOW_FAILURES.REFUSED : BACKUP_NOW_FAILURES.FAILED}: ${outcome.error}`
      );

    return this.ok({
      outcome: outcome.outcome,
      backup: ConfigBackupMapper.toDTO(outcome.backup)
    });
  }
}
