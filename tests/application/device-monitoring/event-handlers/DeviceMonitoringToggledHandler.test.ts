import { DeviceMonitoringToggledHandler } from '../../../../src/application/device-monitoring/event-handlers/DeviceMonitoringToggledHandler';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { DeviceMonitoringToggledEvent } from '../../../../src/domain/device-inventory/events/DeviceMonitoringToggledEvent';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { DeviceName } from '../../../../src/domain/device-inventory/value-objects/DeviceName';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceMonitoringToggledEventProps } from '../../../../src/domain/device-inventory/props/DeviceMonitoringToggledEventProps';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const DEVICE_IP = '10.0.0.1';

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

function makeConfig(
  overrides: {
    enabled?: boolean;
    ipAddress?: string | null;
  } = {}
): PollingConfiguration {
  const rawIp =
    overrides.ipAddress !== undefined ? overrides.ipAddress : DEVICE_IP;
  return PollingConfiguration.reconstitute(
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value,
    {
      deviceId: makeDeviceId(),
      ipAddress: rawIp !== null ? IPAddress.reconstitute(rawIp) : null,
      interval: PollingInterval.create(60).value,
      failuresBeforeDown: FailureThreshold.create(3).value,
      enabled: overrides.enabled !== undefined ? overrides.enabled : true
    }
  );
}

function makeEvent(
  overrides: Partial<DeviceMonitoringToggledEventProps> = {}
): DeviceMonitoringToggledEvent {
  return new DeviceMonitoringToggledEvent({
    aggregateId: makeDeviceId(),
    deviceName: DeviceName.reconstitute('Core-Router-01'),
    monitoringEnabled: true,
    ipAddress: makeIPAddress(),
    dateTimeOccurred: new Date('2024-06-01T12:00:00.000Z'),
    ...overrides
  });
}

describe('DeviceMonitoringToggledHandler', () => {
  let repo: jest.Mocked<IPollingConfigurationRepository>;
  let logger: jest.Mocked<ILogger>;
  let handler: DeviceMonitoringToggledHandler;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    handler = new DeviceMonitoringToggledHandler(repo, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handle — monitoring enabled with no existing config (first-time creation)', () => {
    it('should call findByDeviceId with the device ID from the event', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      expect(repo.findByDeviceId).toHaveBeenCalledTimes(1);
      expect(repo.findByDeviceId.mock.calls[0][0].toString()).toBe(
        VALID_DEVICE_UUID
      );
    });

    it('should call save exactly once to persist the new PollingConfiguration', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should save a PollingConfiguration instance', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      const saved = repo.save.mock.calls[0][0];
      expect(saved).toBeInstanceOf(PollingConfiguration);
    });

    it('should save a config that is enabled', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      const saved = repo.save.mock.calls[0][0];
      expect(saved.enabled).toBe(true);
    });

    it('should save a config with the IP address from the event', async () => {
      const eventIp = makeIPAddress('192.168.5.10');
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(
        makeEvent({ monitoringEnabled: true, ipAddress: eventIp })
      );

      const saved = repo.save.mock.calls[0][0];
      expect(saved.ipAddress?.toString()).toBe('192.168.5.10');
    });

    it('should save a config with a default polling interval', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      const saved = repo.save.mock.calls[0][0];
      expect(saved.interval.seconds).toBe(
        PollingInterval.createDefault().seconds
      );
    });

    it('should save a config with a default failure threshold', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      const saved = repo.save.mock.calls[0][0];
      expect(saved.failuresBeforeDown.value).toBe(
        FailureThreshold.createDefault().value
      );
    });

    it('should also create a config when findByDeviceId returns a failure result', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.fail('DB read error'));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('handle — monitoring enabled with an existing config (re-enable)', () => {
    it('should call enable() and save the existing config', async () => {
      const config = makeConfig({ enabled: false });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      expect(config.enabled).toBe(true);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(config);
    });

    it('should update the IP address when the event carries a new one', async () => {
      const config = makeConfig({ enabled: false, ipAddress: '10.0.0.1' });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const newIp = makeIPAddress('10.0.0.99');
      await handler.handle(
        makeEvent({ monitoringEnabled: true, ipAddress: newIp })
      );

      expect(config.ipAddress?.toString()).toBe('10.0.0.99');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should not overwrite the IP address when the event carries a falsy ipAddress', async () => {
      const config = makeConfig({ enabled: false, ipAddress: '10.0.0.1' });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      // Exercise the falsy ipAddress branch by stubbing the event getter.
      const event = makeEvent({ monitoringEnabled: true });
      jest.spyOn(event, 'ipAddress', 'get').mockReturnValue(
        null as unknown as IPAddress
      );

      await handler.handle(event);

      expect(config.ipAddress?.toString()).toBe('10.0.0.1');
    });

    it('should save the config even when it was already enabled', async () => {
      const config = makeConfig({ enabled: true });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should not enable or save when neither the config nor the event has an IP address', async () => {
      const config = makeConfig({ enabled: false, ipAddress: null });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));

      const event = makeEvent({ monitoringEnabled: true });
      jest.spyOn(event, 'ipAddress', 'get').mockReturnValue(
        null as unknown as IPAddress
      );

      await handler.handle(event);

      expect(config.enabled).toBe(false);
      expect(repo.save).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('handle — monitoring disabled with an existing config', () => {
    it('should call disable() and save the existing config', async () => {
      const config = makeConfig({ enabled: true });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await handler.handle(
        makeEvent({ monitoringEnabled: false })
      );

      expect(config.enabled).toBe(false);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(config);
    });

    it('should persist the config with enabled=false after disabling', async () => {
      const config = makeConfig({ enabled: true });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await handler.handle(makeEvent({ monitoringEnabled: false }));

      const savedConfig = repo.save.mock.calls[0][0];
      expect(savedConfig.enabled).toBe(false);
    });
  });

  describe('handle — monitoring disabled with no existing config', () => {
    it('should not call save when findByDeviceId returns null and monitoring is disabled', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));

      await handler.handle(makeEvent({ monitoringEnabled: false }));

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should not call save when findByDeviceId returns a failure and monitoring is disabled', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.fail('DB error'));

      await handler.handle(makeEvent({ monitoringEnabled: false }));

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('handle — PollingConfiguration.create failure during first-time creation', () => {
    it('should not call save and should log an error when PollingConfiguration.create fails', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const createSpy = jest
        .spyOn(PollingConfiguration, 'create')
        .mockReturnValueOnce(Result.fail('Simulated creation failure'));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      expect(repo.save).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);

      createSpy.mockRestore();
    });

    it('should log the device ID when PollingConfiguration.create fails', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const createSpy = jest
        .spyOn(PollingConfiguration, 'create')
        .mockReturnValueOnce(Result.fail('Simulated creation failure'));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      const context = (logger.error as jest.Mock).mock.calls[0][2] as {
        deviceId: string;
      };
      expect(context.deviceId).toBe(VALID_DEVICE_UUID);

      createSpy.mockRestore();
    });
  });

  describe('handle — error resilience', () => {
    it('should not throw when findByDeviceId rejects unexpectedly', async () => {
      repo.findByDeviceId.mockRejectedValue(new Error('DB crash'));

      await expect(
        handler.handle(makeEvent({ monitoringEnabled: true }))
      ).resolves.toBeUndefined();
    });

    it('should not throw when save rejects unexpectedly', async () => {
      const config = makeConfig({ enabled: false });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockRejectedValue(new Error('Disk full'));

      await expect(
        handler.handle(makeEvent({ monitoringEnabled: true }))
      ).resolves.toBeUndefined();
    });

    it('should log the error when an unexpected exception is thrown', async () => {
      repo.findByDeviceId.mockRejectedValue(new Error('Network timeout'));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should include the device ID in the error log payload when an exception is thrown', async () => {
      repo.findByDeviceId.mockRejectedValue(new Error('Fatal error'));

      await handler.handle(makeEvent({ monitoringEnabled: true }));

      const context = (logger.error as jest.Mock).mock.calls[0][2] as {
        deviceId: string;
      };
      expect(context.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should include the monitoringEnabled flag in the error log payload', async () => {
      repo.findByDeviceId.mockRejectedValue(new Error('Fatal error'));

      await handler.handle(makeEvent({ monitoringEnabled: false }));

      const context = (logger.error as jest.Mock).mock.calls[0][2] as {
        monitoringEnabled: boolean;
      };
      expect(context.monitoringEnabled).toBe(false);
    });

    it('should not throw when save rejects during first-time config creation', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));
      repo.save.mockRejectedValue(new Error('Transaction rolled back'));

      await expect(
        handler.handle(makeEvent({ monitoringEnabled: true }))
      ).resolves.toBeUndefined();
    });
  });
});
