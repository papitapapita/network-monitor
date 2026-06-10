import { Result } from 'domain/shared/core';
import { IPingResultRepository } from 'domain/device-monitoring/repository';

export class PurgeOldPingResultsUseCase {
  constructor(
    private readonly pingResultRepo: IPingResultRepository
  ) {}

  async execute(retentionDays: number): Promise<Result<number>> {
    const cutoff = new Date(
      Date.now() - retentionDays * 86_400_000
    );
    return this.pingResultRepo.deleteOlderThan(cutoff);
  }
}
