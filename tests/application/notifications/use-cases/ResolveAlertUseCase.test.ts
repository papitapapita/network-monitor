import { ResolveAlertUseCase } from '../../../../src/application/notifications/use-cases/ResolveAlertUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { ResolveAlertDTO } from '../../../../src/application/notifications/dtos/ResolveAlertDTO';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440081';
const CLEARED_AT = new Date('2024-06-01T10:05:00.000Z');

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
    'Enlace inalámbrico',
    'wireless:signal_rx_dbm:CRITICAL',
    'Señal crítica'
  ).value;
}

function makeRequest(
  overrides: Partial<ResolveAlertDTO> = {}
): ResolveAlertDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    type: 'wireless:signal_rx_dbm:CRITICAL',
    resolvedAt: CLEARED_AT,
    ...overrides
  };
}

describe('ResolveAlertUseCase', () => {
  let repo: jest.Mocked<IAlertRepository>;
  let useCase: ResolveAlertUseCase;

  beforeEach(() => {
    repo = makeAlertRepo();
    useCase = new ResolveAlertUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('should fail on an invalid device id', async () => {
    const result = await useCase.execute(
      makeRequest({ deviceId: 'nope' })
    );
    expect(result.isFailure).toBe(true);
  });

  it('should be a no-op when nothing is open for that type', async () => {
    repo.findOpenByDeviceAndType.mockResolvedValue(Result.ok(null));
    const result = await useCase.execute(makeRequest());
    expect(result.isSuccess).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should resolve and save the open alert', async () => {
    const alert = makeOpenAlert();
    repo.findOpenByDeviceAndType.mockResolvedValue(Result.ok(alert));

    const result = await useCase.execute(makeRequest());
    expect(result.isSuccess).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(alert.isOpen).toBe(false);
    expect(alert.resolvedAt).toEqual(CLEARED_AT);
  });

  it('should fail when save fails', async () => {
    repo.findOpenByDeviceAndType.mockResolvedValue(
      Result.ok(makeOpenAlert())
    );
    repo.save.mockResolvedValue(Result.fail('db down'));
    const result = await useCase.execute(makeRequest());
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to save alert');
  });
});
