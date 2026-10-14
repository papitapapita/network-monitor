// Source: src/application/device-monitoring/use-cases/ListDevicePollingStatusesUseCase.ts

import { ListDevicePollingStatusesUseCase } from '../../../../src/application/device-monitoring/use-cases/ListDevicePollingStatusesUseCase';
import {
  IPollingStatusListQuery,
  PollingStatusRow
} from '../../../../src/application/device-monitoring/interfaces/IPollingStatusListQuery';
import { IAgentStatusQuery } from '../../../../src/application/shared/interfaces/IAgentStatusQuery';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { ReachabilityStatus } from '../../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';

const DEVICE_A = '550e8400-e29b-41d4-a716-446655440001';
const DEVICE_B = '550e8400-e29b-41d4-a716-446655440002';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

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

function makeConfig(deviceId: string): PollingConfiguration {
  return PollingConfiguration.create(
    {
      deviceId: DeviceId.parse(deviceId).value,
      ipAddress: IPAddress.reconstitute('10.0.1.100'),
      interval: PollingInterval.create(60).value,
      failuresBeforeDown: FailureThreshold.create(3).value,
      enabled: true
    },
    PollingConfigurationId.create()
  ).value;
}

function makeUpState(deviceId: string): DeviceState {
  const id = DeviceId.parse(deviceId).value;
  return DeviceState.reconstitute(id, {
    deviceId: id,
    status: ReachabilityStatus.createUp(),
    lastSeen: FIXED_DATE,
    lastLatencyMs: 12,
    consecutiveFailures: 0,
    lastCheckedAt: FIXED_DATE,
    downSince: null,
    updatedAt: FIXED_DATE
  });
}

function makeRow(deviceId: string, polled = true): PollingStatusRow {
  return {
    config: makeConfig(deviceId),
    state: polled ? makeUpState(deviceId) : null,
    lastPing: polled
      ? {
          id: `ping-${deviceId}`,
          deviceId: DeviceId.parse(deviceId).value,
          isReachable: true,
          latencyMs: 12,
          checkedAt: FIXED_DATE
        }
      : null
  };
}

describe('ListDevicePollingStatusesUseCase', () => {
  let listQuery: jest.Mocked<IPollingStatusListQuery>;
  let agentStatusQuery: jest.Mocked<IAgentStatusQuery>;
  let logger: ILogger;
  let useCase: ListDevicePollingStatusesUseCase;

  beforeEach(() => {
    listQuery = { listAll: jest.fn() };
    agentStatusQuery = {
      findUnmeasuredDevices: jest
        .fn()
        .mockResolvedValue(Result.ok(new Set()))
    };
    logger = makeLogger();
    useCase = new ListDevicePollingStatusesUseCase(
      listQuery,
      logger,
      agentStatusQuery
    );
  });

  it('returns one status per device, in the single-device shape', async () => {
    listQuery.listAll.mockResolvedValue(
      Result.ok([makeRow(DEVICE_A), makeRow(DEVICE_B, false)])
    );

    const result = await useCase.execute();

    expect(result.isSuccess).toBe(true);
    const [a, b] = result.value;
    expect(a).toMatchObject({
      deviceId: DEVICE_A,
      pollingEnabled: true,
      currentStatus: 'ONLINE',
      consecutiveFailures: 0,
      lastPolled: FIXED_DATE,
      lastResult: {
        timestamp: FIXED_DATE,
        status: 'SUCCESS',
        metrics: { latencyMs: 12 }
      }
    });
    expect(b).toMatchObject({
      deviceId: DEVICE_B,
      currentStatus: 'UNKNOWN',
      lastPolled: null,
      lastResult: null
    });
  });

  it('asks for the agent status of every device in one call', async () => {
    listQuery.listAll.mockResolvedValue(
      Result.ok([makeRow(DEVICE_A), makeRow(DEVICE_B)])
    );

    await useCase.execute();

    expect(
      agentStatusQuery.findUnmeasuredDevices
    ).toHaveBeenCalledTimes(1);
    expect(
      agentStatusQuery.findUnmeasuredDevices
    ).toHaveBeenCalledWith([DEVICE_A, DEVICE_B]);
  });

  it('[MON-006] reports UNKNOWN for a device nobody is measuring', async () => {
    listQuery.listAll.mockResolvedValue(
      Result.ok([makeRow(DEVICE_A), makeRow(DEVICE_B)])
    );
    agentStatusQuery.findUnmeasuredDevices.mockResolvedValue(
      Result.ok(new Set([DEVICE_B]))
    );

    const result = await useCase.execute();

    expect(result.value.map((s) => s.currentStatus)).toEqual([
      'ONLINE',
      'UNKNOWN'
    ]);
  });

  it('[MON-006] falls back to the stored state when agent status cannot be read', async () => {
    listQuery.listAll.mockResolvedValue(
      Result.ok([makeRow(DEVICE_A)])
    );
    agentStatusQuery.findUnmeasuredDevices.mockResolvedValue(
      Result.fail('db down')
    );

    const result = await useCase.execute();

    expect(result.value[0].currentStatus).toBe('ONLINE');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns an empty list without asking for agent status', async () => {
    listQuery.listAll.mockResolvedValue(Result.ok([]));

    const result = await useCase.execute();

    expect(result.value).toEqual([]);
    expect(
      agentStatusQuery.findUnmeasuredDevices
    ).not.toHaveBeenCalled();
  });

  it('fails when the statuses cannot be read', async () => {
    listQuery.listAll.mockResolvedValue(
      Result.fail('connection lost')
    );

    const result = await useCase.execute();

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to load polling statuses');
  });
});
