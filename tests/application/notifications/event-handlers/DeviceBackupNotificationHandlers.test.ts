// Source: src/application/notifications/event-handlers/DeviceBackupNotificationHandlers.ts

import {
  BACKUP_FAILING_ALERT_TYPE,
  DeviceBackupFailingNotificationHandler
} from '../../../../src/application/notifications/event-handlers';
import { DeviceBackupFailingEvent } from '../../../../src/domain/device-backups/events';
import { DeviceId } from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  IAlertPublisher,
  QUIET_HOURS_SUPPRESSED
} from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { makeLogger } from '../../probe-agents/fixtures';

const DEVICE_ID = DeviceId.create();
const OCCURRED = new Date('2026-10-08T08:00:00.000Z');

const failing = (lastSuccessAt: Date | null) =>
  new DeviceBackupFailingEvent({
    aggregateId: DEVICE_ID,
    deviceName: 'AP Torre Norte',
    consecutiveFailures: 3,
    failingSince: new Date('2026-10-06T08:00:00.000Z'),
    lastSuccessAt,
    lastError: 'Login rejected',
    dateTimeOccurred: OCCURRED
  });

const okPublisher = (): jest.Mocked<IAlertPublisher> => ({
  publish: jest.fn().mockResolvedValue(Result.ok())
});

describe('DeviceBackupFailingNotificationHandler', () => {
  it('[BKP-061] should warn with the streak, the last good copy and the error', async () => {
    const publisher = okPublisher();

    await new DeviceBackupFailingNotificationHandler(
      publisher,
      makeLogger()
    ).handle(failing(new Date('2026-10-05T08:00:00.000Z')));

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: DEVICE_ID.toString(),
        severity: AlertSeverity.WARNING,
        type: BACKUP_FAILING_ALERT_TYPE,
        summary:
          'La copia de configuración de "AP Torre Norte" falló 3 veces seguidas',
        detail: expect.stringMatching(/05\/10\/2026.*Login rejected/)
      })
    );
  });

  it('[BKP-061] should say when the device has never been backed up', async () => {
    const publisher = okPublisher();

    await new DeviceBackupFailingNotificationHandler(
      publisher,
      makeLogger()
    ).handle(failing(null));

    expect(publisher.publish.mock.calls[0][0].detail).toContain(
      'Todavía no tiene ninguna copia'
    );
  });

  it('should log a real publish failure', async () => {
    const logger = makeLogger();
    const publisher: jest.Mocked<IAlertPublisher> = {
      publish: jest.fn().mockResolvedValue(Result.fail('bot blocked'))
    };

    await new DeviceBackupFailingNotificationHandler(
      publisher,
      logger
    ).handle(failing(null));

    expect(logger.error).toHaveBeenCalledWith(
      'DeviceBackupFailingNotificationHandler: publish failed',
      undefined,
      expect.objectContaining({ error: 'bot blocked' })
    );
  });

  it('[BKP-062] should not log a publish held back on purpose', async () => {
    const logger = makeLogger();
    const publisher: jest.Mocked<IAlertPublisher> = {
      publish: jest
        .fn()
        .mockResolvedValue(Result.fail(QUIET_HOURS_SUPPRESSED))
    };

    await new DeviceBackupFailingNotificationHandler(
      publisher,
      logger
    ).handle(failing(null));

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should log instead of throwing when the publisher fails', async () => {
    const logger = makeLogger();
    const publisher: jest.Mocked<IAlertPublisher> = {
      publish: jest.fn().mockRejectedValue(new Error('telegram down'))
    };

    await expect(
      new DeviceBackupFailingNotificationHandler(
        publisher,
        logger
      ).handle(failing(null))
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
