import { Result } from 'domain/shared/core';
import { InboxNotification } from 'domain/notifications/entities';
import { IInboxNotificationRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  RecordInboxNotificationDTO,
  RecordInboxNotificationResponseDTO
} from '../dtos';
import { IInboxRecipientsQuery } from '../interfaces';
import { InboxStream } from '../shared';

// NOT-266: every active account gets a copy, security notices only the ones
// that administer the install. NOT-267: a retried delivery records nothing new.
// NOT-270: a recovery follows its outage into the inbox, never ahead of it.
export class RecordInboxNotificationUseCase extends UseCase<
  RecordInboxNotificationDTO,
  RecordInboxNotificationResponseDTO
> {
  constructor(
    private readonly repository: IInboxNotificationRepository,
    private readonly recipients: IInboxRecipientsQuery,
    private readonly stream: InboxStream,
    logger: ILogger
  ) {
    super(logger, 'RecordInboxNotificationUseCase');
  }

  protected async executeImpl(
    request: RecordInboxNotificationDTO
  ): Promise<Result<RecordInboxNotificationResponseDTO>> {
    if (request.resolved && request.alertId) {
      const outage = await this.repository.hasOutageNotice(
        request.alertId
      );
      if (outage.isFailure) {
        return this.fail(
          `Failed to check the outage notice: ${outage.error}`
        );
      }
      if (!outage.value) return this.ok({ recorded: 0 });
    }

    const adminsOnly =
      InboxNotification.categoryFor(request.type.trim()) ===
      'security';
    const userIds =
      await this.recipients.findActiveUserIds(adminsOnly);
    if (userIds.isFailure) {
      return this.fail(
        `Failed to load inbox recipients: ${userIds.error}`
      );
    }

    const notifications: InboxNotification[] = [];
    for (const userId of userIds.value) {
      const created = InboxNotification.create({
        ...request,
        userId
      });
      if (created.isFailure) return this.fail(created.error);
      notifications.push(created.value);
    }

    const added = await this.repository.addMany(notifications);
    if (added.isFailure) {
      return this.fail(
        `Failed to record notification: ${added.error}`
      );
    }
    for (const notification of added.value) {
      await this.stream.notificationAdded(notification);
    }
    return this.ok({ recorded: added.value.length });
  }
}
