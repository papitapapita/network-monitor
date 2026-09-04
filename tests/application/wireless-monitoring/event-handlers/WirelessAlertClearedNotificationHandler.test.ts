import { WirelessAlertClearedNotificationHandler } from '../../../../src/application/wireless-monitoring/event-handlers/WirelessAlertClearedNotificationHandler';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { WirelessAlertClearedEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessAlertCleared';
import {
  DeviceId,
  WirelessAlertRecordId
} from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { QUIET_HOURS_SUPPRESSED } from '../../../../src/application/shared/interfaces/IAlertPublisher';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440050';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeAlertPublisher(): jest.Mocked<IAlertPublisher> {
  return {
    publish: jest.fn().mockResolvedValue(Result.ok())
  };
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  } as unknown as jest.Mocked<ILogger>;
}

function makeEvent(
  severity: 'WARNING' | 'CRITICAL',
  metric = 'signal_rx_dbm'
): WirelessAlertClearedEvent {
  return new WirelessAlertClearedEvent({
    aggregateId: WirelessAlertRecordId.create(),
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    metric,
    severity,
    clearedAt: FIXED_DATE,
    dateTimeOccurred: FIXED_DATE
  });
}

describe('[WLS-123] WirelessAlertClearedNotificationHandler', () => {
  let publisher: jest.Mocked<IAlertPublisher>;
  let logger: jest.Mocked<ILogger>;
  let handler: WirelessAlertClearedNotificationHandler;

  beforeEach(() => {
    publisher = makeAlertPublisher();
    logger = makeLogger();
    handler = new WirelessAlertClearedNotificationHandler(
      publisher,
      logger
    );
  });

  describe('handle — severity filter', () => {
    it('should publish when a CRITICAL alert clears', async () => {
      await handler.handle(makeEvent('CRITICAL'));

      expect(publisher.publish).toHaveBeenCalledTimes(1);
    });

    it('should stay silent when a WARNING alert clears', async () => {
      await handler.handle(makeEvent('WARNING'));

      expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('should stay silent for change-detection clears, which are WARNING', async () => {
      await handler.handle(
        makeEvent('WARNING', 'firmware_version_changed')
      );

      expect(publisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('handle — envelope', () => {
    it('should publish a resolved CRITICAL wireless-link alert', async () => {
      await handler.handle(makeEvent('CRITICAL', 'lan_status'));

      expect(publisher.publish).toHaveBeenCalledWith({
        deviceId: VALID_DEVICE_UUID,
        severity: AlertSeverity.CRITICAL,
        source: 'Enlace inalámbrico',
        subject: 'lan_status',
        detail:
          'La condición de alerta en lan_status se ha normalizado.',
        occurredAt: FIXED_DATE,
        resolved: true,
        type: 'wireless:lan_status:CRITICAL'
      });
    });
  });

  describe('handle — resilience', () => {
    it('should log an error when the publisher returns a failure', async () => {
      publisher.publish.mockResolvedValue(
        Result.fail('telegram down')
      );

      await handler.handle(makeEvent('CRITICAL'));

      expect(logger.error).toHaveBeenCalled();
    });

    it('should not throw when the publisher rejects', async () => {
      publisher.publish.mockRejectedValue(new Error('boom'));

      await expect(
        handler.handle(makeEvent('CRITICAL'))
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('[NOT-175] should not log a quiet-hours suppression as an error', async () => {
      publisher.publish.mockResolvedValue(
        Result.fail(QUIET_HOURS_SUPPRESSED)
      );

      await handler.handle(makeEvent('CRITICAL'));

      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
