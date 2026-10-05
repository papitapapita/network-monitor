// Source: src/infrastructure/notifications/SwitchedOffAlertPublisher.ts

import { SwitchedOffAlertPublisher } from '../../../src/infrastructure/notifications/SwitchedOffAlertPublisher';
import {
  IAlertPublisher,
  AlertNotification,
  WIRELESS_ALERTS_OFF_SUPPRESSED,
  isSuppressedPublish
} from '../../../src/application/shared/interfaces/IAlertPublisher';
import { INotificationSettingsRepository } from '../../../src/domain/notifications/repository/INotificationSettingsRepository';
import { NotificationSettings } from '../../../src/domain/notifications/value-objects/NotificationSettings';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../src/domain/shared/core/Result';

const NOTIFICATION: AlertNotification = {
  deviceId: '550e8400-e29b-41d4-a716-446655440001',
  severity: AlertSeverity.WARNING,
  source: 'Enlace inalámbrico',
  summary: 'signal_rx_dbm',
  detail: 'Señal baja',
  occurredAt: new Date('2026-09-30T20:00:00Z'),
  resolved: false,
  type: 'wireless:signal_rx_dbm:WARNING'
};

function makeRepo(
  wirelessAlertsEnabled: boolean
): jest.Mocked<INotificationSettingsRepository> {
  return {
    get: jest.fn().mockResolvedValue(
      Result.ok(
        NotificationSettings.reconstitute({
          telegramChatId: '-100',
          downAlertDelayMinutes: 60,
          wirelessAlertsEnabled
        })
      )
    ),
    save: jest.fn()
  };
}

describe('[NOT-203] SwitchedOffAlertPublisher', () => {
  let inner: jest.Mocked<IAlertPublisher>;
  let logger: jest.Mocked<ILogger>;

  beforeEach(() => {
    inner = { publish: jest.fn().mockResolvedValue(Result.ok()) };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    };
  });

  it('forwards while wireless alert notifications are on', async () => {
    const publisher = new SwitchedOffAlertPublisher(
      inner,
      makeRepo(true),
      logger
    );

    const result = await publisher.publish(NOTIFICATION);

    expect(result.isSuccess).toBe(true);
    expect(inner.publish).toHaveBeenCalledWith(NOTIFICATION);
  });

  it('withholds the notification while they are off', async () => {
    const publisher = new SwitchedOffAlertPublisher(
      inner,
      makeRepo(false),
      logger
    );

    const result = await publisher.publish(NOTIFICATION);

    expect(result.error).toBe(WIRELESS_ALERTS_OFF_SUPPRESSED);
    expect(isSuppressedPublish(result.error)).toBe(true);
    expect(inner.publish).not.toHaveBeenCalled();
  });

  it('notifies anyway when the settings cannot be read', async () => {
    const repo = makeRepo(false);
    repo.get.mockResolvedValue(Result.fail('DB down'));
    const publisher = new SwitchedOffAlertPublisher(
      inner,
      repo,
      logger
    );

    await publisher.publish(NOTIFICATION);

    expect(inner.publish).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
