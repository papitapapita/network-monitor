import {
  IngestPingResultsUseCase,
  LIVE_RESULT_WINDOW_MS
} from '../../../../src/application/device-monitoring/use-cases/IngestPingResultsUseCase';
import { IngestPingResultsDTO } from '../../../../src/application/device-monitoring/dtos/IngestPingResultsDTO';
import { PingCycleOutcome } from '../../../../src/application/device-monitoring/services/PingCycleProbe';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { IPingResultRepository } from '../../../../src/domain/device-monitoring/repository/IPingResultRepository';
import { IDeviceStateRepository } from '../../../../src/domain/device-monitoring/repository/IDeviceStateRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { ReachabilityStatus } from '../../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const EARLIER = new Date('2024-06-01T09:59:00.000Z');
const MEASURED_AT = new Date('2024-06-01T10:00:00.000Z');

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
    saveOnce: jest.fn(),
    findLatestByDevice: jest.fn(),
    findByDevice: jest.fn(),
    deleteOlderThan: jest.fn(),
    deleteByDevice: jest.fn()
  };
}

function makeDeviceStateRepo(): jest.Mocked<IDeviceStateRepository> {
  return {
    findByDeviceId: jest.fn(),
    findAllDown: jest.fn(),
    save: jest.fn()
  };
}

function makeConfig(enabled = true): PollingConfiguration {
  return PollingConfiguration.reconstitute(
    PollingConfigurationId.parse(VALID_CONFIG_UUID).value,
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      ipAddress: IPAddress.reconstitute('192.168.1.50'),
      interval: PollingInterval.create(60).value,
      failuresBeforeDown: FailureThreshold.create(3).value,
      enabled
    }
  );
}

function makeDeviceState(
  overrides: Partial<DeviceStateProps> = {}
): DeviceState {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  return DeviceState.reconstitute(deviceId, {
    deviceId,
    status: ReachabilityStatus.createUp(),
    lastSeen: EARLIER,
    lastLatencyMs: 12,
    consecutiveFailures: 0,
    lastCheckedAt: EARLIER,
    downSince: null,
    updatedAt: EARLIER,
    ...overrides
  });
}

const measured = (
  isReachable: boolean,
  latencyMs: number | null = isReachable ? 15 : null
): PingCycleOutcome => ({
  kind: 'measured',
  isReachable,
  latencyMs,
  attempts: 1
});

const probeUnavailable: PingCycleOutcome = {
  kind: 'probe-unavailable',
  error: 'spawn ENOENT',
  attempts: 3
};

function makeRequest(
  overrides: Partial<IngestPingResultsDTO> = {}
): IngestPingResultsDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    outcome: measured(true),
    measuredAt: MEASURED_AT,
    ...overrides
  };
}

describe('IngestPingResultsUseCase', () => {
  let configRepo: jest.Mocked<IPollingConfigurationRepository>;
  let pingResultRepo: jest.Mocked<IPingResultRepository>;
  let deviceStateRepo: jest.Mocked<IDeviceStateRepository>;
  let logger: ILogger;
  let useCase: IngestPingResultsUseCase;

  beforeEach(() => {
    configRepo = makePollingConfigRepo();
    pingResultRepo = makePingResultRepo();
    deviceStateRepo = makeDeviceStateRepo();
    logger = makeLogger();
    useCase = new IngestPingResultsUseCase(
      configRepo,
      pingResultRepo,
      deviceStateRepo,
      logger
    );

    configRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makeConfig())
    );
    configRepo.save.mockResolvedValue(Result.ok(makeConfig()));
    pingResultRepo.save.mockResolvedValue(Result.ok(undefined));
    deviceStateRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
    deviceStateRepo.save.mockResolvedValue(
      Result.ok(makeDeviceState())
    );
  });

  const savedState = (): DeviceState =>
    deviceStateRepo.save.mock.calls[0][0];

  describe('input validation', () => {
    it('fails when deviceId is blank', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '  ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('required');
    });

    it('fails when deviceId is not a UUID', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  describe('a measured result', () => {
    it('records a history sample stamped with measuredAt', async () => {
      await useCase.execute(
        makeRequest({ outcome: measured(true, 15) })
      );

      expect(pingResultRepo.save).toHaveBeenCalledWith({
        deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
        isReachable: true,
        latencyMs: 15,
        checkedAt: MEASURED_AT
      });
    });

    it('applies the result to DeviceState at measuredAt', async () => {
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState())
      );

      const result = await useCase.execute(
        makeRequest({ outcome: measured(false) })
      );

      expect(result.value).toEqual({
        status: 'APPLIED',
        isOnline: false,
        consecutiveFailures: 1
      });
      expect(savedState().lastCheckedAt).toEqual(MEASURED_AT);
      expect(savedState().downSince).toEqual(MEASURED_AT);
    });

    it('creates the state of a device seen for the first time', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value).toEqual({
        status: 'APPLIED',
        isOnline: true,
        consecutiveFailures: 0
      });
      expect(deviceStateRepo.save).toHaveBeenCalledTimes(1);
    });

    it('advances lastPolledAt to measuredAt', async () => {
      await useCase.execute(makeRequest());

      const config: PollingConfiguration =
        configRepo.save.mock.calls[0][0];
      expect(config.lastPolledAt).toEqual(MEASURED_AT);
    });
  });

  describe('[MON-002] monitoring turned off before the result arrived', () => {
    beforeEach(() => {
      configRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeConfig(false))
      );
    });

    it('skips the result', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value).toEqual({ status: 'SKIPPED' });
    });

    it('writes neither history, state nor config', async () => {
      await useCase.execute(makeRequest());

      expect(pingResultRepo.save).not.toHaveBeenCalled();
      expect(deviceStateRepo.save).not.toHaveBeenCalled();
      expect(configRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('persistence failures', () => {
    it('still updates state when the history sample cannot be saved', async () => {
      pingResultRepo.save.mockResolvedValue(Result.fail('disk full'));

      const result = await useCase.execute(makeRequest());

      expect(result.value.status).toBe('APPLIED');
      expect(deviceStateRepo.save).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('fails when the device state cannot be loaded', async () => {
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load device state');
    });

    it('fails when the device state cannot be saved', async () => {
      deviceStateRepo.save.mockResolvedValue(Result.fail('db down'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save device state');
      expect(configRepo.save).not.toHaveBeenCalled();
    });

    it('warns but applies when lastPolledAt cannot be saved', async () => {
      configRepo.save.mockResolvedValue(Result.fail('db down'));

      const result = await useCase.execute(makeRequest());

      expect(result.value.status).toBe('APPLIED');
      expect(logger.warn).toHaveBeenCalled();
    });

    it.each([
      ['cannot be read', () => Result.fail('db down')],
      ['no longer exists', () => Result.ok(null)]
    ])(
      'applies the state but leaves lastPolledAt alone when the config %s',
      async (_label, configResult) => {
        configRepo.findByDeviceId.mockResolvedValue(
          configResult() as never
        );

        const result = await useCase.execute(makeRequest());

        expect(result.value.status).toBe('APPLIED');
        expect(deviceStateRepo.save).toHaveBeenCalled();
        expect(configRepo.save).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
      }
    );
  });

  describe('the probe could not run', () => {
    it('reports PROBE_UNAVAILABLE', async () => {
      const result = await useCase.execute(
        makeRequest({ outcome: probeUnavailable })
      );

      expect(result.value).toEqual({ status: 'PROBE_UNAVAILABLE' });
    });

    it('leaves a known device status alone but advances lastCheckedAt', async () => {
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState())
      );

      await useCase.execute(
        makeRequest({ outcome: probeUnavailable })
      );

      expect(savedState().isOnline).toBe(true);
      expect(savedState().consecutiveFailures).toBe(0);
      expect(savedState().lastCheckedAt).toEqual(MEASURED_AT);
      expect(savedState().domainEvents).toHaveLength(0);
    });

    it('does not seed a state row for a device never polled', async () => {
      await useCase.execute(
        makeRequest({ outcome: probeUnavailable })
      );

      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });

    it('records no history sample', async () => {
      await useCase.execute(
        makeRequest({ outcome: probeUnavailable })
      );

      expect(pingResultRepo.save).not.toHaveBeenCalled();
    });

    it('still reports PROBE_UNAVAILABLE when the attempt cannot be saved', async () => {
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState())
      );
      deviceStateRepo.save.mockResolvedValue(Result.fail('db down'));

      const result = await useCase.execute(
        makeRequest({ outcome: probeUnavailable })
      );

      expect(result.value).toEqual({ status: 'PROBE_UNAVAILABLE' });
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('a result sent in by an agent', () => {
    const fromAgent = (
      measuredAt: Date,
      receivedAt: Date,
      outcome: PingCycleOutcome = measured(false)
    ) =>
      makeRequest({
        outcome,
        measuredAt,
        source: { resultId: 'res-1', receivedAt }
      });

    beforeEach(() => {
      pingResultRepo.saveOnce.mockResolvedValue(Result.ok(true));
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState())
      );
    });

    it('[MON-007] stores it once under its id and applies it', async () => {
      const result = await useCase.execute(
        fromAgent(MEASURED_AT, MEASURED_AT)
      );

      expect(result.value.status).toBe('APPLIED');
      expect(pingResultRepo.saveOnce).toHaveBeenCalledWith(
        expect.objectContaining({ sourceResultId: 'res-1' })
      );
      expect(pingResultRepo.save).not.toHaveBeenCalled();
    });

    it('[MON-007] does nothing more for a result already stored', async () => {
      pingResultRepo.saveOnce.mockResolvedValue(Result.ok(false));

      const result = await useCase.execute(
        fromAgent(MEASURED_AT, MEASURED_AT)
      );

      expect(result.value.status).toBe('DUPLICATE');
      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });

    it('[MON-007] fails when it cannot be stored, so the agent resends', async () => {
      pingResultRepo.saveOnce.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute(
        fromAgent(MEASURED_AT, MEASURED_AT)
      );

      expect(result.isFailure).toBe(true);
      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });

    it('[MON-008] applies a result up to 2 minutes old', async () => {
      const result = await useCase.execute(
        fromAgent(
          MEASURED_AT,
          new Date(MEASURED_AT.getTime() + LIVE_RESULT_WINDOW_MS)
        )
      );

      expect(result.value.status).toBe('APPLIED');
    });

    it('[MON-008] keeps an older result as history only', async () => {
      const result = await useCase.execute(
        fromAgent(
          MEASURED_AT,
          new Date(MEASURED_AT.getTime() + LIVE_RESULT_WINDOW_MS + 1)
        )
      );

      expect(result.value.status).toBe('HISTORY_ONLY');
      expect(pingResultRepo.saveOnce).toHaveBeenCalled();
      expect(deviceStateRepo.save).not.toHaveBeenCalled();
      expect(configRepo.save).not.toHaveBeenCalled();
    });

    it('[MON-008] keeps a result not newer than the last check as history only', async () => {
      const result = await useCase.execute(
        fromAgent(EARLIER, MEASURED_AT)
      );

      expect(result.value.status).toBe('HISTORY_ONLY');
      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });

    it('[MON-008] ignores a stale probe failure', async () => {
      const result = await useCase.execute(
        fromAgent(
          MEASURED_AT,
          new Date(MEASURED_AT.getTime() + LIVE_RESULT_WINDOW_MS + 1),
          probeUnavailable
        )
      );

      expect(result.value.status).toBe('PROBE_UNAVAILABLE');
      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('[MON-008] an in-process poll overtaken by a newer one', () => {
    it('keeps the older result as history only', async () => {
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeDeviceState({ lastCheckedAt: MEASURED_AT }))
      );

      const result = await useCase.execute(
        makeRequest({ measuredAt: EARLIER })
      );

      expect(result.value.status).toBe('HISTORY_ONLY');
      expect(pingResultRepo.save).toHaveBeenCalled();
      expect(deviceStateRepo.save).not.toHaveBeenCalled();
    });
  });
});
