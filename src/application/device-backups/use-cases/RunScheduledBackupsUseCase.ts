import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  BackupOutcome,
  BackupTrigger,
  IDeviceBackupStateRepository
} from 'domain/device-backups';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  RunScheduledBackupsRequestDTO,
  ScheduledBackupRunDTO
} from '../dtos';
import { BackupCandidate, IBackupTargetsQuery } from '../interfaces';
import { DeviceConfigBackupService } from '../services';

// BKP-012: a device backed up within this window is not asked again, so a
// restart after the nightly run does not repeat it.
export const BACKUP_FRESH_FOR_MS = 20 * 60 * 60 * 1000;
// BKP-013: a few devices at a time, so one slow radio cannot hold up the run
// and the run never floods the network.
export const BACKUP_CONCURRENCY = 4;

export class RunScheduledBackupsUseCase extends UseCase<
  RunScheduledBackupsRequestDTO,
  ScheduledBackupRunDTO
> {
  constructor(
    private readonly targets: IBackupTargetsQuery,
    private readonly states: IDeviceBackupStateRepository,
    private readonly backupService: DeviceConfigBackupService,
    logger: ILogger
  ) {
    super(logger, 'RunScheduledBackupsUseCase');
  }

  protected async executeImpl(
    request: RunScheduledBackupsRequestDTO
  ): Promise<Result<ScheduledBackupRunDTO>> {
    const candidates = await this.targets.listScheduled();
    if (candidates.isFailure) return Result.fail(candidates.error);

    const run: ScheduledBackupRunDTO = {
      saved: 0,
      unchanged: 0,
      skipped: 0,
      failed: []
    };
    const queue = [...candidates.value];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift())
        await this.backUpOne(next, request.now, run);
    };
    await Promise.all(
      Array.from({ length: BACKUP_CONCURRENCY }, () => worker())
    );
    return this.ok(run);
  }

  // One device's trouble, storage included, never stops the others.
  private async backUpOne(
    candidate: BackupCandidate,
    now: Date,
    run: ScheduledBackupRunDTO
  ): Promise<void> {
    const failed = (error: string) =>
      run.failed.push({
        deviceId: candidate.deviceId,
        deviceName: candidate.deviceName,
        error
      });

    const deviceId = DeviceId.parse(candidate.deviceId);
    if (deviceId.isFailure) return void failed(deviceId.error);

    const state = await this.states.findByDevice(deviceId.value);
    if (state.isFailure) return void failed(state.error);
    if (
      state.value?.succeededSince(
        new Date(now.getTime() - BACKUP_FRESH_FOR_MS)
      )
    ) {
      run.skipped++;
      return;
    }

    const attempt = await this.backupService.backUp(
      candidate,
      BackupTrigger.SCHEDULED,
      now
    );
    if (attempt.isFailure) return void failed(attempt.error);

    const outcome = attempt.value;
    if (outcome.outcome === BackupOutcome.SAVED) run.saved++;
    else if (outcome.outcome === BackupOutcome.UNCHANGED)
      run.unchanged++;
    else failed(outcome.error);
  }
}
