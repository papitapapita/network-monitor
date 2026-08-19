import { BulkDeleteAlertsUseCase } from '../../../../src/application/notifications/use-cases/BulkDeleteAlertsUseCase';
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
    deleteById: jest.fn().mockResolvedValue(Result.ok(undefined)),
    deleteResolvedOlderThan: jest.fn()
  };
}

function makeAlert(resolved: boolean): Alert {
  const alert = Alert.open(
    DeviceId.parse(VALID_DEVICE_UUID).value,
    AlertSeverity.CRITICAL,
    'Disponibilidad',
    'device_unreachable',
    'Dispositivo fuera de línea'
  ).value;
  if (resolved) alert.resolve(new Date());
  return alert;
}

describe('BulkDeleteAlertsUseCase', () => {
  let repo: jest.Mocked<IAlertRepository>;
  let useCase: BulkDeleteAlertsUseCase;

  beforeEach(() => {
    repo = makeAlertRepo();
    useCase = new BulkDeleteAlertsUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('[NOT-039] should fail when ids is missing or empty', async () => {
    const result = await useCase.execute({ ids: [] });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('required');
  });

  it('[NOT-039] should delete resolved alerts by id', async () => {
    const alert = makeAlert(true);
    repo.findById.mockResolvedValue(Result.ok(alert));

    const result = await useCase.execute({
      ids: [alert.id.toString()]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deleted).toEqual([alert.id.toString()]);
    expect(repo.deleteById).toHaveBeenCalledTimes(1);
  });

  it('[NOT-039] should skip (not fail) an alert that is still open, without aborting the batch', async () => {
    const openAlert = makeAlert(false);
    const resolvedAlert = makeAlert(true);
    repo.findById.mockImplementation(async (id) => {
      if (id.toString() === openAlert.id.toString())
        return Result.ok(openAlert);
      return Result.ok(resolvedAlert);
    });

    const result = await useCase.execute({
      ids: [openAlert.id.toString(), resolvedAlert.id.toString()]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.skipped).toHaveLength(1);
    expect(result.value.skipped[0].reason).toBe(
      'Cannot delete an alert that is still open'
    );
    expect(result.value.deleted).toEqual([
      resolvedAlert.id.toString()
    ]);
  });

  it('[NOT-039] should bucket a not-found id as failed', async () => {
    repo.findById.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({
      ids: ['11111111-1111-4111-a111-111111111111']
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.failed).toHaveLength(1);
    expect(result.value.failed[0].error).toBe('Alert not found');
  });
});
