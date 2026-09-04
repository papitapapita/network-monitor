import { DeviceWentOfflineAlertRecordHandler } from '../../../../src/application/notifications/event-handlers/DeviceWentOfflineAlertRecordHandler';
import { DeviceWentOfflineEvent } from '../../../../src/domain/device-monitoring/events/DeviceWentOfflineEvent';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { IAlertRecorder } from '../../../../src/application/shared/interfaces/IAlertRecorder';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { Result } from '../../../../src/domain/shared/core/Result';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440070';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeEvent(consecutiveFailures = 1): DeviceWentOfflineEvent {
  return new DeviceWentOfflineEvent({
    aggregateId: makeDeviceId(),
    consecutiveFailures,
    dateTimeOccurred: FIXED_DATE
  });
}

function makeRecorder(): jest.Mocked<IAlertRecorder> {
  return {
    open: jest.fn().mockResolvedValue(Result.ok()),
    resolve: jest.fn().mockResolvedValue(Result.ok())
  };
}

function makePollingConfigRepo(): jest.Mocked<IPollingConfigurationRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    delete: jest.fn()
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

function makePollingConfig(ip = '192.168.1.1'): PollingConfiguration {
  return { ipAddress: { value: ip } } as unknown as PollingConfiguration;
}

describe('DeviceWentOfflineAlertRecordHandler', () => {
  let recorder: jest.Mocked<IAlertRecorder>;
  let pollingConfigRepo: jest.Mocked<IPollingConfigurationRepository>;
  let logger: jest.Mocked<ILogger>;
  let handler: DeviceWentOfflineAlertRecordHandler;

  beforeEach(() => {
    recorder = makeRecorder();
    pollingConfigRepo = makePollingConfigRepo();
    logger = makeLogger();
    handler = new DeviceWentOfflineAlertRecordHandler(
      recorder,
      pollingConfigRepo,
      logger
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('[NOT-097] handle — records the outage immediately', () => {
    it('opens an alert through the recorder with device_unreachable/Disponibilidad', async () => {
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );

      await handler.handle(makeEvent(3));

      expect(recorder.open).toHaveBeenCalledTimes(1);
      expect(recorder.open).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: VALID_DEVICE_UUID,
          severity: AlertSeverity.CRITICAL,
          source: 'Disponibilidad',
          type: 'device_unreachable',
          skipTicket: true
        })
      );
    });

    it('carries the consecutiveFailures and resolved IP into details', async () => {
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig('10.1.1.1'))
      );

      await handler.handle(makeEvent(5));

      expect(recorder.open).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { consecutiveFailures: 5, ipAddress: '10.1.1.1' }
        })
      );
    });

    it('sets skipTicket so a blip never opens a work order', async () => {
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );

      await handler.handle(makeEvent());

      const call = recorder.open.mock.calls[0][0];
      expect(call.skipTicket).toBe(true);
    });

    it('still records with a null IP when polling config lookup fails', async () => {
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.fail('unavailable')
      );

      await handler.handle(makeEvent());

      expect(recorder.open).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ ipAddress: null })
        })
      );
    });
  });

  describe('handle — recorder failure', () => {
    it('logs an error and does not throw when the recorder fails', async () => {
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      recorder.open.mockResolvedValue(Result.fail('db down'));

      await expect(
        handler.handle(makeEvent())
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('handle — unexpected exception', () => {
    it('logs and swallows an unexpected throw', async () => {
      pollingConfigRepo.findByDeviceId.mockRejectedValue(
        new Error('boom')
      );
      recorder.open.mockRejectedValue(new Error('boom'));

      await expect(
        handler.handle(makeEvent())
      ).resolves.toBeUndefined();
    });
  });
});
