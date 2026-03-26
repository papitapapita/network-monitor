// Source: src/application/device-monitoring/event-handlers/DeviceIPAddressChangedHandler.ts

import { DeviceIPAddressChangedHandler } from '../../../../src/application/device-monitoring/event-handlers/DeviceIPAddressChangedHandler';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { DeviceDetailsUpdatedEvent } from '../../../../src/domain/device-inventory/events/DeviceDetailsUpdatedEvent';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { DeviceName } from '../../../../src/domain/device-inventory/value-objects/DeviceName';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceDetailsUpdatedEventProps } from '../../../../src/domain/device-inventory/props/DeviceDetailsUpdatedEventProps';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const ORIGINAL_IP = '10.0.0.1';
const NEW_IP = '10.0.0.99';

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

function makeConfig(ipRaw: string | null = ORIGINAL_IP): PollingConfiguration {
  return PollingConfiguration.create(
    {
      deviceId: makeDeviceId(),
      ipAddress: ipRaw !== null ? IPAddress.reconstitute(ipRaw) : null,
      interval: PollingInterval.create(60).value,
      failuresBeforeDown: FailureThreshold.create(3).value,
      enabled: true
    },
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value
  ).value;
}

function makeEvent(
  updatedFields: DeviceDetailsUpdatedEventProps['updatedFields']
): DeviceDetailsUpdatedEvent {
  return new DeviceDetailsUpdatedEvent({
    aggregateId: makeDeviceId(),
    deviceName: DeviceName.reconstitute('Core-Router-01'),
    updatedFields,
    dateTimeOccurred: new Date('2024-06-01T12:00:00.000Z')
  });
}

// ---------------------------------------------------------------------------

describe('DeviceIPAddressChangedHandler', () => {
  let repo: jest.Mocked<IPollingConfigurationRepository>;
  let handler: DeviceIPAddressChangedHandler;

  beforeEach(() => {
    repo = makeRepo();
    handler = new DeviceIPAddressChangedHandler(repo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('handle — no-op when ipAddress is not in updatedFields', () => {
    it('should return without calling the repository when ipAddress is absent from updatedFields', async () => {
      const event = makeEvent({ name: DeviceName.reconstitute('New Name') });

      await handler.handle(event);

      expect(repo.findByDeviceId).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should return without calling the repository when only description is updated', async () => {
      const event = makeEvent({ description: 'some description' });

      await handler.handle(event);

      expect(repo.findByDeviceId).not.toHaveBeenCalled();
    });

    it('should return without calling the repository when updatedFields is empty', async () => {
      const event = makeEvent({});

      await handler.handle(event);

      expect(repo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('handle — no-op when no PollingConfiguration exists for the device', () => {
    it('should not call save when the repository returns a failure result', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.fail('DB unavailable'));

      const event = makeEvent({ ipAddress: IPAddress.reconstitute(NEW_IP) });

      await handler.handle(event);

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should not call save when findByDeviceId returns a null value', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const event = makeEvent({ ipAddress: IPAddress.reconstitute(NEW_IP) });

      await handler.handle(event);

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('handle — happy path: ipAddress update is in the event', () => {
    it('should call findByDeviceId with the device ID from the event', async () => {
      const config = makeConfig(ORIGINAL_IP);
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const event = makeEvent({ ipAddress: IPAddress.reconstitute(NEW_IP) });

      await handler.handle(event);

      expect(repo.findByDeviceId).toHaveBeenCalledTimes(1);
      expect(repo.findByDeviceId.mock.calls[0][0].toString()).toBe(
        VALID_DEVICE_UUID
      );
    });

    it('should update the config IP address to the new value from the event', async () => {
      const config = makeConfig(ORIGINAL_IP);
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const newIp = IPAddress.reconstitute(NEW_IP);
      const event = makeEvent({ ipAddress: newIp });

      await handler.handle(event);

      expect(config.ipAddress?.toString()).toBe(NEW_IP);
    });

    it('should persist the updated config via save', async () => {
      const config = makeConfig(ORIGINAL_IP);
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const event = makeEvent({ ipAddress: IPAddress.reconstitute(NEW_IP) });

      await handler.handle(event);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(config);
    });

    it('should set the IP address to null when updatedFields.ipAddress is explicitly null', async () => {
      const config = makeConfig(ORIGINAL_IP);
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      // ipAddress key is present but its value is null (device IP removed)
      const event = makeEvent({ ipAddress: null });

      await handler.handle(event);

      expect(config.ipAddress).toBeNull();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should set the IP address to null when updatedFields.ipAddress is undefined (key present via ?? null)', async () => {
      // The handler uses `event.updatedFields.ipAddress ?? null` so when the
      // field is present but resolves to undefined the IP is cleared to null.
      const config = makeConfig(ORIGINAL_IP);
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      // Construct props directly so ipAddress key exists but value is undefined
      const event = new DeviceDetailsUpdatedEvent({
        aggregateId: makeDeviceId(),
        deviceName: DeviceName.reconstitute('Core-Router-01'),
        updatedFields: { ipAddress: undefined },
        dateTimeOccurred: new Date('2024-06-01T12:00:00.000Z')
      });

      await handler.handle(event);

      expect(config.ipAddress).toBeNull();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('handle — error resilience', () => {
    it('should not throw when findByDeviceId rejects unexpectedly', async () => {
      repo.findByDeviceId.mockRejectedValue(new Error('Unexpected DB crash'));

      const event = makeEvent({ ipAddress: IPAddress.reconstitute(NEW_IP) });

      await expect(handler.handle(event)).resolves.toBeUndefined();
    });

    it('should not throw when save rejects unexpectedly', async () => {
      const config = makeConfig(ORIGINAL_IP);
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockRejectedValue(new Error('Network timeout'));

      const event = makeEvent({ ipAddress: IPAddress.reconstitute(NEW_IP) });

      await expect(handler.handle(event)).resolves.toBeUndefined();
    });

    it('should log the error when an unexpected exception is thrown', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      repo.findByDeviceId.mockRejectedValue(new Error('Disk full'));

      const event = makeEvent({ ipAddress: IPAddress.reconstitute(NEW_IP) });

      await handler.handle(event);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should include the device ID in the error log payload', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      repo.findByDeviceId.mockRejectedValue(new Error('Fatal error'));

      const event = makeEvent({ ipAddress: IPAddress.reconstitute(NEW_IP) });

      await handler.handle(event);

      const logPayload = consoleSpy.mock.calls[0][1] as { deviceId: string };
      expect(logPayload.deviceId).toBe(VALID_DEVICE_UUID);
      consoleSpy.mockRestore();
    });
  });
});
