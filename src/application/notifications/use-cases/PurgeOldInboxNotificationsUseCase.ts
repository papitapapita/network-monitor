import { Result } from 'domain/shared/core';
import { IInboxNotificationRepository } from 'domain/notifications/repository';

// NOT-268: fixed, not one of the vendor's retention settings.
export const INBOX_RETENTION_DAYS = 90;

export class PurgeOldInboxNotificationsUseCase {
  constructor(
    private readonly repository: IInboxNotificationRepository
  ) {}

  async execute(now: Date = new Date()): Promise<Result<number>> {
    const cutoff = new Date(
      now.getTime() - INBOX_RETENTION_DAYS * 86_400_000
    );
    return this.repository.deleteOlderThan(cutoff);
  }
}
