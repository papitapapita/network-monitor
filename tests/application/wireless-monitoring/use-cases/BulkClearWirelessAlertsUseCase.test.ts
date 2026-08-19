import { BulkClearWirelessAlertsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/BulkClearWirelessAlertsUseCase';
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
const ALERT_UUID_2 = '550e8400-e29b-41d4-a716-446655440003';
const MISSING_ALERT_UUID = '550e8400-e29b-41d4-a716-446655440009';

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
  alertUuid: string,
  deviceUuid = VALID_DEVICE_UUID
): WirelessAlertRecord {
  return WirelessAlertRecord.reconstitute(
    WirelessAlertRecordId.parse(alertUuid).value,
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

describe('BulkClearWirelessAlertsUseCase', () => {
  let repo: jest.Mocked<IWirelessAlertRecordRepository>;
  let useCase: BulkClearWirelessAlertsUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new BulkClearWirelessAlertsUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('[WLS-128] should clear every active alert for the device when ids is omitted', async () => {
    const a = makeRecord(ALERT_UUID);
    const b = makeRecord(ALERT_UUID_2);
    repo.findAllActiveByDevice.mockResolvedValue(Result.ok([a, b]));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.cleared).toHaveLength(2);
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('[WLS-128] should clear only the given ids and bucket a missing id as failed', async () => {
    const a = makeRecord(ALERT_UUID);
    repo.findById.mockImplementation(async (id) => {
      if (id.toString() === ALERT_UUID) return Result.ok(a);
      return Result.ok(null);
    });

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      ids: [ALERT_UUID, MISSING_ALERT_UUID]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.cleared).toHaveLength(1);
    expect(result.value.failed).toHaveLength(1);
  });

  it('[WLS-128] should bucket an alert belonging to another device as failed, not cleared', async () => {
    const foreign = makeRecord(ALERT_UUID, OTHER_DEVICE_UUID);
    repo.findById.mockResolvedValue(Result.ok(foreign));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      ids: [ALERT_UUID]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.failed).toHaveLength(1);
    expect(result.value.cleared).toHaveLength(0);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[WLS-128] should bucket an already-cleared alert as skipped, not failed', async () => {
    const record = makeRecord(ALERT_UUID);
    record.clear(new Date());
    repo.findById.mockResolvedValue(Result.ok(record));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      ids: [ALERT_UUID]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.skipped).toHaveLength(1);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[WLS-128] should fail the whole request on an invalid device id', async () => {
    const result = await useCase.execute({ deviceId: 'nope' });
    expect(result.isFailure).toBe(true);
  });
});
