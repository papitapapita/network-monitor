import { Result } from 'domain/shared/core';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { ILogger } from 'application/shared/interfaces';

// The permanent half of soft delete. Once the grace period has run out the row
// goes for good, taking every ping result, alert, snapshot, credential and
// polling config with it via ON DELETE CASCADE.
//
// It runs unguarded on purpose: DeleteDeviceUseCase already refuses to
// tombstone a device that still carries a live contracted service or an open
// ticket, so anything that reaches this point was cleared for removal a week
// ago. Re-checking here would only turn a decided deletion into a row that
// silently never dies.
export class PurgeDeletedDevicesUseCase {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    private readonly logger: ILogger
  ) {}

  async execute(graceDays: number): Promise<Result<number>> {
    const cutoff = new Date(Date.now() - graceDays * 86_400_000);

    const dueResult =
      await this.deviceRepository.findDeletedBefore(cutoff);
    if (dueResult.isFailure) {
      return Result.fail<number>(dueResult.error!);
    }

    let purged = 0;

    // One at a time, and a failure on one device must not abandon the rest —
    // there is no transaction here and each delete stands alone.
    for (const device of dueResult.value) {
      const deleteResult = await this.deviceRepository.delete(
        device.id
      );

      if (deleteResult.isFailure) {
        this.logger.error(
          '[PurgeDeletedDevicesUseCase] Failed to purge device',
          undefined,
          {
            deviceId: device.id.toString(),
            error: deleteResult.error
          }
        );
        continue;
      }

      purged += 1;
    }

    return Result.ok<number>(purged);
  }
}
