import { Result } from 'domain/shared/core';
import { IInboxNotificationRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { GetUnreadInboxCountDTO, UnreadInboxCountDTO } from '../dtos';

// The bell's badge (NOT-260).
export class GetUnreadInboxCountUseCase extends UseCase<
  GetUnreadInboxCountDTO,
  UnreadInboxCountDTO
> {
  constructor(
    private readonly repository: IInboxNotificationRepository,
    logger: ILogger
  ) {
    super(logger, 'GetUnreadInboxCountUseCase');
  }

  protected async executeImpl(
    request: GetUnreadInboxCountDTO
  ): Promise<Result<UnreadInboxCountDTO>> {
    const unread = await this.repository.countUnread(request.userId);
    if (unread.isFailure) {
      return this.fail(
        `Failed to count unread notifications: ${unread.error}`
      );
    }
    return this.ok({ unread: unread.value });
  }
}
