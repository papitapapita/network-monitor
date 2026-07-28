import { DeleteAlertUseCase } from '../../../../src/application/notifications/use-cases/DeleteAlertUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';

const VALID_ALERT_UUID = '550e8400-e29b-41d4-a716-446655440063';
const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440062';
const STARTED_AT = new Date('2024-06-01T10:00:00.000Z');
const RESOLVED_AT = new Date('2024-06-01T10:05:00.000Z');

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
    save: jest.fn(),
    findById: jest.fn(),
    findOpenByDeviceAndType: jest.fn(),
    findAllByDeviceId: jest.fn(),
    findAll: jest.fn(),
    deleteById: jest.fn().mockResolvedValue(Result.ok()),
    deleteResolvedOlderThan: jest.fn()
  };
}

function makeAlert(resolved: boolean): Alert {
  return Alert.reconstitute(AlertId.parse(VALID_ALERT_UUID).value, {
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    severity: AlertSeverity.CRITICAL,
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión',
    startedAt: STARTED_AT,
    resolvedAt: resolved ? RESOLVED_AT : null,
    notifiedAt: null,
    recoveryNotifiedAt: resolved ? RESOLVED_AT : null
  });
}

describe('DeleteAlertUseCase', () => {
  let alertRepo: jest.Mocked<IAlertRepository>;
  let useCase: DeleteAlertUseCase;

  beforeEach(() => {
    alertRepo = makeAlertRepo();
    useCase = new DeleteAlertUseCase(alertRepo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('should fail on an invalid alert id', async () => {
    const result = await useCase.execute({ id: 'not-a-uuid' });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid alert ID');
    expect(alertRepo.deleteById).not.toHaveBeenCalled();
  });

  it('should return "not found" when the alert does not exist', async () => {
    alertRepo.findById.mockResolvedValue(Result.ok(null));
    const result = await useCase.execute({ id: VALID_ALERT_UUID });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
    expect(alertRepo.deleteById).not.toHaveBeenCalled();
  });

  it('should refuse to delete an alert that is still open', async () => {
    alertRepo.findById.mockResolvedValue(Result.ok(makeAlert(false)));
    const result = await useCase.execute({ id: VALID_ALERT_UUID });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('still open');
    expect(alertRepo.deleteById).not.toHaveBeenCalled();
  });

  it('should delete a resolved alert', async () => {
    alertRepo.findById.mockResolvedValue(Result.ok(makeAlert(true)));
    const result = await useCase.execute({ id: VALID_ALERT_UUID });
    expect(result.isSuccess).toBe(true);
    expect(alertRepo.deleteById).toHaveBeenCalledTimes(1);
  });

  it('should propagate a repository delete failure', async () => {
    alertRepo.findById.mockResolvedValue(Result.ok(makeAlert(true)));
    alertRepo.deleteById.mockResolvedValue(Result.fail('FK violation'));
    const result = await useCase.execute({ id: VALID_ALERT_UUID });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to delete alert');
  });
});
