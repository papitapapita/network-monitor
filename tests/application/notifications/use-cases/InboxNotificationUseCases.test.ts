// Source: src/application/notifications/use-cases/ListInboxNotificationsUseCase.ts,
// GetUnreadInboxCountUseCase.ts, MarkInboxNotificationReadUseCase.ts,
// MarkAllInboxNotificationsReadUseCase.ts, RecordInboxNotificationUseCase.ts,
// PurgeOldInboxNotificationsUseCase.ts

import { ListInboxNotificationsUseCase } from '../../../../src/application/notifications/use-cases/ListInboxNotificationsUseCase';
import { GetUnreadInboxCountUseCase } from '../../../../src/application/notifications/use-cases/GetUnreadInboxCountUseCase';
import {
  MarkInboxNotificationReadUseCase,
  INBOX_NOTIFICATION_NOT_FOUND
} from '../../../../src/application/notifications/use-cases/MarkInboxNotificationReadUseCase';
import { MarkAllInboxNotificationsReadUseCase } from '../../../../src/application/notifications/use-cases/MarkAllInboxNotificationsReadUseCase';
import { IInboxNotificationRepository } from '../../../../src/domain/notifications/repository/IInboxNotificationRepository';
import { InboxNotification } from '../../../../src/domain/notifications/entities/InboxNotification';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { AlertSeverity } from '../../../../src/domain/shared/enums';
import { Result } from '../../../../src/domain/shared/core/Result';
import { InboxStream } from '../../../../src/application/notifications/shared/InboxStream';
import { RecordInboxNotificationUseCase } from '../../../../src/application/notifications/use-cases/RecordInboxNotificationUseCase';
import { PurgeOldInboxNotificationsUseCase } from '../../../../src/application/notifications/use-cases/PurgeOldInboxNotificationsUseCase';
import { IInboxRecipientsQuery } from '../../../../src/application/notifications/interfaces/IInboxRecipientsQuery';

const USER_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeNotification(
  occurredAt = new Date('2026-10-27T14:00:00Z')
): InboxNotification {
  return InboxNotification.create({
    userId: USER_ID,
    severity: AlertSeverity.CRITICAL,
    resolved: false,
    type: 'device_unreachable',
    title: 'AP Norte no responde',
    occurredAt
  }).value;
}

function makeStream(): jest.Mocked<InboxStream> {
  return {
    unreadChanged: jest.fn().mockResolvedValue(undefined),
    notificationAdded: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<InboxStream>;
}

function makeRepo(
  notifications: InboxNotification[] = [makeNotification()]
): jest.Mocked<IInboxNotificationRepository> {
  return {
    findByIdForUser: jest
      .fn()
      .mockResolvedValue(Result.ok(notifications[0] ?? null)),
    save: jest
      .fn()
      .mockImplementation(async (n: InboxNotification) =>
        Result.ok(n)
      ),
    listForUser: jest
      .fn()
      .mockResolvedValue(
        Result.ok({ notifications, total: notifications.length })
      ),
    countUnread: jest
      .fn()
      .mockResolvedValue(Result.ok(notifications.length)),
    markAllRead: jest.fn().mockResolvedValue(Result.ok(3)),
    addMany: jest
      .fn()
      .mockImplementation(async (n: InboxNotification[]) =>
        Result.ok(n)
      ),
    deleteOlderThan: jest.fn().mockResolvedValue(Result.ok(5)),
    hasOutageNotice: jest.fn().mockResolvedValue(Result.ok(true))
  };
}

describe('ListInboxNotificationsUseCase', () => {
  it('[NOT-261] defaults to the first 20, all notifications', async () => {
    const repo = makeRepo();
    const useCase = new ListInboxNotificationsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.isSuccess).toBe(true);
    expect(repo.listForUser).toHaveBeenCalledWith(USER_ID, {
      unreadOnly: false,
      limit: 20,
      offset: 0
    });
    expect(result.value).toMatchObject({
      total: 1,
      unread: 1,
      hasMore: false,
      limit: 20,
      offset: 0
    });
    expect(result.value.notifications[0]).toMatchObject({
      category: 'device',
      title: 'AP Norte no responde',
      readAt: null
    });
  });

  it('[NOT-261] reports more pages when the total is larger', async () => {
    const repo = makeRepo();
    repo.listForUser.mockResolvedValue(
      Result.ok({ notifications: [makeNotification()], total: 5 })
    );
    const useCase = new ListInboxNotificationsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      userId: USER_ID,
      unreadOnly: true,
      limit: 1,
      offset: 2
    });

    expect(repo.listForUser).toHaveBeenCalledWith(USER_ID, {
      unreadOnly: true,
      limit: 1,
      offset: 2
    });
    expect(result.value.hasMore).toBe(true);
  });

  it.each([
    [{ limit: 0 }, 'limit must be between 1 and 100'],
    [{ limit: 101 }, 'limit must be between 1 and 100'],
    [{ offset: -1 }, 'offset must be 0 or more']
  ])('rejects %o', async (paging, error) => {
    const repo = makeRepo();
    const useCase = new ListInboxNotificationsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({
      userId: USER_ID,
      ...paging
    });

    expect(result.error).toBe(error);
    expect(repo.listForUser).not.toHaveBeenCalled();
  });

  it('fails when the repository fails', async () => {
    const repo = makeRepo();
    repo.listForUser.mockResolvedValue(Result.fail('db down'));
    const useCase = new ListInboxNotificationsUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.error).toBe(
      'Failed to list notifications: db down'
    );
  });
});

describe('GetUnreadInboxCountUseCase', () => {
  it('returns the caller’s unread count', async () => {
    const repo = makeRepo();
    repo.countUnread.mockResolvedValue(Result.ok(7));
    const useCase = new GetUnreadInboxCountUseCase(
      repo,
      makeLogger()
    );

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.value).toEqual({ unread: 7 });
    expect(repo.countUnread).toHaveBeenCalledWith(USER_ID);
  });
});

describe('MarkInboxNotificationReadUseCase', () => {
  it('[NOT-262] marks it read and saves it', async () => {
    const notification = makeNotification();
    const repo = makeRepo([notification]);
    const stream = makeStream();
    const useCase = new MarkInboxNotificationReadUseCase(
      repo,
      stream,
      makeLogger()
    );

    const result = await useCase.execute({
      userId: USER_ID,
      id: notification.id.toString()
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.readAt).not.toBeNull();
    expect(repo.save).toHaveBeenCalledWith(notification);
    expect(stream.unreadChanged).toHaveBeenCalledWith(USER_ID);
  });

  it('[NOT-262] leaves an already read one untouched', async () => {
    const notification = makeNotification();
    const firstRead = new Date('2026-10-27T15:00:00Z');
    notification.markRead(firstRead);
    const repo = makeRepo([notification]);
    const stream = makeStream();
    const useCase = new MarkInboxNotificationReadUseCase(
      repo,
      stream,
      makeLogger()
    );

    const result = await useCase.execute({
      userId: USER_ID,
      id: notification.id.toString()
    });

    expect(result.value.readAt).toBe(firstRead.toISOString());
    expect(repo.save).not.toHaveBeenCalled();
    expect(stream.unreadChanged).not.toHaveBeenCalled();
  });

  it('[NOT-260] is not found when it is not the caller’s', async () => {
    const repo = makeRepo([]);
    const stream = makeStream();
    const useCase = new MarkInboxNotificationReadUseCase(
      repo,
      stream,
      makeLogger()
    );

    const result = await useCase.execute({
      userId: USER_ID,
      id: makeNotification().id.toString()
    });

    expect(result.error).toBe(INBOX_NOTIFICATION_NOT_FOUND);
  });

  it('rejects a malformed id', async () => {
    const repo = makeRepo();
    const stream = makeStream();
    const useCase = new MarkInboxNotificationReadUseCase(
      repo,
      stream,
      makeLogger()
    );

    const result = await useCase.execute({
      userId: USER_ID,
      id: 'not-a-uuid'
    });

    expect(result.error).toMatch(/^Invalid notification ID/);
    expect(repo.findByIdForUser).not.toHaveBeenCalled();
  });
});

describe('MarkAllInboxNotificationsReadUseCase', () => {
  it('[NOT-263] marks the caller’s unread ones and says how many', async () => {
    const repo = makeRepo();
    const stream = makeStream();
    const useCase = new MarkAllInboxNotificationsReadUseCase(
      repo,
      stream,
      makeLogger()
    );

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.value).toEqual({ marked: 3 });
    expect(repo.markAllRead).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Date)
    );
    expect(stream.unreadChanged).toHaveBeenCalledWith(USER_ID);
  });

  it('[NOT-265] pushes nothing when there was nothing to mark', async () => {
    const repo = makeRepo();
    repo.markAllRead.mockResolvedValue(Result.ok(0));
    const stream = makeStream();
    const useCase = new MarkAllInboxNotificationsReadUseCase(
      repo,
      stream,
      makeLogger()
    );

    await useCase.execute({ userId: USER_ID });

    expect(stream.unreadChanged).not.toHaveBeenCalled();
  });
});

describe('RecordInboxNotificationUseCase', () => {
  const ADMIN_ID = '0b9d6a52-5c55-4a77-8f0e-2f2f6d3c1a01';

  function makeRecipients(
    ids: Result<string[]> = Result.ok([USER_ID, ADMIN_ID])
  ): jest.Mocked<IInboxRecipientsQuery> {
    return { findActiveUserIds: jest.fn().mockResolvedValue(ids) };
  }

  const request = {
    type: 'device_unreachable',
    severity: AlertSeverity.CRITICAL,
    resolved: false,
    title: 'AP Norte no responde',
    body: null,
    deviceId: null,
    alertId: null,
    occurredAt: new Date('2026-10-27T14:00:00Z')
  };

  it('[NOT-266] gives every active account its own copy', async () => {
    const repo = makeRepo();
    const recipients = makeRecipients();
    const useCase = new RecordInboxNotificationUseCase(
      repo,
      recipients,
      makeStream(),
      makeLogger()
    );

    const result = await useCase.execute(request);

    expect(result.value).toEqual({ recorded: 2 });
    expect(recipients.findActiveUserIds).toHaveBeenCalledWith(false);
    const added = repo.addMany.mock.calls[0][0];
    expect(added.map((n) => n.userId)).toEqual([USER_ID, ADMIN_ID]);
  });

  it('[NOT-266] addresses a security notice to administrators only', async () => {
    const recipients = makeRecipients(Result.ok([ADMIN_ID]));
    const useCase = new RecordInboxNotificationUseCase(
      makeRepo(),
      recipients,
      makeStream(),
      makeLogger()
    );

    await useCase.execute({ ...request, type: 'sign_in_paused' });

    expect(recipients.findActiveUserIds).toHaveBeenCalledWith(true);
  });

  it('[NOT-269] pushes only the copies actually added', async () => {
    const repo = makeRepo();
    repo.addMany.mockImplementation(async (n) => Result.ok([n[1]]));
    const stream = makeStream();
    const useCase = new RecordInboxNotificationUseCase(
      repo,
      makeRecipients(),
      stream,
      makeLogger()
    );

    const result = await useCase.execute(request);

    expect(result.value).toEqual({ recorded: 1 });
    expect(stream.notificationAdded).toHaveBeenCalledTimes(1);
    expect(stream.notificationAdded.mock.calls[0][0].userId).toBe(
      ADMIN_ID
    );
  });

  it('fails without adding anything when the recipients cannot be read', async () => {
    const repo = makeRepo();
    const useCase = new RecordInboxNotificationUseCase(
      repo,
      makeRecipients(Result.fail('db down')),
      makeStream(),
      makeLogger()
    );

    const result = await useCase.execute(request);

    expect(result.error).toMatch(/^Failed to load inbox recipients/);
    expect(repo.addMany).not.toHaveBeenCalled();
  });

  it('fails when the notification is invalid', async () => {
    const repo = makeRepo();
    const useCase = new RecordInboxNotificationUseCase(
      repo,
      makeRecipients(),
      makeStream(),
      makeLogger()
    );

    const result = await useCase.execute({ ...request, title: ' ' });

    expect(result.error).toBe('title is required');
    expect(repo.addMany).not.toHaveBeenCalled();
  });

  it('fails when the notifications cannot be stored', async () => {
    const repo = makeRepo();
    repo.addMany.mockResolvedValue(Result.fail('db down'));
    const stream = makeStream();
    const useCase = new RecordInboxNotificationUseCase(
      repo,
      makeRecipients(),
      stream,
      makeLogger()
    );

    const result = await useCase.execute(request);

    expect(result.error).toMatch(/^Failed to record notification/);
    expect(stream.notificationAdded).not.toHaveBeenCalled();
  });
});

describe('[NOT-270] RecordInboxNotificationUseCase — recoveries', () => {
  const ALERT_ID = '7d0f4b8e-1c2a-4b3c-9d4e-5f6a7b8c9d0e';
  const recovery = {
    type: 'device_unreachable',
    severity: AlertSeverity.CRITICAL,
    resolved: true,
    title: 'AP Norte volvió a responder',
    body: null,
    deviceId: null,
    alertId: ALERT_ID,
    occurredAt: new Date('2026-10-27T14:30:00Z')
  };

  function makeUseCase(
    repo: jest.Mocked<IInboxNotificationRepository>
  ) {
    return new RecordInboxNotificationUseCase(
      repo,
      {
        findActiveUserIds: jest
          .fn()
          .mockResolvedValue(Result.ok([USER_ID]))
      },
      makeStream(),
      makeLogger()
    );
  }

  it('records a recovery whose outage is in the inbox', async () => {
    const repo = makeRepo();

    const result = await makeUseCase(repo).execute(recovery);

    expect(result.value).toEqual({ recorded: 1 });
    expect(repo.hasOutageNotice).toHaveBeenCalledWith(ALERT_ID);
  });

  it('skips a recovery whose outage never reached the inbox', async () => {
    const repo = makeRepo();
    repo.hasOutageNotice.mockResolvedValue(Result.ok(false));

    const result = await makeUseCase(repo).execute(recovery);

    expect(result.value).toEqual({ recorded: 0 });
    expect(repo.addMany).not.toHaveBeenCalled();
  });

  it('fails when the outage notice cannot be checked', async () => {
    const repo = makeRepo();
    repo.hasOutageNotice.mockResolvedValue(Result.fail('db down'));

    const result = await makeUseCase(repo).execute(recovery);

    expect(result.error).toMatch(
      /^Failed to check the outage notice/
    );
    expect(repo.addMany).not.toHaveBeenCalled();
  });

  it('does not check an outage for a notice with no alert', async () => {
    const repo = makeRepo();

    await makeUseCase(repo).execute({ ...recovery, alertId: null });

    expect(repo.hasOutageNotice).not.toHaveBeenCalled();
    expect(repo.addMany).toHaveBeenCalled();
  });
});

describe('PurgeOldInboxNotificationsUseCase', () => {
  it('[NOT-268] deletes notifications older than 90 days', async () => {
    const repo = makeRepo();
    const useCase = new PurgeOldInboxNotificationsUseCase(repo);

    const result = await useCase.execute(
      new Date('2026-10-27T00:00:00Z')
    );

    expect(result.value).toBe(5);
    expect(repo.deleteOlderThan).toHaveBeenCalledWith(
      new Date('2026-07-29T00:00:00Z')
    );
  });
});
