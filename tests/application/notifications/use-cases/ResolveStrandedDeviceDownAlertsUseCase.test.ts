// Source: src/application/notifications/use-cases/ResolveStrandedDeviceDownAlertsUseCase.ts

import { ResolveStrandedDeviceDownAlertsUseCase } from '../../../../src/application/notifications/use-cases/ResolveStrandedDeviceDownAlertsUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { IDeviceStateRepository } from '../../../../src/domain/device-monitoring/repository/IDeviceStateRepository';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';
import { ReachabilityStatus } from '../../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertProps } from '../../../../src/domain/notifications/props/AlertProps';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const DEVICE_UUID_1 = '550e8400-e29b-41d4-a716-446655440090';
const DEVICE_UUID_2 = '550e8400-e29b-41d4-a716-446655440091';
const NOW = new Date('2024-06-04T10:00:00.000Z');
const STARTED_AT = new Date('2024-06-01T02:00:00.000Z');

function makeLogger(): jest.Mocked<ILogger> {
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

function makeAlertRepo(): jest.Mocked<IAlertRepository> {
  return {
    save: jest
      .fn()
      .mockImplementation(async (a: Alert) => Result.ok(a)),
    findById: jest.fn(),
    findOpenByDeviceAndType: jest.fn(),
    findAllOpenByDeviceId: jest.fn(),
    findAllOpenByType: jest.fn().mockResolvedValue(Result.ok([])),
    deleteById: jest.fn(),
    deleteResolvedOlderThan: jest.fn()
  };
}

function makeDeviceStateRepo(): jest.Mocked<IDeviceStateRepository> {
  return {
    findByDeviceId: jest.fn().mockResolvedValue(Result.ok(null)),
    findAllDown: jest.fn(),
    save: jest.fn()
  };
}

function makeAlert(
  deviceUuid: string,
  overrides: Partial<AlertProps> = {}
): Alert {
  return Alert.reconstitute(AlertId.create(), {
    deviceId: DeviceId.parse(deviceUuid).value,
    severity: AlertSeverity.CRITICAL,
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión.',
    details: {},
    startedAt: STARTED_AT,
    resolvedAt: null,
    notifiedAt: STARTED_AT,
    recoveryNotifiedAt: null,
    ...overrides
  });
}

function makeUpState(
  deviceUuid: string,
  overrides: Partial<DeviceStateProps> = {}
): DeviceState {
  const deviceId = DeviceId.parse(deviceUuid).value;
  return DeviceState.reconstitute(deviceId, {
    deviceId,
    status: ReachabilityStatus.createUp(),
    lastSeen: new Date(NOW.getTime() - 30_000),
    lastLatencyMs: 4,
    consecutiveFailures: 0,
    lastCheckedAt: new Date(NOW.getTime() - 30_000),
    downSince: null,
    updatedAt: NOW,
    ...overrides
  });
}

describe('[NOT-229] ResolveStrandedDeviceDownAlertsUseCase', () => {
  let alertRepo: jest.Mocked<IAlertRepository>;
  let stateRepo: jest.Mocked<IDeviceStateRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: ResolveStrandedDeviceDownAlertsUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    alertRepo = makeAlertRepo();
    stateRepo = makeDeviceStateRepo();
    logger = makeLogger();
    useCase = new ResolveStrandedDeviceDownAlertsUseCase(
      alertRepo,
      stateRepo,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('only looks at open device-down alerts', async () => {
    await useCase.execute();

    expect(alertRepo.findAllOpenByType).toHaveBeenCalledWith(
      'device_unreachable'
    );
  });

  it('resolves an open alert whose device has answered since it opened', async () => {
    const alert = makeAlert(DEVICE_UUID_1);
    alertRepo.findAllOpenByType.mockResolvedValue(Result.ok([alert]));
    stateRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makeUpState(DEVICE_UUID_1))
    );

    const result = await useCase.execute();

    expect(result.value).toBe(1);
    expect(alertRepo.save).toHaveBeenCalledWith(alert);
    expect(alert.resolvedAt).toEqual(NOW);
  });

  it('resolves silently: the recovery is not announced', async () => {
    const alert = makeAlert(DEVICE_UUID_1);
    alertRepo.findAllOpenByType.mockResolvedValue(Result.ok([alert]));
    stateRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makeUpState(DEVICE_UUID_1))
    );

    await useCase.execute();

    expect(alert.recoveryNotifiedAt).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Resolved a down alert left open for a device that is up',
      expect.objectContaining({ deviceId: DEVICE_UUID_1 })
    );
  });

  it('leaves the alert open while the device is still down', async () => {
    alertRepo.findAllOpenByType.mockResolvedValue(
      Result.ok([makeAlert(DEVICE_UUID_1)])
    );
    stateRepo.findByDeviceId.mockResolvedValue(
      Result.ok(
        makeUpState(DEVICE_UUID_1, {
          status: ReachabilityStatus.createDown(),
          downSince: STARTED_AT
        })
      )
    );

    const result = await useCase.execute();

    expect(result.value).toBe(0);
    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('leaves the alert open when the device was last seen before it opened', async () => {
    alertRepo.findAllOpenByType.mockResolvedValue(
      Result.ok([makeAlert(DEVICE_UUID_1)])
    );
    stateRepo.findByDeviceId.mockResolvedValue(
      Result.ok(
        makeUpState(DEVICE_UUID_1, {
          lastSeen: new Date(STARTED_AT.getTime() - 1)
        })
      )
    );

    await useCase.execute();

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('leaves the alert open when the device has no state or an unknown one', async () => {
    alertRepo.findAllOpenByType.mockResolvedValue(
      Result.ok([makeAlert(DEVICE_UUID_1), makeAlert(DEVICE_UUID_2)])
    );
    stateRepo.findByDeviceId
      .mockResolvedValueOnce(Result.ok(null))
      .mockResolvedValueOnce(
        Result.ok(
          makeUpState(DEVICE_UUID_2, {
            status: ReachabilityStatus.createUnknown()
          })
        )
      );

    await useCase.execute();

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('fails when the open alerts cannot be read', async () => {
    alertRepo.findAllOpenByType.mockResolvedValue(
      Result.fail('db down')
    );

    const result = await useCase.execute();

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('db down');
  });

  it('skips a device whose state cannot be read and carries on with the rest', async () => {
    const second = makeAlert(DEVICE_UUID_2);
    alertRepo.findAllOpenByType.mockResolvedValue(
      Result.ok([makeAlert(DEVICE_UUID_1), second])
    );
    stateRepo.findByDeviceId
      .mockResolvedValueOnce(Result.fail('timeout'))
      .mockResolvedValueOnce(Result.ok(makeUpState(DEVICE_UUID_2)));

    const result = await useCase.execute();

    expect(result.value).toBe(1);
    expect(alertRepo.save).toHaveBeenCalledWith(second);
    expect(logger.error).toHaveBeenCalled();
  });

  it('does not count an alert whose save failed', async () => {
    alertRepo.findAllOpenByType.mockResolvedValue(
      Result.ok([makeAlert(DEVICE_UUID_1)])
    );
    stateRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makeUpState(DEVICE_UUID_1))
    );
    alertRepo.save.mockResolvedValue(Result.fail('write failed'));

    const result = await useCase.execute();

    expect(result.value).toBe(0);
    expect(logger.error).toHaveBeenCalled();
  });
});
