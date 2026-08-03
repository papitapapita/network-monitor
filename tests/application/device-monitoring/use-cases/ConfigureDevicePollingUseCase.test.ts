// Source: src/application/device-monitoring/use-cases/ConfigureDevicePollingUseCase.ts

import { ConfigureDevicePollingUseCase } from '../../../../src/application/device-monitoring/use-cases/ConfigureDevicePollingUseCase';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { ConfigureDevicePollingDTO } from '../../../../src/application/device-monitoring/dtos/ConfigureDevicePollingDTO';
import { SuspendDeviceMonitoringUseCase } from '../../../../src/application/device-monitoring/use-cases/SuspendDeviceMonitoringUseCase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
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

function makeConfig(
  overrides: {
    enabled?: boolean;
    intervalSeconds?: number;
    thresholdCount?: number;
    ipAddress?: string | null;
  } = {}
): PollingConfiguration {
  const rawIp = overrides.ipAddress !== undefined ? overrides.ipAddress : '10.0.0.1';
  return PollingConfiguration.create(
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      ipAddress: rawIp !== null ? IPAddress.reconstitute(rawIp) : null,
      interval: PollingInterval.create(overrides.intervalSeconds ?? 60).value,
      failuresBeforeDown: FailureThreshold.create(overrides.thresholdCount ?? 3).value,
      enabled: overrides.enabled !== undefined ? overrides.enabled : true
    },
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value
  ).value;
}

function makeRequest(
  overrides: Partial<ConfigureDevicePollingDTO> = {}
): ConfigureDevicePollingDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('ConfigureDevicePollingUseCase', () => {
  let repo: jest.Mocked<IPollingConfigurationRepository>;
  let logger: ILogger;
  let suspend: jest.Mocked<SuspendDeviceMonitoringUseCase>;
  let useCase: ConfigureDevicePollingUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    suspend = {
      execute: jest.fn().mockResolvedValue(Result.ok(undefined))
    } as unknown as jest.Mocked<SuspendDeviceMonitoringUseCase>;
    useCase = new ConfigureDevicePollingUseCase(repo, suspend, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — input validation', () => {
    it('should fail when deviceId is an empty string', async () => {
      const result = await useCase.execute(makeRequest({ deviceId: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute(makeRequest({ deviceId: '   ' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(makeRequest({ deviceId: 'not-a-uuid' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid Device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — repository interactions', () => {
    it('should fail when the repository returns a failure', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.fail('DB connection lost'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load config');
    });

    it('should fail when no config is found for the given device', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('No polling configuration found');
    });

    it('should call findByDeviceId with the parsed DeviceId', async () => {
      repo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      repo.save.mockResolvedValue(Result.ok(makeConfig()));

      await useCase.execute(makeRequest());

      expect(repo.findByDeviceId).toHaveBeenCalledTimes(1);
      expect(repo.findByDeviceId.mock.calls[0][0].toString()).toBe(
        VALID_DEVICE_UUID
      );
    });

    it('should save the updated config after successful changes', async () => {
      const config = makeConfig({ intervalSeconds: 60 });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ intervalSeconds: 120 }));

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should fail when save returns a failure', async () => {
      const config = makeConfig();
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.fail('Constraint violation'));

      const result = await useCase.execute(makeRequest({ intervalSeconds: 120 }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save config');
    });
  });

  // ===========================================================================
  describe('executeImpl — interval update', () => {
    it('should succeed and update the interval when intervalSeconds is provided', async () => {
      const config = makeConfig({ intervalSeconds: 60 });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(makeRequest({ intervalSeconds: 300 }));

      expect(result.isSuccess).toBe(true);
      expect(config.interval.seconds).toBe(300);
    });

    it('should fail when intervalSeconds is invalid (below minimum)', async () => {
      const config = makeConfig();
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(makeRequest({ intervalSeconds: 0 }));

      expect(result.isFailure).toBe(true);
    });

    it('should not update the interval when intervalSeconds is not provided', async () => {
      const config = makeConfig({ intervalSeconds: 60 });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ failuresBeforeDown: 5 }));

      expect(config.interval.seconds).toBe(60);
    });
  });

  // ===========================================================================
  describe('executeImpl — failure threshold update', () => {
    it('should succeed and update the threshold when failuresBeforeDown is provided', async () => {
      const config = makeConfig({ thresholdCount: 3 });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ failuresBeforeDown: 10 })
      );

      expect(result.isSuccess).toBe(true);
      expect(config.failuresBeforeDown.value).toBe(10);
    });

    it('should fail when failuresBeforeDown is invalid (float)', async () => {
      const config = makeConfig();
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ failuresBeforeDown: 2.5 })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail when failuresBeforeDown exceeds the maximum', async () => {
      const config = makeConfig();
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ failuresBeforeDown: 101 })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should not update the threshold when failuresBeforeDown is not provided', async () => {
      const config = makeConfig({ thresholdCount: 3 });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ intervalSeconds: 120 }));

      expect(config.failuresBeforeDown.value).toBe(3);
    });
  });

  // ===========================================================================
  describe('executeImpl — enabled flag update', () => {
    it('should enable the config when enabled is true', async () => {
      const config = makeConfig({ enabled: false });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(makeRequest({ enabled: true }));

      expect(result.isSuccess).toBe(true);
      expect(config.enabled).toBe(true);
    });

    it('[MON-002] should delegate to SuspendDeviceMonitoringUseCase when enabled is false', async () => {
      const config = makeConfig({ enabled: true });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(makeRequest({ enabled: false }));

      expect(result.isSuccess).toBe(true);
      expect(suspend.execute).toHaveBeenCalledTimes(1);
      expect(suspend.execute.mock.calls[0][0].toString()).toBe(
        VALID_DEVICE_UUID
      );
    });

    it('[MON-002] should not disable the config itself — one writer owns the transition', async () => {
      const config = makeConfig({ enabled: true });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ enabled: false }));

      // the suspension performs the disable; this use case must not pre-empt it
      expect(config.enabled).toBe(true);
    });

    it('should fail when the suspension fails', async () => {
      const config = makeConfig({ enabled: true });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));
      suspend.execute.mockResolvedValue(Result.fail('alert store down'));

      const result = await useCase.execute(makeRequest({ enabled: false }));

      expect(result.isFailure).toBe(true);
    });

    it('should not suspend when enabled is true', async () => {
      const config = makeConfig({ enabled: false });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ enabled: true }));

      expect(suspend.execute).not.toHaveBeenCalled();
    });

    it('should not mutate enabled when enabled is not provided in the request', async () => {
      const config = makeConfig({ enabled: true });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ intervalSeconds: 120 }));

      expect(config.enabled).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — combined updates', () => {
    it('should apply all three changes in a single request', async () => {
      const config = makeConfig({
        intervalSeconds: 60,
        thresholdCount: 3,
        enabled: false
      });
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({
          intervalSeconds: 300,
          failuresBeforeDown: 5,
          enabled: true
        })
      );

      expect(result.isSuccess).toBe(true);
      expect(config.interval.seconds).toBe(300);
      expect(config.failuresBeforeDown.value).toBe(5);
      expect(config.enabled).toBe(true);
    });

    it('should succeed when no optional fields are provided — no-op update', async () => {
      const config = makeConfig();
      repo.findByDeviceId.mockResolvedValue(Result.ok(config));
      repo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });
  });
});
