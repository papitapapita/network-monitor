// Source: src/infrastructure/notifications/PushAlertPublisher.ts

import { PushAlertPublisher } from '../../../src/infrastructure/notifications/PushAlertPublisher';
import { SendPushAlertUseCase } from '../../../src/application/notifications/use-cases/SendPushAlertUseCase';
import { AlertNotification } from '../../../src/application/shared/interfaces';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { AlertSeverity } from '../../../src/domain/shared/enums';
import { Result } from '../../../src/domain/shared/core/Result';

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

const NOTIFICATION: AlertNotification = {
  deviceId: 'd0b5c0de-0000-4000-8000-000000000001',
  severity: AlertSeverity.CRITICAL,
  source: 'monitoring',
  summary: 'Torre Norte caída',
  detail: 'Sin respuesta a ping',
  occurredAt: new Date('2026-10-13T15:00:00Z'),
  resolved: false,
  type: 'device_unreachable'
};

describe('PushAlertPublisher', () => {
  it('hands the alert to the push use case', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue(Result.ok({ delivered: 1 }));
    const publisher = new PushAlertPublisher(
      { execute } as unknown as SendPushAlertUseCase,
      makeLogger()
    );

    const result = await publisher.publish(NOTIFICATION);

    expect(result.isSuccess).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      deviceId: NOTIFICATION.deviceId,
      severity: AlertSeverity.CRITICAL,
      summary: 'Torre Norte caída',
      detail: 'Sin respuesta a ping',
      resolved: false,
      type: 'device_unreachable'
    });
  });

  it('[NOT-222] reports success even when push fails, so Telegram is not resent', async () => {
    const logger = makeLogger();
    const publisher = new PushAlertPublisher(
      {
        execute: jest.fn().mockResolvedValue(Result.fail('db down'))
      } as unknown as SendPushAlertUseCase,
      logger
    );

    const result = await publisher.publish(NOTIFICATION);

    expect(result.isSuccess).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });
});
