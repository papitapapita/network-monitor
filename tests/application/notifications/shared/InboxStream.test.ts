// Source: src/application/notifications/shared/InboxStream.ts

import { InboxStream } from '../../../../src/application/notifications/shared/InboxStream';
import { IInboxNotificationRepository } from '../../../../src/domain/notifications/repository/IInboxNotificationRepository';
import {
  IEventStreamHub,
  ILogger
} from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core/Result';
import { InboxNotification } from '../../../../src/domain/notifications/entities/InboxNotification';
import { AlertSeverity } from '../../../../src/domain/shared/enums';

const USER_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';
const CHANNEL = `inbox:user:${USER_ID}`;

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

function makeHub(listeners: number): jest.Mocked<IEventStreamHub> {
  return {
    subscribe: jest.fn(),
    publish: jest.fn(),
    clientCount: jest.fn().mockReturnValue(listeners),
    closeAll: jest.fn()
  };
}

function makeRepo(
  unread: Result<number> = Result.ok(4)
): jest.Mocked<IInboxNotificationRepository> {
  return {
    findByIdForUser: jest.fn(),
    save: jest.fn(),
    listForUser: jest.fn(),
    countUnread: jest.fn().mockResolvedValue(unread),
    markAllRead: jest.fn(),
    addMany: jest.fn(),
    deleteOlderThan: jest.fn(),
    hasOutageNotice: jest.fn()
  };
}

describe('InboxStream', () => {
  it('[NOT-265] pushes the new unread count to the user’s channel', async () => {
    const hub = makeHub(2);
    const stream = new InboxStream(hub, makeRepo(), makeLogger());

    await stream.unreadChanged(USER_ID);

    expect(hub.clientCount).toHaveBeenCalledWith(CHANNEL);
    expect(hub.publish).toHaveBeenCalledWith(CHANNEL, 'unread', {
      unread: 4
    });
  });

  it('skips the count when the user has no stream open', async () => {
    const hub = makeHub(0);
    const repo = makeRepo();
    const stream = new InboxStream(hub, repo, makeLogger());

    await stream.unreadChanged(USER_ID);

    expect(repo.countUnread).not.toHaveBeenCalled();
    expect(hub.publish).not.toHaveBeenCalled();
  });

  it('logs and pushes nothing when the count fails', async () => {
    const hub = makeHub(1);
    const logger = makeLogger();
    const stream = new InboxStream(
      hub,
      makeRepo(Result.fail('db down')),
      logger
    );

    await stream.unreadChanged(USER_ID);

    expect(hub.publish).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  describe('notificationAdded', () => {
    const notification = InboxNotification.create({
      userId: USER_ID,
      severity: AlertSeverity.CRITICAL,
      resolved: false,
      type: 'device_unreachable',
      title: 'AP Norte no responde',
      occurredAt: new Date('2026-10-27T14:00:00Z')
    }).value;

    it('[NOT-269] pushes the notification with the new unread count', async () => {
      const hub = makeHub(1);
      const stream = new InboxStream(hub, makeRepo(), makeLogger());

      await stream.notificationAdded(notification);

      expect(hub.publish).toHaveBeenCalledWith(
        CHANNEL,
        'notification',
        {
          notification: expect.objectContaining({
            id: notification.id.toString(),
            title: 'AP Norte no responde',
            category: 'device'
          }),
          unread: 4
        }
      );
    });

    it('skips the count when the user has no stream open', async () => {
      const hub = makeHub(0);
      const repo = makeRepo();
      const stream = new InboxStream(hub, repo, makeLogger());

      await stream.notificationAdded(notification);

      expect(repo.countUnread).not.toHaveBeenCalled();
      expect(hub.publish).not.toHaveBeenCalled();
    });

    it('logs and pushes nothing when the count fails', async () => {
      const hub = makeHub(1);
      const logger = makeLogger();
      const stream = new InboxStream(
        hub,
        makeRepo(Result.fail('db down')),
        logger
      );

      await stream.notificationAdded(notification);

      expect(hub.publish).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
