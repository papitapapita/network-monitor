import { WirelessAlertClearedNotificationHandler } from '../../../../src/application/wireless-monitoring/event-handlers/WirelessAlertClearedNotificationHandler';
import { IWirelessAlertNotifier } from '../../../../src/application/wireless-monitoring/interfaces/IWirelessAlertNotifier';
import { WirelessAlertClearedEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessAlertCleared';
import {
  DeviceId,
  WirelessAlertRecordId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440050';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeNotifier(): jest.Mocked<IWirelessAlertNotifier> {
  return {
    notifyTriggered: jest.fn().mockResolvedValue(Result.ok()),
    notifyCleared: jest.fn().mockResolvedValue(Result.ok())
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

describe('WirelessAlertClearedNotificationHandler', () => {
  let notifier: jest.Mocked<IWirelessAlertNotifier>;
  let logger: jest.Mocked<ILogger>;
  let handler: WirelessAlertClearedNotificationHandler;

  beforeEach(() => {
    notifier = makeNotifier();
    logger = makeLogger();
    handler = new WirelessAlertClearedNotificationHandler(
      notifier,
      logger
    );
  });

  describe('handle — severity filter', () => {
    it('should notify when a CRITICAL alert clears', async () => {
      await handler.handle(makeEvent('CRITICAL'));

      expect(notifier.notifyCleared).toHaveBeenCalledTimes(1);
    });

    it('should stay silent when a WARNING alert clears', async () => {
      await handler.handle(makeEvent('WARNING'));

      expect(notifier.notifyCleared).not.toHaveBeenCalled();
    });

    it('should stay silent for change-detection clears, which are WARNING', async () => {
      await handler.handle(
        makeEvent('WARNING', 'firmware_version_changed')
      );

      expect(notifier.notifyCleared).not.toHaveBeenCalled();
    });
  });

  describe('handle — payload', () => {
    it('should forward deviceId, metric, severity and clearedAt', async () => {
      await handler.handle(makeEvent('CRITICAL', 'lan_status'));

      expect(notifier.notifyCleared).toHaveBeenCalledWith({
        deviceId: VALID_DEVICE_UUID,
        metric: 'lan_status',
        severity: 'CRITICAL',
        clearedAt: FIXED_DATE
      });
    });
  });

  describe('handle — resilience', () => {
    it('should log an error when the notifier returns a failure', async () => {
      notifier.notifyCleared.mockResolvedValue(
        Result.fail('telegram down')
      );

      await handler.handle(makeEvent('CRITICAL'));

      expect(logger.error).toHaveBeenCalled();
    });

    it('should not throw when the notifier rejects', async () => {
      notifier.notifyCleared.mockRejectedValue(new Error('boom'));

      await expect(
        handler.handle(makeEvent('CRITICAL'))
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
