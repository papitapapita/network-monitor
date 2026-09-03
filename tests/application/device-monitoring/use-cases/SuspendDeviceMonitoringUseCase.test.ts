// Source: src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase.ts

import { SuspendDeviceMonitoringUseCase } from '../../../../src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { IDeviceStateRepository } from '../../../../src/domain/device-monitoring/repository/IDeviceStateRepository';
import { ResolveAlertUseCase } from '../../../../src/application/notifications/use-cases/ResolveAlertUseCase';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';
import { ReachabilityStatus } from '../../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeConfigRepo(): jest.Mocked<IPollingConfigurationRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    delete: jest.fn()
  };
}

function makeStateRepo(): jest.Mocked<IDeviceStateRepository> {
  return {
    findByDeviceId: jest.fn(),
    findOverdueDown: jest.fn(),
    save: jest.fn()
  };
}

function makeResolveAlert(): jest.Mocked<ResolveAlertUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(Result.ok(undefined))
  } as unknown as jest.Mocked<ResolveAlertUseCase>;
}

function makeState(
  overrides: Partial<DeviceStateProps> = {}
): DeviceState {
  const deviceId = makeDeviceId();
  return DeviceState.reconstitute(deviceId, {
    deviceId,
    status: ReachabilityStatus.createUp(),
    lastSeen: FIXED_DATE,
    lastLatencyMs: 20,
    consecutiveFailures: 0,
    lastCheckedAt: FIXED_DATE,
    downSince: null,
    updatedAt: FIXED_DATE,
    ...overrides
  });
}

function makeConfig(enabled = true): PollingConfiguration {
  return PollingConfiguration.reconstitute(
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value,
    {
      deviceId: makeDeviceId(),
      ipAddress: IPAddress.reconstitute('10.0.0.1'),
      interval: PollingInterval.create(60).value,
      failuresBeforeDown: FailureThreshold.create(3).value,
      enabled
    }
  );
}

// ---------------------------------------------------------------------------

describe('SuspendDeviceMonitoringUseCase', () => {
  let configRepo: jest.Mocked<IPollingConfigurationRepository>;
  let stateRepo: jest.Mocked<IDeviceStateRepository>;
  let resolveAlert: jest.Mocked<ResolveAlertUseCase>;
  let useCase: SuspendDeviceMonitoringUseCase;

  beforeEach(() => {
    configRepo = makeConfigRepo();
    stateRepo = makeStateRepo();
    resolveAlert = makeResolveAlert();
    useCase = new SuspendDeviceMonitoringUseCase(
      configRepo,
      stateRepo,
      resolveAlert
    );

    stateRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makeState())
    );
    stateRepo.save.mockImplementation((s) =>
      Promise.resolve(Result.ok(s))
    );
    configRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makeConfig())
    );
    configRepo.save.mockImplementation((c) =>
      Promise.resolve(Result.ok(c))
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('the device state', () => {
    it('[MON-002] should mark the state UNKNOWN', async () => {
      const state = makeState({
        status: ReachabilityStatus.createDown()
      });
      stateRepo.findByDeviceId.mockResolvedValue(Result.ok(state));

      await useCase.execute(makeDeviceId());

      expect(state.status.isUnknown()).toBe(true);
      expect(stateRepo.save).toHaveBeenCalledWith(state);
    });

    it('[MON-002] should keep lastSeen so the pause does not erase history', async () => {
      const state = makeState({ lastSeen: FIXED_DATE });
      stateRepo.findByDeviceId.mockResolvedValue(Result.ok(state));

      await useCase.execute(makeDeviceId());

      expect(state.lastSeen).toEqual(FIXED_DATE);
    });

    it('[MON-002] should not create a state row for a device that was never polled', async () => {
      stateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeDeviceId());

      expect(result.isSuccess).toBe(true);
      expect(stateRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when the state cannot be loaded', async () => {
      stateRepo.findByDeviceId.mockResolvedValue(
        Result.fail('DB down')
      );

      const result = await useCase.execute(makeDeviceId());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load device state');
    });

    it('should fail when the state cannot be saved', async () => {
      stateRepo.save.mockResolvedValue(Result.fail('write conflict'));

      const result = await useCase.execute(makeDeviceId());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save device state');
    });
  });

  // ===========================================================================
  describe('the open availability alert', () => {
    it('[MON-003] should resolve the open device_unreachable alert', async () => {
      await useCase.execute(makeDeviceId());

      expect(resolveAlert.execute).toHaveBeenCalledTimes(1);
      expect(resolveAlert.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: VALID_DEVICE_UUID,
          type: 'device_unreachable'
        })
      );
    });

    it('should fail when the alert cannot be resolved', async () => {
      resolveAlert.execute.mockResolvedValue(
        Result.fail('alert store down')
      );

      const result = await useCase.execute(makeDeviceId());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to resolve open alert');
    });
  });

  // ===========================================================================
  describe('the polling configuration', () => {
    it('should disable polling', async () => {
      const config = makeConfig(true);
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeDeviceId());

      expect(config.enabled).toBe(false);
      expect(configRepo.save).toHaveBeenCalledWith(config);
    });

    it('should be a no-op when polling is already disabled', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig(false))
      );

      const result = await useCase.execute(makeDeviceId());

      expect(result.isSuccess).toBe(true);
      expect(configRepo.save).not.toHaveBeenCalled();
    });

    it('should succeed when the device has no polling configuration', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeDeviceId());

      expect(result.isSuccess).toBe(true);
      expect(configRepo.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('write ordering — the substitute for a transaction', () => {
    it('should disable the configuration only after the state and alert are handled', async () => {
      const order: string[] = [];
      stateRepo.save.mockImplementation((s) => {
        order.push('state');
        return Promise.resolve(Result.ok(s));
      });
      resolveAlert.execute.mockImplementation(() => {
        order.push('alert');
        return Promise.resolve(Result.ok(undefined));
      });
      configRepo.save.mockImplementation((c) => {
        order.push('config');
        return Promise.resolve(Result.ok(c));
      });

      await useCase.execute(makeDeviceId());

      expect(order).toEqual(['state', 'alert', 'config']);
    });

    it('should leave polling enabled when the state write fails, so the next poll self-heals', async () => {
      const config = makeConfig(true);
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(config));
      stateRepo.save.mockResolvedValue(Result.fail('write conflict'));

      await useCase.execute(makeDeviceId());

      expect(config.enabled).toBe(true);
      expect(configRepo.save).not.toHaveBeenCalled();
    });

    it('should leave polling enabled when the alert write fails', async () => {
      const config = makeConfig(true);
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(config));
      resolveAlert.execute.mockResolvedValue(
        Result.fail('alert store down')
      );

      await useCase.execute(makeDeviceId());

      expect(config.enabled).toBe(true);
      expect(configRepo.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('idempotency', () => {
    it('should succeed when run twice over an already-suspended device', async () => {
      const state = makeState({
        status: ReachabilityStatus.createUnknown()
      });
      stateRepo.findByDeviceId.mockResolvedValue(Result.ok(state));
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig(false))
      );

      const first = await useCase.execute(makeDeviceId());
      const second = await useCase.execute(makeDeviceId());

      expect(first.isSuccess).toBe(true);
      expect(second.isSuccess).toBe(true);
      expect(state.status.isUnknown()).toBe(true);
    });
  });
});
