// Source: src/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase.ts

import { GetDevicePollingStatusUseCase } from '../../../../src/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { IDeviceStateRepository } from '../../../../src/domain/device-monitoring/repository/IDeviceStateRepository';
import { IPingResultRepository, PingResultRecord } from '../../../../src/domain/device-monitoring/repository/IPingResultRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { GetDevicePollingStatusDTO } from '../../../../src/application/device-monitoring/dtos/GetDevicePollingStatusDTO';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_IP = '10.0.1.100';
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

function makeDeviceStateRepo(): jest.Mocked<IDeviceStateRepository> {
  return {
    findByDeviceId: jest.fn(),
    save: jest.fn()
  };
}

function makePingResultRepo(): jest.Mocked<IPingResultRepository> {
  return {
    save: jest.fn(),
    findLatestByDevice: jest.fn(),
    findByDevice: jest.fn()
  };
}

function makeConfig(enabled = true, intervalSeconds = 60): PollingConfiguration {
  return PollingConfiguration.create(
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      ipAddress: IPAddress.reconstitute(TEST_IP),
      interval: PollingInterval.create(intervalSeconds).value,
      failuresBeforeDown: FailureThreshold.create(3).value,
      enabled
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
    lastLatencyMs: 10,
    consecutiveFailures: 0,
    lastCheckedAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides
  };
  return DeviceState.reconstitute(props, deviceId);
}

function makePingRecord(
  overrides: Partial<PingResultRecord> = {}
): PingResultRecord {
  return {
    id: 'ping-id-1',
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    isReachable: true,
    latencyMs: 10,
    checkedAt: FIXED_DATE,
    ...overrides
  };
}

function makeRequest(
  overrides: Partial<GetDevicePollingStatusDTO> = {}
): GetDevicePollingStatusDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('GetDevicePollingStatusUseCase', () => {
  let configRepo: jest.Mocked<IPollingConfigurationRepository>;
  let deviceStateRepo: jest.Mocked<IDeviceStateRepository>;
  let pingResultRepo: jest.Mocked<IPingResultRepository>;
  let logger: ILogger;
  let useCase: GetDevicePollingStatusUseCase;

  beforeEach(() => {
    configRepo = makePollingConfigRepo();
    deviceStateRepo = makeDeviceStateRepo();
    pingResultRepo = makePingResultRepo();
    logger = makeLogger();
    useCase = new GetDevicePollingStatusUseCase(
      configRepo,
      deviceStateRepo,
      pingResultRepo,
      logger
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
      const result = await useCase.execute(makeRequest({ deviceId: '   ' }));

      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(makeRequest({ deviceId: 'bad-id' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — polling config lookup', () => {
    it('should fail when the config repository returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.fail('DB timeout'));

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
  describe('executeImpl — happy path with full data', () => {
    beforeEach(() => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig(true, 60)));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: true, consecutiveFailures: 0 }))
      );
      pingResultRepo.findLatestByDevice.mockResolvedValue(
        Result.ok([makePingRecord()])
      );
    });

    it('should return a successful Result', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should include the device ID in the returned DTO', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should reflect pollingEnabled from the config', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.pollingEnabled).toBe(true);
    });

    it('should reflect intervalSeconds from the config', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.intervalSeconds).toBe(60);
    });

    it('should reflect failuresBeforeDown from the config', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.failuresBeforeDown).toBe(3);
    });

    it('should return ONLINE when the device state shows isOnline = true', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.currentStatus).toBe('ONLINE');
    });

    it('should include the most recent ping result as lastResult', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.lastResult).not.toBeNull();
    });

    it('should set lastPolled from the device state lastCheckedAt', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.lastPolled).toEqual(FIXED_DATE);
    });

    it('should compute nextScheduled as lastCheckedAt + interval seconds', async () => {
      const result = await useCase.execute(makeRequest());

      const expected = new Date(FIXED_DATE.getTime() + 60 * 1000);
      expect(result.value.nextScheduled).toEqual(expected);
    });

    it('should reflect consecutiveFailures from the device state', async () => {
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ consecutiveFailures: 2 }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.consecutiveFailures).toBe(2);
    });
  });

  // ===========================================================================
  describe('executeImpl — OFFLINE device state', () => {
    it('should return OFFLINE when the device state shows isOnline = false', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ isOnline: false }))
      );
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute(makeRequest());

      expect(result.value.currentStatus).toBe('OFFLINE');
    });
  });

  // ===========================================================================
  describe('executeImpl — no device state', () => {
    it('should return UNKNOWN status when no device state exists', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute(makeRequest());

      expect(result.value.currentStatus).toBe('UNKNOWN');
    });

    it('should set lastPolled to null when no device state exists', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute(makeRequest());

      expect(result.value.lastPolled).toBeNull();
    });

    it('should set nextScheduled to null when no device state exists', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute(makeRequest());

      expect(result.value.nextScheduled).toBeNull();
    });

    it('should return 0 consecutiveFailures when no device state exists', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute(makeRequest());

      expect(result.value.consecutiveFailures).toBe(0);
    });

    it('should set lastResult to null when there are no ping records', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute(makeRequest());

      expect(result.value.lastResult).toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — state repo failure is tolerated', () => {
    it('should still return success when deviceStateRepo returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.fail('State table unavailable')
      );
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.currentStatus).toBe('UNKNOWN');
    });
  });

  // ===========================================================================
  describe('executeImpl — ping result repo failure is tolerated', () => {
    it('should still return success when pingResultRepo returns a failure', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      pingResultRepo.findLatestByDevice.mockResolvedValue(
        Result.fail('Ping table unavailable')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.lastResult).toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — repository call contracts', () => {
    it('should call configRepo.findByDeviceId with the parsed DeviceId', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute(makeRequest());

      expect(configRepo.findByDeviceId.mock.calls[0][0].toString()).toBe(
        VALID_DEVICE_UUID
      );
    });

    it('should call pingResultRepo.findLatestByDevice with limit 1', async () => {
      configRepo.findByDeviceId.mockResolvedValue(Result.ok(makeConfig()));
      deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      pingResultRepo.findLatestByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute(makeRequest());

      expect(pingResultRepo.findLatestByDevice).toHaveBeenCalledWith(
        expect.anything(),
        1
      );
    });
  });
});
