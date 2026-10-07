// Source: src/application/notifications/event-handlers/DeviceBackupNotificationHandlers.ts

import {
  BACKUP_FAILING_ALERT_TYPE,
  CONFIG_CHANGED_ALERT_TYPE,
  DeviceBackupFailingNotificationHandler,
  DeviceConfigChangedNotificationHandler
} from '../../../../src/application/notifications/event-handlers';
import {
  DeviceBackupFailingEvent,
  DeviceConfigChangedEvent
} from '../../../../src/domain/device-backups/events';
import {
  ConfigBackupId,
  DeviceId
} from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  IAlertPublisher,
  QUIET_HOURS_SUPPRESSED
} from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { makeLogger } from '../../probe-agents/fixtures';

const DEVICE_ID = DeviceId.create();
const OCCURRED = new Date('2026-10-08T08:00:00.000Z');

const changed = () =>
  new DeviceConfigChangedEvent({
    aggregateId: ConfigBackupId.create(),
    deviceId: DEVICE_ID,
    deviceName: 'AP Torre Norte',
    previousBackupId: ConfigBackupId.create(),
    previousCheckedAt: new Date('2026-10-07T08:00:00.000Z'),
    dateTimeOccurred: OCCURRED
  });

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

describe('DeviceConfigChangedNotificationHandler', () => {
  it('[BKP-060] should warn about the device, naming it', async () => {
    const publisher = okPublisher();

    await new DeviceConfigChangedNotificationHandler(
      publisher,
      makeLogger()
    ).handle(changed());

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: DEVICE_ID.toString(),
        severity: AlertSeverity.WARNING,
        summary: 'La configuración de "AP Torre Norte" cambió',
        detail: expect.stringContaining('07/10/2026'),
        occurredAt: OCCURRED,
        resolved: false
      })
    );
  });

  it('[BKP-062] should use its own alert type so it can be muted', async () => {
    const publisher = okPublisher();

    await new DeviceConfigChangedNotificationHandler(
      publisher,
      makeLogger()
    ).handle(changed());

    expect(publisher.publish.mock.calls[0][0].type).toBe(
      CONFIG_CHANGED_ALERT_TYPE
    );
  });

  it('[BKP-062] should not log a publish held back on purpose', async () => {
    const logger = makeLogger();
    const publisher: jest.Mocked<IAlertPublisher> = {
      publish: jest
        .fn()
        .mockResolvedValue(Result.fail(QUIET_HOURS_SUPPRESSED))
    };

    await new DeviceConfigChangedNotificationHandler(
      publisher,
      logger
    ).handle(changed());

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should log instead of throwing when the publisher fails', async () => {
    const logger = makeLogger();
    const publisher: jest.Mocked<IAlertPublisher> = {
      publish: jest.fn().mockRejectedValue(new Error('telegram down'))
    };

    await expect(
      new DeviceConfigChangedNotificationHandler(
        publisher,
        logger
      ).handle(changed())
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
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
});
