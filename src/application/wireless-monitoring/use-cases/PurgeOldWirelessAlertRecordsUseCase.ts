import { Result } from 'domain/shared/core';
import { IWirelessAlertRecordRepository } from 'domain/wireless-monitoring/repository';

export class PurgeOldWirelessAlertRecordsUseCase {
  constructor(
    private readonly alertRecordRepo: IWirelessAlertRecordRepository
  ) {}

  async execute(retentionDays: number): Promise<Result<number>> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    return this.alertRecordRepo.deleteClearedOlderThan(cutoff);
  }
}
