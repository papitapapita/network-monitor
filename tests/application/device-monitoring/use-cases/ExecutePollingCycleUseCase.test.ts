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
import { ReachabilityStatus } from '../../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { ExecutePollingCycleDTO } from '../../../../src/application/device-monitoring/dtos/ExecutePollingCycleDTO';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import {
  Device,
  DeviceEligibilityService,
  DeviceName,
  DeviceOwnerType,
  DeviceStatus,
  SerialNumber
} from '../../../../src/domain/device-inventory';
import { DeviceModelId } from '../../../../src/domain/shared';

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
    findByDevice: jest.fn(),
    deleteOlderThan: jest.fn(),

    deleteByDevice: jest.fn()
  };
}

function makeDeviceStateRepo(): jest.Mocked<IDeviceStateRepository> {
  return {
    findByDeviceId: jest.fn(),
    save: jest.fn()
  };
}

// The eligibility service is pure, so the real one is used rather than a
// mock — only the device it reads is faked.
function makeDevice(
  overrides: Partial<Parameters<typeof Device.reconstitute>[1]> = {}
): Device {
  return Device.reconstitute(
    DeviceId.parse(VALID_DEVICE_UUID).value,
    {
      deviceModelId: DeviceModelId.create(),
      name: DeviceName.create('Core-Router-01').value,
      status: DeviceStatus.createActive(),
      ownerType: DeviceOwnerType.COMPANY,
      locationId: null,
      category: null,
      serialNumber: SerialNumber.create('SN-DEFAULT').value,
      macAddress: null,
      ipAddress: null,
      description: null,
      installedDate: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      monitoringEnabled: true,
      ...overrides
    }
  );
}

function makeDeviceRepo(device: Device | null = makeDevice()) {
  return {
    findById: jest.fn().mockResolvedValue(Result.ok(device))
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
  const rawIp =
    overrides.ipAddress !== undefined ? overrides.ipAddress : TEST_IP;
  // reconstitute: legacy rows can still be enabled without an IP, which is
  // exactly the case the scheduler has to defend against
  return PollingConfiguration.reconstitute(
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value,
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      ipAddress:
        rawIp !== null ? IPAddress.reconstitute(rawIp) : null,
      interval: PollingInterval.create(60).value,
      failuresBeforeDown: FailureThreshold.create(
        overrides.thresholdCount ?? 3
      ).value,
      enabled:
        overrides.enabled !== undefined ? overrides.enabled : true
    }
  );
}

function makeDeviceState(
  overrides: Partial<DeviceStateProps> = {}
): DeviceState {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const props: DeviceStateProps = {
    deviceId,
    status: ReachabilityStatus.createUp(),
    lastSeen: FIXED_DATE,
    lastLatencyMs: 12,
    consecutiveFailures: 0,
    lastCheckedAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides
  };
  return DeviceState.reconstitute(deviceId, props);
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
  let deviceRepo: ReturnType<typeof makeDeviceRepo>;
  let logger: ILogger;
  let useCase: ExecutePollingCycleUseCase;

  beforeEach(() => {
    configRepo = makePollingConfigRepo();
    pingResultRepo = makePingResultRepo();
    deviceStateRepo = makeDeviceStateRepo();
    pingService = makePingService();
    deviceRepo = makeDeviceRepo();
    logger = makeLogger();
    useCase = new ExecutePollingCycleUseCase(
      configRepo,
      pingResultRepo,
      deviceStateRepo,
      pingService,
      deviceRepo as unknown as IDeviceRepository,
      new DeviceEligibilityService(),
      logger,
      0 // no delay between retries in tests
    );

    // permissive defaults — individual tests override to assert failures
    configRepo.save.mockResolvedValue(Result.ok(makeConfig()));
    pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
    deviceStateRepo.save.mockResolvedValue(
      Result.ok(makeDeviceState())
    );
    deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
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
      expect(result.error).toContain('Network device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '  ' })
      );

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('[DEV-086] executeImpl — device eligibility', () => {
    function useCaseWithDevice(device: Device | null) {
      return new ExecutePollingCycleUseCase(
        configRepo,
        pingResultRepo,
        deviceStateRepo,
        pingService,
        makeDeviceRepo(device) as unknown as IDeviceRepository,
        new DeviceEligibilityService(),
        logger,
        0
      );
    }

    it('should skip a scheduled poll when the device no longer exists', async () => {
      const result =
        await useCaseWithDevice(null).execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('SKIPPED');
      expect(pingService.ping).not.toHaveBeenCalled();
      expect(configRepo.findByDeviceId).not.toHaveBeenCalled();
    });

    it('should skip a scheduled poll when the device is retired', async () => {
      const retired = makeDevice({
        status: DeviceStatus.createDamaged()
      });

      const result =
        await useCaseWithDevice(retired).execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('SKIPPED');
      expect(pingService.ping).not.toHaveBeenCalled();
    });

    // Same shape as the disabled-monitoring guard: force does not override the
    // check, it just turns the silent skip into an answer the caller can read.
    it('should fail a forced poll of an ineligible device', async () => {
      const result = await useCaseWithDevice(null).execute(
        makeRequest({ forceExecution: true })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('no longer exists');
      expect(pingService.ping).not.toHaveBeenCalled();
    });

    it('should fail when the device lookup itself fails', async () => {
      const broken = new ExecutePollingCycleUseCase(
        configRepo,
        pingResultRepo,
        deviceStateRepo,
        pingService,
        {
          findById: jest
            .fn()
            .mockResolvedValue(Result.fail('DB error'))
        } as unknown as IDeviceRepository,
        new DeviceEligibilityService(),
        logger,
        0
      );

      const result = await broken.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load device');
    });

    it('should poll a COMMISSIONING device', async () => {
      const commissioning = makeDevice({
        status: DeviceStatus.createCommissioning()
      });
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 10 })
      );

      const result =
        await useCaseWithDevice(commissioning).execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(pingService.ping).toHaveBeenCalled();
    });
  });

  describe('executeImpl — polling config lookup', () => {
    it('should fail when the config repository returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.fail('DB error')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load polling config');
    });

    it('should fail when no config exists for the device', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'No polling configuration found'
      );
    });
  });

  // ===========================================================================
  describe('executeImpl — disabled polling (no forceExecution)', () => {
    it('should return SKIPPED when polling is disabled and forceExecution is false', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      const result = await useCase.execute(
        makeRequest({ forceExecution: false })
      );

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
  describe('executeImpl — forceExecution does not override disabled monitoring', () => {
    it('[MON-004] should fail rather than poll a device whose monitoring is off', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      const result = await useCase.execute(
        makeRequest({ forceExecution: true })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Monitoring is disabled');
    });

    it('[MON-004] should not ping a device whose monitoring is off', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      await useCase.execute(makeRequest({ forceExecution: true }));

      expect(pingService.ping).not.toHaveBeenCalled();
    });

    it('[MON-004] should not write device state for a device whose monitoring is off', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: false }))
      );

      await useCase.execute(makeRequest({ forceExecution: true }));

      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });

    it('should still poll normally when monitoring is enabled', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ enabled: true }))
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 10 })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState())
      );

      const result = await useCase.execute(
        makeRequest({ forceExecution: true })
      );

      expect(result.isSuccess).toBe(true);
      expect(pingService.ping).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — monitoring turned off mid-cycle', () => {
    // The attempt loop runs for seconds and the suspend that clears the state is
    // dispatched without being awaited, so this race is reachable in production.
    function arrangeDisabledMidCycle() {
      configRepo.findByDeviceId
        .mockResolvedValueOnce(
          Result.ok(makeConfig({ enabled: true }))
        )
        .mockResolvedValueOnce(
          Result.ok(makeConfig({ enabled: false }))
        );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: false, latencyMs: null })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState({ status: ReachabilityStatus.createUp() })
        )
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState())
      );
    }

    it('[MON-002] should skip rather than resurrect the state cleared by the suspend', async () => {
      arrangeDisabledMidCycle();

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('SKIPPED');
    });

    it('[MON-002] should not write device state when monitoring was turned off mid-cycle', async () => {
      arrangeDisabledMidCycle();

      await useCase.execute(makeRequest());

      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });

    it('[MON-002] should not record a ping sample when monitoring was turned off mid-cycle', async () => {
      arrangeDisabledMidCycle();

      await useCase.execute(makeRequest());

      expect(pingResultRepo.save).not.toHaveBeenCalled();
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
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
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
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState())
      );

      await useCase.execute(makeRequest());

      expect(pingService.ping).toHaveBeenCalledWith(TEST_IP);
    });
  });

  // ===========================================================================
  describe('executeImpl — successful ping result', () => {
    beforeEach(() => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 15 })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createUp(),
            consecutiveFailures: 0
          })
        )
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createUp(),
            consecutiveFailures: 0
          })
        )
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

      const savedState: DeviceState =
        deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.consecutiveFailures).toBe(0);
    });
  });

  // ===========================================================================
  describe('executeImpl — failed ping result', () => {
    it('should return FAILED status when all retries are unreachable', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: false, latencyMs: null })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createDown(),
            consecutiveFailures: 1
          })
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('FAILED');
    });

    it('should return null metrics when all retries are unreachable', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: false, latencyMs: null })
      );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(
          makeDeviceState({ status: ReachabilityStatus.createDown() })
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.metrics).toBeNull();
    });

    it('should increment consecutiveFailures when all ping retries fail', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ thresholdCount: 3 }))
      );
      pingService.ping
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        )
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        )
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ consecutiveFailures: 1 }))
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(makeDeviceState({ consecutiveFailures: 2 }))
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState =
        deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.consecutiveFailures).toBe(2);
    });

    it('should mark device OFFLINE after all retries fail (threshold = ping attempts)', async () => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ thresholdCount: 3 }))
      );
      pingService.ping
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        )
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        )
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createUp(),
            consecutiveFailures: 0
          })
        )
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createDown(),
            consecutiveFailures: 1
          })
        )
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
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        )
        .mockResolvedValueOnce(
          Result.ok({ isReachable: true, latencyMs: 22 })
        );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createDown(),
            consecutiveFailures: 1
          })
        )
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createUp(),
            consecutiveFailures: 0
          })
        )
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
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        )
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        )
        .mockResolvedValueOnce(
          Result.ok({ isReachable: false, latencyMs: null })
        );
      pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );
      deviceStateRepo.save.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createDown(),
            consecutiveFailures: 1
          })
        )
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState =
        deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.consecutiveFailures).toBe(1);
    });
  });

  // ===========================================================================
  describe('executeImpl — persistence failures', () => {
    beforeEach(() => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 15 })
      );
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState({ status: ReachabilityStatus.createUp() })
        )
      );
    });

    it('should fail when the device state cannot be saved', async () => {
      deviceStateRepo.save.mockResolvedValue(
        Result.fail('DB write error')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save device state');
    });

    it('should not report success from a state the repository rejected', async () => {
      deviceStateRepo.save.mockResolvedValue(
        Result.fail('DB write error')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(false);
      expect(configRepo.save).not.toHaveBeenCalled();
    });

    it('should still update device state when the ping history write fails', async () => {
      pingResultRepo.save.mockResolvedValue(
        Result.fail('history unavailable')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(deviceStateRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should warn but succeed when lastPolledAt cannot be persisted', async () => {
      configRepo.save.mockResolvedValue(
        Result.fail('config write error')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — first poll of an unseen device', () => {
    beforeEach(() => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig())
      );
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );
    });

    it('should raise DeviceWentOfflineEvent when a device is unreachable on first sight', async () => {
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: false, latencyMs: null })
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState =
        deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.domainEvents).toHaveLength(1);
      expect(savedState.domainEvents[0].constructor.name).toBe(
        'DeviceWentOfflineEvent'
      );
    });

    it('should raise no event when a device is reachable on first sight', async () => {
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 15 })
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState =
        deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.domainEvents).toHaveLength(0);
    });
  });

  // ===========================================================================
  describe('executeImpl — the ping program cannot be executed', () => {
    beforeEach(() => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig({ thresholdCount: 3 }))
      );
    });

    it('should retry the remaining attempts instead of giving up immediately', async () => {
      pingService.ping.mockResolvedValue(Result.fail('spawn EAGAIN'));

      await useCase.execute(makeRequest());

      expect(pingService.ping).toHaveBeenCalledTimes(3);
    });

    it('should recover when a later attempt executes successfully', async () => {
      pingService.ping
        .mockResolvedValueOnce(Result.fail('spawn EAGAIN'))
        .mockResolvedValueOnce(
          Result.ok({ isReachable: true, latencyMs: 18 })
        );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceStatus).toBe('ONLINE');
    });

    it('should fail only when no attempt could be executed', async () => {
      pingService.ping.mockResolvedValue(Result.fail('spawn ENOENT'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ping execution error');
    });

    it('should not mark a reachable device as offline', async () => {
      pingService.ping.mockResolvedValue(Result.fail('spawn ENOENT'));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState({
            status: ReachabilityStatus.createUp(),
            consecutiveFailures: 0
          })
        )
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState =
        deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.isOnline).toBe(true);
      expect(savedState.consecutiveFailures).toBe(0);
      expect(savedState.domainEvents).toHaveLength(0);
    });

    it('should advance lastCheckedAt so the scheduler does not re-queue every tick', async () => {
      pingService.ping.mockResolvedValue(Result.fail('spawn ENOENT'));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ lastCheckedAt: FIXED_DATE }))
      );

      await useCase.execute(makeRequest());

      const savedState: DeviceState =
        deviceStateRepo.save.mock.calls[0][0];
      expect(savedState.lastCheckedAt!.getTime()).toBeGreaterThan(
        FIXED_DATE.getTime()
      );
    });

    it('should not seed a state row for a device that has never been polled', async () => {
      pingService.ping.mockResolvedValue(Result.fail('spawn ENOENT'));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );

      await useCase.execute(makeRequest());

      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });

    it('should report the failure to the probe health reporter', async () => {
      const probeHealth = {
        recordProbeExecutionFailure: jest.fn(),
        recordProbeExecuted: jest.fn()
      };
      useCase = new ExecutePollingCycleUseCase(
        configRepo,
        pingResultRepo,
        deviceStateRepo,
        pingService,
        deviceRepo as unknown as IDeviceRepository,
        new DeviceEligibilityService(),
        logger,
        0,
        probeHealth
      );
      pingService.ping.mockResolvedValue(Result.fail('spawn ENOENT'));

      await useCase.execute(makeRequest());

      expect(
        probeHealth.recordProbeExecutionFailure
      ).toHaveBeenCalledWith(
        VALID_DEVICE_UUID,
        expect.stringContaining('ENOENT')
      );
      expect(probeHealth.recordProbeExecuted).not.toHaveBeenCalled();
    });

    it('should report a healthy probe when the ping program runs', async () => {
      const probeHealth = {
        recordProbeExecutionFailure: jest.fn(),
        recordProbeExecuted: jest.fn()
      };
      useCase = new ExecutePollingCycleUseCase(
        configRepo,
        pingResultRepo,
        deviceStateRepo,
        pingService,
        deviceRepo as unknown as IDeviceRepository,
        new DeviceEligibilityService(),
        logger,
        0,
        probeHealth
      );
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: false, latencyMs: null })
      );

      await useCase.execute(makeRequest());

      expect(probeHealth.recordProbeExecuted).toHaveBeenCalledWith(
        VALID_DEVICE_UUID
      );
      expect(
        probeHealth.recordProbeExecutionFailure
      ).not.toHaveBeenCalled();
    });
  });
});
