import { OpenAlertUseCase } from '../../../../src/application/notifications/use-cases/OpenAlertUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { OpenAlertDTO } from '../../../../src/application/notifications/dtos/OpenAlertDTO';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440080';

function makeLogger(): ILogger {
  return {
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
    fatal: jest.fn(), child: jest.fn().mockReturnThis(), setLevel: jest.fn()
  };
}

function makeAlertRepo(): jest.Mocked<IAlertRepository> {
  return {
    save: jest.fn().mockImplementation(async (a) => Result.ok(a)),
    findById: jest.fn(),
    findOpenByDeviceAndType: jest.fn().mockResolvedValue(Result.ok(null)),
    findAllByDeviceId: jest.fn(),
    findAll: jest.fn(),
    deleteById: jest.fn(),
    deleteResolvedOlderThan: jest.fn()
  };
}

function makeRequest(overrides: Partial<OpenAlertDTO> = {}): OpenAlertDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    severity: AlertSeverity.CRITICAL,
    source: 'Enlace inalámbrico',
    type: 'wireless:signal_rx_dbm:CRITICAL',
    description: 'Señal crítica',
    details: { metric: 'signal_rx_dbm', threshold: -80, currentValue: -83 },
    ...overrides
  };
}

describe('OpenAlertUseCase', () => {
  let repo: jest.Mocked<IAlertRepository>;
  let useCase: OpenAlertUseCase;

  beforeEach(() => {
    repo = makeAlertRepo();
    useCase = new OpenAlertUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('should fail on an invalid device id', async () => {
    const result = await useCase.execute(makeRequest({ deviceId: 'nope' }));
    expect(result.isFailure).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should be a no-op when an alert of that type is already open (dedup)', async () => {
    const existing = Alert.open(
      DeviceId.parse(VALID_DEVICE_UUID).value,
      AlertSeverity.CRITICAL,
      'Enlace inalámbrico',
      'wireless:signal_rx_dbm:CRITICAL',
      'x'
    ).value;
    repo.findOpenByDeviceAndType.mockResolvedValue(Result.ok(existing));

    const result = await useCase.execute(makeRequest());
    expect(result.isSuccess).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('should create and save a new alert carrying type, source and details', async () => {
    const result = await useCase.execute(makeRequest());
    expect(result.isSuccess).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.type).toBe('wireless:signal_rx_dbm:CRITICAL');
    expect(saved.source).toBe('Enlace inalámbrico');
    expect(saved.details).toMatchObject({ metric: 'signal_rx_dbm' });
  });

  it('should fail when save fails', async () => {
    repo.save.mockResolvedValue(Result.fail('db down'));
    const result = await useCase.execute(makeRequest());
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to save alert');
  });
});
