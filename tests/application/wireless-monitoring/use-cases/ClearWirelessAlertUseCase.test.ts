import { ClearWirelessAlertUseCase } from '../../../../src/application/wireless-monitoring/use-cases/ClearWirelessAlertUseCase';
import { IWirelessAlertRecordRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessAlertRecordRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  DeviceId,
  WirelessAlertRecordId
} from '../../../../src/domain/shared/ids';
import { WirelessAlertRecord } from '../../../../src/domain/wireless-monitoring';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440005';
const ALERT_UUID = '550e8400-e29b-41d4-a716-446655440002';

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeRepo(): jest.Mocked<IWirelessAlertRecordRepository> {
  return {
    save: jest.fn().mockImplementation(async (r) => Result.ok(r)),
    findById: jest.fn(),
    exists: jest.fn(),
    findActiveByDeviceMetricAndSeverity: jest.fn(),
    findAllActiveByDevice: jest.fn(),
    findActiveUnnotifiedByDevice: jest.fn(),
    findAllActive: jest.fn(),
    findHistoryByDevice: jest.fn(),
    deleteClearedOlderThan: jest.fn()
  };
}

function makeRecord(
  deviceUuid = VALID_DEVICE_UUID
): WirelessAlertRecord {
  return WirelessAlertRecord.reconstitute(
    WirelessAlertRecordId.parse(ALERT_UUID).value,
    {
      deviceId: DeviceId.parse(deviceUuid).value,
      metric: 'signal_rx_dbm',
      severity: 'WARNING',
      threshold: -70,
      lastValue: -75,
      message: 'Signal below threshold',
      notifiedAt: null,
      triggeredAt: new Date('2024-01-01T00:00:00.000Z'),
      clearedAt: null,
      isActive: true
    }
  );
}

describe('ClearWirelessAlertUseCase', () => {
  let repo: jest.Mocked<IWirelessAlertRecordRepository>;
  let useCase: ClearWirelessAlertUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new ClearWirelessAlertUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('[WLS-127] should fail on an invalid device id', async () => {
    const result = await useCase.execute({
      deviceId: 'nope',
      alertId: ALERT_UUID
    });
    expect(result.isFailure).toBe(true);
  });

  it('[WLS-127] should fail with 404-mappable message when the alert does not exist', async () => {
    repo.findById.mockResolvedValue(Result.ok(null));
    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      alertId: ALERT_UUID
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });

  it('[WLS-127] should fail when the alert belongs to a different device', async () => {
    repo.findById.mockResolvedValue(
      Result.ok(makeRecord(OTHER_DEVICE_UUID))
    );
    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      alertId: ALERT_UUID
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });

  it('[WLS-127] should clear and save an active alert', async () => {
    const record = makeRecord();
    repo.findById.mockResolvedValue(Result.ok(record));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      alertId: ALERT_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(record.isActive).toBe(false);
  });

  it('[WLS-127] should be idempotent — clearing an already-cleared alert succeeds without saving again', async () => {
    const record = makeRecord();
    record.clear(new Date());
    repo.findById.mockResolvedValue(Result.ok(record));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      alertId: ALERT_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[WLS-127] should fail when save fails', async () => {
    repo.findById.mockResolvedValue(Result.ok(makeRecord()));
    repo.save.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      alertId: ALERT_UUID
    });

    expect(result.isFailure).toBe(true);
  });
});
