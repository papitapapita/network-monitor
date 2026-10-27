import { Result } from 'domain/shared/core';
import { InboxNotificationId } from 'domain/shared/ids';
import { IInboxNotificationRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { InboxNotificationMapper } from '../mappers';
import {
  InboxNotificationDTO,
  MarkInboxNotificationReadDTO
} from '../dtos';

export const INBOX_NOTIFICATION_NOT_FOUND = 'Notification not found';

// NOT-262. Another user's notification is "not found", never "forbidden":
// the answer must not tell the caller it exists (NOT-260).
export class MarkInboxNotificationReadUseCase extends UseCase<
  MarkInboxNotificationReadDTO,
  InboxNotificationDTO
> {
  constructor(
    private readonly repository: IInboxNotificationRepository,
    logger: ILogger
  ) {
    super(logger, 'MarkInboxNotificationReadUseCase');
  }

  protected async executeImpl(
    request: MarkInboxNotificationReadDTO
  ): Promise<Result<InboxNotificationDTO>> {
    const idResult = InboxNotificationId.parse(request.id);
    if (idResult.isFailure) {
      return this.fail(`Invalid notification ID: ${idResult.error}`);
    }

    const found = await this.repository.findByIdForUser(
      idResult.value,
      request.userId
    );
    if (found.isFailure) {
      return this.fail(`Failed to load notification: ${found.error}`);
    }
    if (found.value === null) {
      return this.fail(INBOX_NOTIFICATION_NOT_FOUND);
    }

    const notification = found.value;
    if (notification.isRead) {
      return this.ok(InboxNotificationMapper.toDTO(notification));
    }
    notification.markRead(new Date());

    const saved = await this.repository.save(notification);
    if (saved.isFailure) {
      return this.fail(`Failed to save notification: ${saved.error}`);
    }
    return this.ok(InboxNotificationMapper.toDTO(saved.value));
  }
}
