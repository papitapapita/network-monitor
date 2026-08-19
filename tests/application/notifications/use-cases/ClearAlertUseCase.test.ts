import { ClearAlertUseCase } from '../../../../src/application/notifications/use-cases/ClearAlertUseCase';
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

describe('ClearAlertUseCase', () => {
  let repo: jest.Mocked<IAlertRepository>;
  let useCase: ClearAlertUseCase;

  beforeEach(() => {
    repo = makeAlertRepo();
    useCase = new ClearAlertUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('[NOT-037] should fail on an invalid alert id', async () => {
    const result = await useCase.execute({ id: 'nope' });
    expect(result.isFailure).toBe(true);
  });

  it('[NOT-037] should fail with "Alert not found" when the alert does not exist', async () => {
    repo.findById.mockResolvedValue(Result.ok(null));
    const result = await useCase.execute({
      id: '11111111-1111-4111-a111-111111111111'
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Alert not found');
  });

  it('[NOT-037] should resolve and save an open alert', async () => {
    const alert = makeOpenAlert();
    repo.findById.mockResolvedValue(Result.ok(alert));

    const result = await useCase.execute({ id: alert.id.toString() });

    expect(result.isSuccess).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(alert.isOpen).toBe(false);
  });

  it('[NOT-037] should be idempotent — clearing an already-resolved alert succeeds without saving again', async () => {
    const alert = makeOpenAlert();
    alert.resolve(new Date());
    repo.findById.mockResolvedValue(Result.ok(alert));

    const result = await useCase.execute({ id: alert.id.toString() });

    expect(result.isSuccess).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[NOT-037] should fail when save fails', async () => {
    const alert = makeOpenAlert();
    repo.findById.mockResolvedValue(Result.ok(alert));
    repo.save.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({ id: alert.id.toString() });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to save alert');
  });
});
