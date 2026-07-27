import { Result } from 'domain/shared/core';
import { IAlertRepository } from 'domain/notifications/repository';

export class PurgeOldAlertsUseCase {
  constructor(private readonly alertRepo: IAlertRepository) {}

  async execute(retentionDays: number): Promise<Result<number>> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    return this.alertRepo.deleteResolvedOlderThan(cutoff);
  }
}
