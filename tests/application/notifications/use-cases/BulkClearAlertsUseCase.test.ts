import { BulkClearAlertsUseCase } from '../../../../src/application/notifications/use-cases/BulkClearAlertsUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440081';

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

function makeAlertRepo(): jest.Mocked<IAlertRepository> {
  return {
    save: jest.fn().mockImplementation(async (a) => Result.ok(a)),
    findById: jest.fn(),
    findOpenByDeviceAndType: jest.fn(),
    findAllOpenByDeviceId: jest.fn(),
    findAllByDeviceId: jest.fn(),
    findAll: jest.fn(),
    deleteById: jest.fn(),
    deleteResolvedOlderThan: jest.fn()
  };
}

function makeOpenAlert(): Alert {
  return Alert.open(
    DeviceId.parse(VALID_DEVICE_UUID).value,
    AlertSeverity.CRITICAL,
    'Disponibilidad',
    'device_unreachable',
    'Dispositivo fuera de línea'
  ).value;
}

describe('BulkClearAlertsUseCase', () => {
  let repo: jest.Mocked<IAlertRepository>;
  let useCase: BulkClearAlertsUseCase;

  beforeEach(() => {
    repo = makeAlertRepo();
    useCase = new BulkClearAlertsUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('[NOT-038] should fail when neither ids nor deviceId is provided', async () => {
    const result = await useCase.execute({});
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('required');
  });

  it('[NOT-038] should fail when both ids and deviceId are provided', async () => {
    const result = await useCase.execute({
      ids: ['11111111-1111-4111-a111-111111111111'],
      deviceId: VALID_DEVICE_UUID
    });
    expect(result.isFailure).toBe(true);
  });

  it('[NOT-038] should clear every open alert for a device when deviceId is given', async () => {
    const a = makeOpenAlert();
    const b = makeOpenAlert();
    repo.findAllOpenByDeviceId.mockResolvedValue(Result.ok([a, b]));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.cleared).toHaveLength(2);
    expect(result.value.skipped).toHaveLength(0);
    expect(result.value.failed).toHaveLength(0);
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('[NOT-038] should clear alerts by explicit ids and bucket a missing id as failed', async () => {
    const a = makeOpenAlert();
    repo.findById.mockImplementation(async (id) => {
      if (id.toString() === a.id.toString()) return Result.ok(a);
      return Result.ok(null);
    });

    const result = await useCase.execute({
      ids: [a.id.toString(), '11111111-1111-4111-a111-111111111111']
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.cleared).toHaveLength(1);
    expect(result.value.failed).toHaveLength(1);
    expect(result.value.failed[0].error).toBe('Alert not found');
  });

  it('[NOT-038] should bucket an already-resolved alert as skipped, not failed', async () => {
    const a = makeOpenAlert();
    a.resolve(new Date());
    repo.findById.mockResolvedValue(Result.ok(a));

    const result = await useCase.execute({ ids: [a.id.toString()] });

    expect(result.isSuccess).toBe(true);
    expect(result.value.skipped).toHaveLength(1);
    expect(result.value.cleared).toHaveLength(0);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[NOT-038] should fail the whole request when the device query itself fails', async () => {
    repo.findAllOpenByDeviceId.mockResolvedValue(
      Result.fail('db down')
    );

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isFailure).toBe(true);
  });
});
