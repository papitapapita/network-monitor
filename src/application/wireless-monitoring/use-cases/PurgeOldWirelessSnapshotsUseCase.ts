import { Result } from 'domain/shared/core';
import { IWirelessSnapshotRepository } from 'domain/wireless-monitoring/repository';

export class PurgeOldWirelessSnapshotsUseCase {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository
  ) {}

  async execute(retentionDays: number): Promise<Result<number>> {
    const cutoff = new Date(
      Date.now() - retentionDays * 86_400_000
    );
    return this.snapshotRepo.deleteOlderThan(cutoff);
  }
}
