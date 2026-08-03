// Source: src/application/device-monitoring/event-handlers/DeviceStatusChangedHandler.ts

import { DeviceStatusChangedHandler } from '../../../../src/application/device-monitoring/event-handlers/DeviceStatusChangedHandler';
import { SuspendDeviceMonitoringUseCase } from '../../../../src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase';
import { DeviceStatusChangedEvent } from '../../../../src/domain/device-inventory/events/DeviceStatusChangedEvent';
import { DeviceStatus } from '../../../../src/domain/device-inventory/value-objects/DeviceStatus';
import { DeviceName } from '../../../../src/domain/device-inventory/value-objects/DeviceName';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis() as any,
    setLevel: jest.fn()
  };
}

function makeSuspendUseCase(): jest.Mocked<SuspendDeviceMonitoringUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(Result.ok(undefined))
  } as unknown as jest.Mocked<SuspendDeviceMonitoringUseCase>;
}

function makeEvent(newStatus: DeviceStatus): DeviceStatusChangedEvent {
  return new DeviceStatusChangedEvent({
    aggregateId: makeDeviceId(),
    deviceName: DeviceName.reconstitute('Core-Router-01'),
    previousStatus: DeviceStatus.createActive(),
    newStatus,
    dateTimeOccurred: new Date('2024-06-01T12:00:00.000Z')
  });
}

// ---------------------------------------------------------------------------

describe('DeviceStatusChangedHandler', () => {
  let suspend: jest.Mocked<SuspendDeviceMonitoringUseCase>;
  let logger: jest.Mocked<ILogger>;
  let handler: DeviceStatusChangedHandler;

  beforeEach(() => {
    suspend = makeSuspendUseCase();
    logger = makeLogger();
    handler = new DeviceStatusChangedHandler(suspend, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('statuses that end monitoring', () => {
    it('[MON-002] should suspend monitoring when a device moves to INVENTORY', async () => {
      await handler.handle(makeEvent(DeviceStatus.createInventory()));

      expect(suspend.execute).toHaveBeenCalledTimes(1);
      expect(suspend.execute.mock.calls[0][0].toString()).toBe(
        VALID_DEVICE_UUID
      );
    });

    it('[MON-002] should suspend monitoring when a device moves to DAMAGED', async () => {
      await handler.handle(makeEvent(DeviceStatus.createDamaged()));

      expect(suspend.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('statuses that leave monitoring alone', () => {
    it('should do nothing when a device moves to ACTIVE', async () => {
      await handler.handle(makeEvent(DeviceStatus.createActive()));

      expect(suspend.execute).not.toHaveBeenCalled();
    });

    it('should do nothing when a device moves to COMMISSIONING', async () => {
      await handler.handle(makeEvent(DeviceStatus.createCommissioning()));

      expect(suspend.execute).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('error resilience', () => {
    it('should log an error when the suspension fails', async () => {
      suspend.execute.mockResolvedValue(Result.fail('DB unavailable'));

      await handler.handle(makeEvent(DeviceStatus.createInventory()));

      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should include the device id in the failure log payload', async () => {
      suspend.execute.mockResolvedValue(Result.fail('DB unavailable'));

      await handler.handle(makeEvent(DeviceStatus.createInventory()));

      const context = (logger.error as jest.Mock).mock.calls[0][2] as {
        deviceId: string;
      };
      expect(context.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should not throw when the suspension rejects', async () => {
      suspend.execute.mockRejectedValue(new Error('Fatal'));

      await expect(
        handler.handle(makeEvent(DeviceStatus.createInventory()))
      ).resolves.toBeUndefined();
    });

    it('should log the new status when an exception is thrown', async () => {
      suspend.execute.mockRejectedValue(new Error('Fatal'));

      await handler.handle(makeEvent(DeviceStatus.createDamaged()));

      const context = (logger.error as jest.Mock).mock.calls[0][2] as {
        newStatus: string;
      };
      expect(context.newStatus).toBe('DAMAGED');
    });
  });
});
