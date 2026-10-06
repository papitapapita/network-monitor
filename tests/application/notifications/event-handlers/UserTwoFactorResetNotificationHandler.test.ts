import {
  TWO_FACTOR_RESET_ALERT_TYPE,
  UserTwoFactorResetNotificationHandler
} from '../../../../src/application/notifications/event-handlers/UserTwoFactorResetNotificationHandler';
import { SIGN_IN_SOURCE } from '../../../../src/application/notifications/event-handlers/UserSignInPausedNotificationHandler';
import { UserTwoFactorResetEvent } from '../../../../src/domain/identity/events/UserTwoFactorResetEvent';
import { UserId } from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { makeLogger } from '../../probe-agents/fixtures';

const OCCURRED = new Date('2026-10-05T17:00:00.000Z');

function makeEvent(): UserTwoFactorResetEvent {
  return new UserTwoFactorResetEvent({
    aggregateId: UserId.create(),
    email: 'staff@isp.example',
    resetBy: 'admin@isp.example',
    dateTimeOccurred: OCCURRED
  });
}

function makePublisher(): jest.Mocked<IAlertPublisher> {
  return { publish: jest.fn().mockResolvedValue(Result.ok()) };
}

describe('UserTwoFactorResetNotificationHandler', () => {
  it('[IDN-173] publishes a warning naming who reset which account', async () => {
    const publisher = makePublisher();

    await new UserTwoFactorResetNotificationHandler(
      publisher,
      makeLogger()
    ).handle(makeEvent());

    expect(publisher.publish).toHaveBeenCalledWith({
      deviceId: null,
      severity: AlertSeverity.WARNING,
      source: SIGN_IN_SOURCE,
      summary:
        'admin@isp.example reinició la verificación en dos pasos de la cuenta staff@isp.example',
      detail: expect.stringContaining('cerró todas sus sesiones'),
      occurredAt: OCCURRED,
      resolved: false,
      type: TWO_FACTOR_RESET_ALERT_TYPE
    });
  });

  it('logs a failed publish without throwing', async () => {
    const publisher = makePublisher();
    publisher.publish.mockResolvedValue(Result.fail('telegram down'));
    const logger = makeLogger();

    await new UserTwoFactorResetNotificationHandler(
      publisher,
      logger
    ).handle(makeEvent());

    expect(logger.error).toHaveBeenCalledWith(
      'UserTwoFactorResetNotificationHandler: publish failed',
      undefined,
      expect.objectContaining({ error: 'telegram down' })
    );
  });

  it('logs a throwing publisher without throwing', async () => {
    const publisher = makePublisher();
    publisher.publish.mockRejectedValue(new Error('boom'));
    const logger = makeLogger();

    await expect(
      new UserTwoFactorResetNotificationHandler(
        publisher,
        logger
      ).handle(makeEvent())
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
