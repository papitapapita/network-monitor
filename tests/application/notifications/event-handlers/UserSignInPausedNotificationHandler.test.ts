import {
  SIGN_IN_PAUSED_ALERT_TYPE,
  SIGN_IN_SOURCE,
  UserSignInPausedNotificationHandler
} from '../../../../src/application/notifications/event-handlers/UserSignInPausedNotificationHandler';
import { UserSignInPausedEvent } from '../../../../src/domain/identity/events/UserSignInPausedEvent';
import { UserId } from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { makeLogger } from '../../probe-agents/fixtures';

const OCCURRED = new Date('2026-10-05T17:00:00.000Z');

function makeEvent(sourceIp: string | null): UserSignInPausedEvent {
  return new UserSignInPausedEvent({
    aggregateId: UserId.create(),
    email: 'admin@isp.example',
    failedSignIns: 5,
    pausedUntil: new Date(OCCURRED.getTime() + 60_000),
    sourceIp,
    dateTimeOccurred: OCCURRED
  });
}

function makePublisher(): jest.Mocked<IAlertPublisher> {
  return { publish: jest.fn().mockResolvedValue(Result.ok()) };
}

describe('UserSignInPausedNotificationHandler', () => {
  it('[IDN-045] publishes a warning with no device to the install chat', async () => {
    const publisher = makePublisher();

    await new UserSignInPausedNotificationHandler(
      publisher,
      makeLogger()
    ).handle(makeEvent('203.0.113.7'));

    expect(publisher.publish).toHaveBeenCalledWith({
      deviceId: null,
      severity: AlertSeverity.WARNING,
      source: SIGN_IN_SOURCE,
      summary:
        '5 contraseñas incorrectas seguidas en la cuenta admin@isp.example',
      detail:
        'Desde 203.0.113.7. La cuenta espera 1 minuto antes de aceptar otro intento, y cada nuevo fallo duplica la espera hasta 15 minutos.',
      occurredAt: OCCURRED,
      resolved: false,
      type: SIGN_IN_PAUSED_ALERT_TYPE
    });
  });

  it('[IDN-045] leaves the address out when it is unknown', async () => {
    const publisher = makePublisher();

    await new UserSignInPausedNotificationHandler(
      publisher,
      makeLogger()
    ).handle(makeEvent(null));

    expect(publisher.publish.mock.calls[0][0].detail).toMatch(
      /^La cuenta espera 1 minuto/
    );
  });

  it('logs a failed publish without throwing', async () => {
    const publisher = makePublisher();
    publisher.publish.mockResolvedValue(Result.fail('telegram down'));
    const logger = makeLogger();

    await new UserSignInPausedNotificationHandler(
      publisher,
      logger
    ).handle(makeEvent(null));

    expect(logger.error).toHaveBeenCalledWith(
      'UserSignInPausedNotificationHandler: publish failed',
      undefined,
      expect.objectContaining({ error: 'telegram down' })
    );
  });
});
