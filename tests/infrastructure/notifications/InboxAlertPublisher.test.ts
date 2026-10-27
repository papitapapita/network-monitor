// Source: src/infrastructure/notifications/InboxAlertPublisher.ts

import { InboxAlertPublisher } from '../../../src/infrastructure/notifications/InboxAlertPublisher';
import {
  IAlertPublisher,
  AlertNotification,
  QUIET_HOURS_SUPPRESSED
} from '../../../src/application/shared/interfaces/IAlertPublisher';
import { RecordInboxNotificationUseCase } from '../../../src/application/notifications/use-cases/RecordInboxNotificationUseCase';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../src/domain/shared/core/Result';

const NOTIFICATION: AlertNotification = {
  deviceId: '550e8400-e29b-41d4-a716-446655440001',
  severity: AlertSeverity.CRITICAL,
  source: 'Monitoreo',
  summary: 'AP Norte no responde desde las 14:00',
  detail: 'También caídos: CPE Pérez',
  shortDetail: 'CPE Pérez',
  occurredAt: new Date('2026-10-27T14:00:00Z'),
  resolved: false,
  type: 'device_unreachable',
  alertId: '7d0f4b8e-1c2a-4b3c-9d4e-5f6a7b8c9d0e'
};

describe('[NOT-267] InboxAlertPublisher', () => {
  let inner: jest.Mocked<IAlertPublisher>;
  let record: jest.Mocked<RecordInboxNotificationUseCase>;
  let logger: jest.Mocked<ILogger>;
  let publisher: InboxAlertPublisher;

  beforeEach(() => {
    inner = { publish: jest.fn().mockResolvedValue(Result.ok()) };
    record = {
      execute: jest.fn().mockResolvedValue(Result.ok({ recorded: 2 }))
    } as unknown as jest.Mocked<RecordInboxNotificationUseCase>;
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    };
    publisher = new InboxAlertPublisher(inner, record, logger);
  });

  it('records the notice with its full detail, then delivers it', async () => {
    const result = await publisher.publish(NOTIFICATION);

    expect(result.isSuccess).toBe(true);
    expect(record.execute).toHaveBeenCalledWith({
      type: 'device_unreachable',
      severity: AlertSeverity.CRITICAL,
      resolved: false,
      title: 'AP Norte no responde desde las 14:00',
      body: 'También caídos: CPE Pérez',
      deviceId: NOTIFICATION.deviceId,
      alertId: NOTIFICATION.alertId,
      occurredAt: NOTIFICATION.occurredAt
    });
    expect(inner.publish).toHaveBeenCalledWith(NOTIFICATION);
  });

  it('records a notice the filters inside keep off Telegram', async () => {
    inner.publish.mockResolvedValue(
      Result.fail(QUIET_HOURS_SUPPRESSED)
    );

    const result = await publisher.publish(NOTIFICATION);

    expect(record.execute).toHaveBeenCalled();
    expect(result.error).toBe(QUIET_HOURS_SUPPRESSED);
  });

  it('records no alert link for a notice without one', async () => {
    const { alertId: _alertId, ...withoutAlert } = NOTIFICATION;

    await publisher.publish(withoutAlert);

    expect(record.execute).toHaveBeenCalledWith(
      expect.objectContaining({ alertId: null })
    );
  });

  it('still delivers when recording fails, and logs it', async () => {
    record.execute.mockResolvedValue(Result.fail('db down'));

    const result = await publisher.publish(NOTIFICATION);

    expect(result.isSuccess).toBe(true);
    expect(inner.publish).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Inbox notification not recorded',
      { type: 'device_unreachable', error: 'db down' }
    );
  });
});
