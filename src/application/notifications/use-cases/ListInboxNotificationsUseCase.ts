import { Result } from 'domain/shared/core';
import { IInboxNotificationRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { InboxNotificationMapper } from '../mappers';
import {
  InboxNotificationListResponseDTO,
  ListInboxNotificationsDTO
} from '../dtos';

export const INBOX_DEFAULT_LIMIT = 20;
export const INBOX_MAX_LIMIT = 100;

// NOT-260, NOT-261: the caller's own inbox, newest first.
export class ListInboxNotificationsUseCase extends UseCase<
  ListInboxNotificationsDTO,
  InboxNotificationListResponseDTO
> {
  constructor(
    private readonly repository: IInboxNotificationRepository,
    logger: ILogger
  ) {
    super(logger, 'ListInboxNotificationsUseCase');
  }

  protected async executeImpl(
    request: ListInboxNotificationsDTO
  ): Promise<Result<InboxNotificationListResponseDTO>> {
    const limit = request.limit ?? INBOX_DEFAULT_LIMIT;
    const offset = request.offset ?? 0;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > INBOX_MAX_LIMIT
    ) {
      return this.fail(
        `limit must be between 1 and ${INBOX_MAX_LIMIT}`
      );
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return this.fail('offset must be 0 or more');
    }

    const page = await this.repository.listForUser(request.userId, {
      unreadOnly: request.unreadOnly ?? false,
      limit,
      offset
    });
    if (page.isFailure) {
      return this.fail(`Failed to list notifications: ${page.error}`);
    }
    const unread = await this.repository.countUnread(request.userId);
    if (unread.isFailure) {
      return this.fail(
        `Failed to count unread notifications: ${unread.error}`
      );
    }

    const { notifications, total } = page.value;
    return this.ok({
      notifications: notifications.map(InboxNotificationMapper.toDTO),
      total,
      unread: unread.value,
      hasMore: offset + notifications.length < total,
      limit,
      offset
    });
  }
}
