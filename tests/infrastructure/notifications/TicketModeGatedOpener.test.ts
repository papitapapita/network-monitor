// Source: src/infrastructure/notifications/TicketModeGatedOpener.ts

import { TicketModeGatedOpener } from '../../../src/infrastructure/notifications/TicketModeGatedOpener';
import { ITicketOpener } from '../../../src/application/tickets/interfaces/ITicketOpener';
import { INotificationSettingsRepository } from '../../../src/domain/notifications/repository/INotificationSettingsRepository';
import { NotificationSettings } from '../../../src/domain/notifications/value-objects/NotificationSettings';
import { AlertTicketMode } from '../../../src/domain/notifications/props/NotificationSettingsProps';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../src/domain/shared/core/Result';

const REQUEST = {
  origin: 'WIRELESS_ALERT',
  alertId: 'aaaaaaaa-0000-4000-8000-000000000001',
  deviceId: '550e8400-e29b-41d4-a716-446655440001',
  severity: 'WARNING',
  message: 'CCQ bajo'
};

function makeRepo(
  alertTicketMode: AlertTicketMode
): jest.Mocked<INotificationSettingsRepository> {
  return {
    get: jest.fn().mockResolvedValue(
      Result.ok(
        NotificationSettings.reconstitute({
          telegramChatId: '-100',
          downAlertDelayMinutes: 60,
          wirelessAlertsEnabled: true,
          alertTicketMode,
          quietHours: null
        })
      )
    ),
    save: jest.fn()
  };
}

describe('[NOT-205] TicketModeGatedOpener', () => {
  let inner: jest.Mocked<ITicketOpener>;
  let logger: jest.Mocked<ILogger>;

  beforeEach(() => {
    inner = {
      openFromAlert: jest.fn().mockResolvedValue(Result.ok())
    };
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

  it('opens the ticket in AUTOMATIC mode', async () => {
    const opener = new TicketModeGatedOpener(
      inner,
      makeRepo('AUTOMATIC'),
      logger
    );

    const result = await opener.openFromAlert(REQUEST);

    expect(result.isSuccess).toBe(true);
    expect(inner.openFromAlert).toHaveBeenCalledWith(REQUEST);
  });

  it('opens nothing in SUGGEST mode', async () => {
    const opener = new TicketModeGatedOpener(
      inner,
      makeRepo('SUGGEST'),
      logger
    );

    const result = await opener.openFromAlert(REQUEST);

    expect(result.isSuccess).toBe(true);
    expect(inner.openFromAlert).not.toHaveBeenCalled();
  });

  it('suggests rather than opens when the settings cannot be read', async () => {
    const repo = makeRepo('AUTOMATIC');
    repo.get.mockResolvedValue(Result.fail('db down'));
    const opener = new TicketModeGatedOpener(inner, repo, logger);

    const result = await opener.openFromAlert(REQUEST);

    expect(result.isSuccess).toBe(true);
    expect(inner.openFromAlert).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('passes on the inner failure', async () => {
    inner.openFromAlert.mockResolvedValue(Result.fail('boom'));
    const opener = new TicketModeGatedOpener(
      inner,
      makeRepo('AUTOMATIC'),
      logger
    );

    const result = await opener.openFromAlert(REQUEST);

    expect(result.isFailure).toBe(true);
  });
});
