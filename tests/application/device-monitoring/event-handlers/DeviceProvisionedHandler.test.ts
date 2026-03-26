// Source: src/application/device-monitoring/event-handlers/DeviceProvisionedHandler.ts

import { DeviceProvisionedHandler } from '../../../../src/application/device-monitoring/event-handlers/DeviceProvisionedHandler';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { DeviceCreatedEvent } from '../../../../src/domain/device-inventory/events/DeviceCreatedEvent';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { DeviceName } from '../../../../src/domain/device-inventory/value-objects/DeviceName';
import { DeviceStatus } from '../../../../src/domain/device-inventory/value-objects/DeviceStatus';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums/DeviceOwnerType';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceCreatedEventProps } from '../../../../src/domain/device-inventory/props/DeviceCreatedEventProps';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const DEVICE_IP = '10.0.0.1';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeRepo(): jest.Mocked<IPollingConfigurationRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    delete: jest.fn()
  };
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeIPAddress(ip: string = DEVICE_IP): IPAddress {
  return IPAddress.reconstitute(ip);
}

function makeConfig(): PollingConfiguration {
  return PollingConfiguration.create(
    {
      deviceId: makeDeviceId(),
      ipAddress: makeIPAddress(),
      interval: PollingInterval.create(60).value,
      failuresBeforeDown: FailureThreshold.create(3).value,
      enabled: true
    },
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value
  ).value;
}

function makeEvent(
  overrides: Partial<DeviceCreatedEventProps> = {}
): DeviceCreatedEvent {
  return new DeviceCreatedEvent({
    aggregateId: makeDeviceId(),
    deviceName: DeviceName.reconstitute('Core-Router-01'),
    status: DeviceStatus.createActive(),
    ownerType: DeviceOwnerType.COMPANY,
    monitoringEnabled: true,
    ipAddress: makeIPAddress(),
    dateTimeOccurred: new Date('2024-06-01T12:00:00.000Z'),
    ...overrides
  });
}

// ---------------------------------------------------------------------------

describe('DeviceProvisionedHandler', () => {
  let repo: jest.Mocked<IPollingConfigurationRepository>;
  let handler: DeviceProvisionedHandler;

  beforeEach(() => {
    repo = makeRepo();
    handler = new DeviceProvisionedHandler(repo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('handle — no-op guard conditions', () => {
    it('should return without calling the repository when monitoringEnabled is false', async () => {
      const event = makeEvent({ monitoringEnabled: false });

      await handler.handle(event);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should return without calling the repository when ipAddress is null', async () => {
      const event = makeEvent({
        monitoringEnabled: true,
        ipAddress: null as unknown as IPAddress
      });

      await handler.handle(event);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should return without calling the repository when both monitoringEnabled is false and ipAddress is null', async () => {
      const event = makeEvent({
        monitoringEnabled: false,
        ipAddress: null as unknown as IPAddress
      });

      await handler.handle(event);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should not call findByDeviceId since the handler does not check for existing configs', async () => {
      const event = makeEvent({ monitoringEnabled: false });

      await handler.handle(event);

      expect(repo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('handle — happy path: monitoring enabled with an IP address', () => {
    it('should call save exactly once', async () => {
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent());

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should save a PollingConfiguration instance', async () => {
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent());

      const saved = repo.save.mock.calls[0][0];
      expect(saved).toBeInstanceOf(PollingConfiguration);
    });

    it('should save a config that is enabled', async () => {
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent());

      const saved = repo.save.mock.calls[0][0];
      expect(saved.enabled).toBe(true);
    });

    it('should save a config whose deviceId matches the event aggregateId', async () => {
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent());

      const saved = repo.save.mock.calls[0][0];
      expect(saved.deviceId.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should save a config with the IP address taken from the event', async () => {
      const ip = makeIPAddress('192.168.10.50');
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ ipAddress: ip }));

      const saved = repo.save.mock.calls[0][0];
      expect(saved.ipAddress?.toString()).toBe('192.168.10.50');
    });

    it('should save a config with the default polling interval', async () => {
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent());

      const saved = repo.save.mock.calls[0][0];
      expect(saved.interval.seconds).toBe(
        PollingInterval.createDefault().seconds
      );
    });

    it('should save a config with the default failure threshold', async () => {
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent());

      const saved = repo.save.mock.calls[0][0];
      expect(saved.failuresBeforeDown.value).toBe(
        FailureThreshold.createDefault().value
      );
    });

    it('should not call findByDeviceId — the handler does not check for existing configs', async () => {
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent());

      expect(repo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('handle — PollingConfiguration.create failure', () => {
    it('should not call save when PollingConfiguration.create returns a failure', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const createSpy = jest
        .spyOn(PollingConfiguration, 'create')
        .mockReturnValueOnce(Result.fail('Simulated entity creation failure'));

      await handler.handle(makeEvent());

      expect(repo.save).not.toHaveBeenCalled();

      createSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should log an error when PollingConfiguration.create returns a failure', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const createSpy = jest
        .spyOn(PollingConfiguration, 'create')
        .mockReturnValueOnce(Result.fail('Simulated entity creation failure'));

      await handler.handle(makeEvent());

      expect(consoleSpy).toHaveBeenCalledTimes(1);

      createSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should include the device ID in the error log when PollingConfiguration.create fails', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const createSpy = jest
        .spyOn(PollingConfiguration, 'create')
        .mockReturnValueOnce(Result.fail('Simulated entity creation failure'));

      await handler.handle(makeEvent());

      const logPayload = consoleSpy.mock.calls[0][1] as {
        deviceId: string;
      };
      expect(logPayload.deviceId).toBe(VALID_DEVICE_UUID);

      createSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should include the failure error message in the log payload', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const createSpy = jest
        .spyOn(PollingConfiguration, 'create')
        .mockReturnValueOnce(Result.fail('Missing required field'));

      await handler.handle(makeEvent());

      const logPayload = consoleSpy.mock.calls[0][1] as {
        error: string;
      };
      expect(logPayload.error).toContain('Missing required field');

      createSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  describe('handle — error resilience', () => {
    it('should not throw when save rejects unexpectedly', async () => {
      repo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });

    it('should log the error when save throws an unexpected exception', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      repo.save.mockRejectedValue(new Error('Disk full'));

      await handler.handle(makeEvent());

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should include the device ID in the error log when save throws', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      repo.save.mockRejectedValue(new Error('Fatal DB error'));

      await handler.handle(makeEvent());

      const logPayload = consoleSpy.mock.calls[0][1] as {
        deviceId: string;
      };
      expect(logPayload.deviceId).toBe(VALID_DEVICE_UUID);
      consoleSpy.mockRestore();
    });

    it('should include the error message string in the error log when save throws an Error', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      repo.save.mockRejectedValue(new Error('Connection reset'));

      await handler.handle(makeEvent());

      const logPayload = consoleSpy.mock.calls[0][1] as {
        error: string;
      };
      expect(logPayload.error).toBe('Connection reset');
      consoleSpy.mockRestore();
    });

    it('should coerce a non-Error thrown value to a string in the error log', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      repo.save.mockRejectedValue('raw string error');

      await handler.handle(makeEvent());

      const logPayload = consoleSpy.mock.calls[0][1] as {
        error: string;
      };
      expect(logPayload.error).toBe('raw string error');
      consoleSpy.mockRestore();
    });

    it('should handle a Promise rejection during save gracefully when config creation succeeds', async () => {
      repo.save.mockRejectedValue(new Error('Transaction timeout'));

      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  describe('handle — correct event data extraction', () => {
    it('should use the aggregateId from the event as the saved config deviceId', async () => {
      const alternateUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      const specificId = DeviceId.parse(alternateUuid).value;
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      const event = makeEvent({ aggregateId: specificId });

      await handler.handle(event);

      const saved = repo.save.mock.calls[0][0];
      expect(saved.deviceId.toString()).toBe(alternateUuid);
    });

    it('should carry the exact IPAddress instance from the event into the saved config', async () => {
      const eventIp = makeIPAddress('172.16.0.100');
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ ipAddress: eventIp }));

      const saved = repo.save.mock.calls[0][0];
      expect(saved.ipAddress?.value).toBe('172.16.0.100');
    });
  });
});
