// Source: src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase.ts

import { ExecutePollingCycleUseCase } from '../../../../src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { IPingResultRepository } from '../../../../src/domain/device-monitoring/repository/IPingResultRepository';
import { IDeviceStateRepository } from '../../../../src/domain/device-monitoring/repository/IDeviceStateRepository';
import { IPingService } from '../../../../src/application/device-monitoring/interfaces/IPingService';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { ExecutePollingCycleDTO } from '../../../../src/application/device-monitoring/dtos/ExecutePollingCycleDTO';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_IP = '192.168.1.50';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

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

function makePollingConfigRepo(): jest.Mocked<IPollingConfigurationRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    delete: jest.fn()
  };
}

function makePingResultRepo(): jest.Mocked<IPingResultRepository> {
  return {
    save: jest.fn(),
    findLatestByDevice: jest.fn(),
    findByDevice: jest.fn()
  };
}

function makeDeviceStateRepo(): jest.Mocked<IDeviceStateRepository> {
  return {
    findByDeviceId: jest.fn(),
    save: jest.fn()
  };
}

function makePingService(): jest.Mocked<IPingService> {
  return {
    ping: jest.fn()
  };
}

function makeConfig(
  overrides: {
    enabled?: boolean;
    ipAddress?: string | null;
    thresholdCount?: number;
  } = {}
): PollingConfiguration {
  const rawIp = overrides.ipAddress !== undefined ? overrides.ipAddress : TEST_IP;
  return PollingConfiguration.create(
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      ipAddress: rawIp !== null ? IPAddress.reconstitute(rawIp) : null,
      interval: PollingInterval.create(60).value,
      failuresBeforeDown: FailureThreshold.create(overrides.thresholdCount ?? 3).value,
      enabled: overrides.enabled !== undefined ? overrides.enabled : true
    },
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value
  ).value;
}

function makeDeviceState(
  overrides: Partial<DeviceStateProps> = {}
): DeviceState {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const props: DeviceStateProps = {
    deviceId,
    isOnline: true,
    lastSeen: FIXED_DATE,
    lastLatencyMs: 12,
    consecutiveFailures: 0,
    lastCheckedAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides
  };
  return DeviceState.reconstitute(props, deviceId);
}

function makeRequest(
  overrides: Partial<ExecutePollingCycleDTO> = {}
): ExecutePollingCycleDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('ExecutePollingCycleUseCase', () => {
  let configRepo: jest.Mocked<IPollingConfigurationRepository>;
  let pingResultRepo: jest.Mocked<IPingResultRepository>;
  let deviceStateRepo: jest.Mocked<IDeviceStateRepository>;
  let pingService: jest.Mocked<IPingService>;
  let logger: ILogger;
  let useCase: ExecutePollingCycleUseCase;

  beforeEach(() => {
    configRepo = makePollingConfigRepo();
    pingResultRepo = makePingResultRepo();
    deviceStateRepo = makeDeviceStateRepo();
    pingService = makePingService();
    logger = makeLogger();
    useCase = new ExecutePollingCycleUseCase(
      configRepo,
      pingResultRepo,
      deviceStateRepo,
      pingService,
      logger,
      0 // no delay between retries in tests
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — input validation', () => {
    it('should fail when deviceId is an empty string', async () => {
      const result = await useCase.execute(makeRequest({ deviceId: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Network device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute(makeRequest({ deviceId: '  ' }));

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(makeRequest({ deviceId: 'not-a-uuid' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — polling config lookup', () => {
    it('should fail when the config repository returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load polling config');
    });

    it('should fail when no config exists for the device', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('No polling configuration found');
    });
  });

  // ===========================================================================
  describe('executeImpl — disabled polling (no forceExecution)', () => {
    it('should return SKIPPED when polling is disabled and forceExecution is false', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      const result = await useCase.execute(makeRequest({ forceExecution: false }));

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('SKIPPED');
    });

    it('should return SKIPPED when polling is disabled and forceExecution is omitted', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('SKIPPED');
    });

    it('should not call pingService when polling is skipped', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      await useCase.execute(makeRequest());

      expect(pingService.ping).not.toHaveBeenCalled();
    });

    it('should include the device ID in the skipped result', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });
  });

  // ===========================================================================
  describe('executeImpl — forceExecution overrides disabled state', () => {
    it('should proceed with ping when forceExecution is true even if polling is disabled', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 10 })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      deviceStateRepo.save.mockResolvedValue(Result.ok(makeDeviceState()));

      const result = await useCase.execute(
        makeRequest({ forceExecution: true })
      );

      expect(result.isSuccess).toBe(true);
      expect(pingService.ping).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — missing IP address', () => {
    it('should fail when the config has no IP address', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ ipAddress: null }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('no IP address');
    });

    it('should not call pingService when IP address is missing', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ ipAddress: null }))
      );

      await useCase.execute(makeRequest());

      expect(pingService.ping).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — ping execution', () => {
    it('should fail when the ping service returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      pingService.ping.mockResolvedValue(Result.fail('ICMP timeout'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ping execution error');
    });

    it('should call pingService.ping with the config IP address', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ ipAddress: TEST_IP }))
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 8 })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      deviceStateRepo.save.mockResolvedValue(Result.ok(makeDeviceState()));

      await useCase.execute(makeRequest());

      expect(pingService.ping).toHaveBeenCalledWith(TEST_IP);
    });
  });

  // ===========================================================================
  describe('executeImpl — successful ping result', () => {
    beforeEach(() => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 15 })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: true, consecutiveFailures: 0 }))
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: true, consecutiveFailures: 0 }))
      );
    });

    it('should return SUCCESS status when device is reachable', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('SUCCESS');
    });

    it('should return ONLINE deviceStatus when device is reachable', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.deviceStatus).toBe('ONLINE');
    });

    it('should include latencyMs in the metrics when reachable', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.metrics).not.toBeNull();
      expect(result.value.metrics!.latencyMs).toBe(15);
    });

    it('should include the device ID in the result', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should persist the ping result via pingResultRepo.save', async () => {
      await useCase.execute(makeRequest());

      expect(pingResultRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should save the device state after a successful ping', async () => {
      await useCase.execute(makeRequest());

      expect(deviceStateRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should reset consecutiveFailures to 0 on a successful ping', async () => {
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ consecutiveFailures: 2 }))
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState = deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.consecutiveFailures).toBe(0);
    });
  });

  // ===========================================================================
  describe('executeImpl — failed ping result', () => {
    it('should return FAILED status when all retries are unreachable', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: false, latencyMs: null })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: false, consecutiveFailures: 1 }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('FAILED');
    });

    it('should return null metrics when all retries are unreachable', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: false, latencyMs: null })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: false }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.metrics).toBeNull();
    });

    it('should increment consecutiveFailures when all ping retries fail', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig({ thresholdCount: 3 })));
      pingService.ping
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }))
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }))
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }));
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ consecutiveFailures: 1 }))
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState({ consecutiveFailures: 2 }))
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState = deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.consecutiveFailures).toBe(2);
    });

    it('should mark device OFFLINE after all retries fail (threshold = ping attempts)', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ thresholdCount: 3 }))
      );
      pingService.ping
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }))
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }))
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }));
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: true, consecutiveFailures: 0 }))
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: false, consecutiveFailures: 1 }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.deviceStatus).toBe('OFFLINE');
      expect(pingService.ping).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying after the first successful ping and use that latency', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ thresholdCount: 3 }))
      );
      pingService.ping
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }))
        .mockResolvedValueOnce(Result.ok({ isReachable: true, latencyMs: 22 }));
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: false, consecutiveFailures: 1 }))
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: true, consecutiveFailures: 0 }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.deviceStatus).toBe('ONLINE');
      expect(result.value.metrics!.latencyMs).toBe(22);
      expect(pingService.ping).toHaveBeenCalledTimes(2);
    });

    it('should treat no existing device state as 0 previous failures', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ thresholdCount: 3 }))
      );
      pingService.ping
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }))
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }))
        .mockResolvedValueOnce(Result.ok({ isReachable: false, latencyMs: null }));
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: false, consecutiveFailures: 1 }))
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState = deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.consecutiveFailures).toBe(1);
    });
  });
});
