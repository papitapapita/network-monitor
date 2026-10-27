import { Result } from 'domain/shared/core';
import { IInboxNotificationRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  MarkAllInboxNotificationsReadDTO,
  MarkAllInboxNotificationsReadResponseDTO
} from '../dtos';

// NOT-263: only the caller's own unread notifications; ones already read keep
// the time they were first read (NOT-262).
export class MarkAllInboxNotificationsReadUseCase extends UseCase<
  MarkAllInboxNotificationsReadDTO,
  MarkAllInboxNotificationsReadResponseDTO
> {
  constructor(
    private readonly repository: IInboxNotificationRepository,
    logger: ILogger
  ) {
    super(logger, 'MarkAllInboxNotificationsReadUseCase');
  }

  protected async executeImpl(
    request: MarkAllInboxNotificationsReadDTO
  ): Promise<Result<MarkAllInboxNotificationsReadResponseDTO>> {
    const marked = await this.repository.markAllRead(
      request.userId,
      new Date()
    );
    if (marked.isFailure) {
      return this.fail(
        `Failed to mark notifications read: ${marked.error}`
      );
    }
    return this.ok({ marked: marked.value });
  }
}
