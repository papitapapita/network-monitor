// Source: src/application/device-monitoring/use-cases/CreateDevicePollingUseCase.ts

import { CreateDevicePollingUseCase } from '../../../../src/application/device-monitoring/use-cases/CreateDevicePollingUseCase';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { CreateDevicePollingDTO } from '../../../../src/application/device-monitoring/dtos/CreateDevicePollingDTO';
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

function makeDeviceRepo(): jest.Mocked<
  Pick<IDeviceRepository, 'exists'>
> {
  return { exists: jest.fn() };
}

function makeConfig(
  overrides: {
    enabled?: boolean;
    intervalSeconds?: number;
    thresholdCount?: number;
    ipAddress?: string | null;
  } = {}
): PollingConfiguration {
  const rawIp =
    overrides.ipAddress !== undefined
      ? overrides.ipAddress
      : '10.0.0.1';
  return PollingConfiguration.reconstitute(
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value,
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      ipAddress:
        rawIp !== null ? IPAddress.reconstitute(rawIp) : null,
      interval: PollingInterval.create(
        overrides.intervalSeconds ?? 60
      ).value,
      failuresBeforeDown: FailureThreshold.create(
        overrides.thresholdCount ?? 3
      ).value,
      enabled:
        overrides.enabled !== undefined ? overrides.enabled : true
    }
  );
}

function makeRequest(
  overrides: Partial<CreateDevicePollingDTO> = {}
): CreateDevicePollingDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('CreateDevicePollingUseCase', () => {
  let pollingConfigRepo: jest.Mocked<IPollingConfigurationRepository>;
  let deviceRepo: jest.Mocked<Pick<IDeviceRepository, 'exists'>>;
  let logger: ILogger;
  let useCase: CreateDevicePollingUseCase;

  beforeEach(() => {
    pollingConfigRepo = makeRepo();
    deviceRepo = makeDeviceRepo();
    logger = makeLogger();
    useCase = new CreateDevicePollingUseCase(
      pollingConfigRepo,
      deviceRepo as unknown as IDeviceRepository,
      {
        execute: jest.fn().mockResolvedValue(Result.ok(undefined))
      } as unknown as SuspendDeviceMonitoringUseCase,
      logger
    );
    deviceRepo.exists.mockResolvedValue(Result.ok(true));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — input validation', () => {
    it('should fail when deviceId is an empty string', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid Device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — device existence check', () => {
    it('should fail when deviceRepo.exists returns a failure', async () => {
      deviceRepo.exists.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });

    it('should fail with Device not found when deviceRepo.exists returns false', async () => {
      deviceRepo.exists.mockResolvedValue(Result.ok(false));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
    });

    it('should not call pollingConfigRepo.findByDeviceId when device does not exist', async () => {
      deviceRepo.exists.mockResolvedValue(Result.ok(false));

      await useCase.execute(makeRequest());

      expect(pollingConfigRepo.findByDeviceId).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — repository interactions', () => {
    it('should fail when pollingConfigRepo.findByDeviceId returns a failure', async () => {
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load config');
    });

    it('should fail when save returns a failure in the CREATE branch', async () => {
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );
      pollingConfigRepo.save.mockResolvedValue(
        Result.fail('Constraint violation')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save config');
    });

    it('should fail when save returns a failure in the UPDATE branch', async () => {
      const config = makeConfig();
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(
        Result.fail('Constraint violation')
      );

      const result = await useCase.execute(
        makeRequest({ intervalSeconds: 120 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save config');
    });
  });

  // ===========================================================================
  describe('executeImpl — CREATE branch (no existing config)', () => {
    beforeEach(() => {
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );
      pollingConfigRepo.save.mockImplementation(async (cfg) =>
        Result.ok(cfg)
      );
    });

    it('should create a config with defaults when no optional fields are provided', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.intervalSeconds).toBe(60);
      expect(result.value.failuresBeforeDown).toBe(3);
      expect(result.value.enabled).toBe(false);
      expect(result.value.ipAddress).toBeNull();
    });

    it('should reject an explicit enabled:true when no ipAddress is provided', async () => {
      const result = await useCase.execute(
        makeRequest({ enabled: true })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address');
    });

    it('should create an enabled config when an ipAddress is provided', async () => {
      const result = await useCase.execute(
        makeRequest({ ipAddress: '192.168.1.10' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.enabled).toBe(true);
    });

    it('should create a config with provided intervalSeconds', async () => {
      const result = await useCase.execute(
        makeRequest({ intervalSeconds: 120 })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.intervalSeconds).toBe(120);
    });

    it('should create a config with provided failuresBeforeDown', async () => {
      const result = await useCase.execute(
        makeRequest({ failuresBeforeDown: 5 })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.failuresBeforeDown).toBe(5);
    });

    it('should create a config with provided ipAddress', async () => {
      const result = await useCase.execute(
        makeRequest({ ipAddress: '192.168.1.10' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.ipAddress).toBe('192.168.1.10');
    });

    it('should create a config with enabled=false when provided', async () => {
      const result = await useCase.execute(
        makeRequest({ enabled: false })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.enabled).toBe(false);
    });

    it('should fail when intervalSeconds is invalid (0)', async () => {
      const result = await useCase.execute(
        makeRequest({ intervalSeconds: 0 })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail when failuresBeforeDown is 0', async () => {
      const result = await useCase.execute(
        makeRequest({ failuresBeforeDown: 0 })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail when failuresBeforeDown exceeds the maximum', async () => {
      const result = await useCase.execute(
        makeRequest({ failuresBeforeDown: 101 })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail when ipAddress is an invalid IP string', async () => {
      const result = await useCase.execute(
        makeRequest({ ipAddress: 'not-an-ip' })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should return a PollingConfigurationDTO with correct fields on success', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(typeof result.value.id).toBe('string');
      expect(result.value.id.length).toBeGreaterThan(0);
      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should call pollingConfigRepo.save exactly once', async () => {
      await useCase.execute(makeRequest());

      expect(pollingConfigRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — UPDATE branch (config already exists)', () => {
    it('should update interval when intervalSeconds is provided', async () => {
      const config = makeConfig({ intervalSeconds: 60 });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ intervalSeconds: 300 })
      );

      expect(result.isSuccess).toBe(true);
      expect(config.interval.seconds).toBe(300);
    });

    it('should update threshold when failuresBeforeDown is provided', async () => {
      const config = makeConfig({ thresholdCount: 3 });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ failuresBeforeDown: 10 })
      );

      expect(result.isSuccess).toBe(true);
      expect(config.failuresBeforeDown.value).toBe(10);
    });

    it('should enable polling when enabled=true is provided', async () => {
      const config = makeConfig({ enabled: false });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ enabled: true })
      );

      expect(result.isSuccess).toBe(true);
      expect(config.enabled).toBe(true);
    });

    it('should disable polling when enabled=false is provided', async () => {
      const config = makeConfig({ enabled: true });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ enabled: false })
      );

      expect(result.isSuccess).toBe(true);
      expect(config.enabled).toBe(false);
    });

    it('should update ipAddress when a non-null string is provided', async () => {
      const config = makeConfig({ ipAddress: '10.0.0.1' });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(
        makeRequest({ ipAddress: '192.168.1.99' })
      );

      expect(config.ipAddress?.value).toBe('192.168.1.99');
    });

    it('should set ipAddress to null when ipAddress is explicitly null on a disabled config', async () => {
      const config = makeConfig({
        ipAddress: '10.0.0.1',
        enabled: false
      });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ ipAddress: null }));

      expect(config.ipAddress).toBeNull();
    });

    it('should clear the ipAddress when the same request also disables polling', async () => {
      const config = makeConfig({
        ipAddress: '10.0.0.1',
        enabled: true
      });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ ipAddress: null, enabled: false })
      );

      expect(result.isSuccess).toBe(true);
      expect(config.ipAddress).toBeNull();
      expect(config.enabled).toBe(false);
    });

    it('should fail when clearing the ipAddress of an enabled config', async () => {
      const config = makeConfig({
        ipAddress: '10.0.0.1',
        enabled: true
      });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ ipAddress: null })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address');
      expect(pollingConfigRepo.save).not.toHaveBeenCalled();
    });

    it('should not update interval when intervalSeconds is absent', async () => {
      const config = makeConfig({ intervalSeconds: 60 });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ failuresBeforeDown: 5 }));

      expect(config.interval.seconds).toBe(60);
    });

    it('should not update threshold when failuresBeforeDown is absent', async () => {
      const config = makeConfig({ thresholdCount: 3 });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ intervalSeconds: 120 }));

      expect(config.failuresBeforeDown.value).toBe(3);
    });

    it('should not mutate enabled when enabled is absent', async () => {
      const config = makeConfig({ enabled: true });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      await useCase.execute(makeRequest({ intervalSeconds: 120 }));

      expect(config.enabled).toBe(true);
    });

    it('should not update ipAddress when the ipAddress key is absent from the request', async () => {
      const config = makeConfig({ ipAddress: '10.0.0.1' });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      // Request has no 'ipAddress' key at all
      await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        intervalSeconds: 120
      });

      expect(config.ipAddress?.value).toBe('10.0.0.1');
    });

    it('should apply all fields in a single combined request', async () => {
      const config = makeConfig({
        intervalSeconds: 60,
        thresholdCount: 3,
        enabled: false,
        ipAddress: '10.0.0.1'
      });
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({
          intervalSeconds: 300,
          failuresBeforeDown: 7,
          enabled: true,
          ipAddress: '172.16.0.5'
        })
      );

      expect(result.isSuccess).toBe(true);
      expect(config.interval.seconds).toBe(300);
      expect(config.failuresBeforeDown.value).toBe(7);
      expect(config.enabled).toBe(true);
      expect(config.ipAddress?.value).toBe('172.16.0.5');
    });

    it('should return a PollingConfigurationDTO on success', async () => {
      const config = makeConfig();
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(config)
      );
      pollingConfigRepo.save.mockResolvedValue(Result.ok(config));

      const result = await useCase.execute(
        makeRequest({ intervalSeconds: 120 })
      );

      expect(result.isSuccess).toBe(true);
      expect(typeof result.value.id).toBe('string');
      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });
  });
});
