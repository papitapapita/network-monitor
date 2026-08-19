import { GetAlertByIdUseCase } from '../../../../src/application/notifications/use-cases/GetAlertByIdUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';

const VALID_ALERT_UUID = '550e8400-e29b-41d4-a716-446655440061';
const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440060';
const STARTED_AT = new Date('2024-06-01T10:00:00.000Z');

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
    findAllOpenByDeviceId: jest.fn(),
    findAllByDeviceId: jest.fn(),
    findAll: jest.fn(),
    deleteById: jest.fn(),
    deleteResolvedOlderThan: jest.fn()
  };
}

function makeAlert(): Alert {
  return Alert.reconstitute(AlertId.parse(VALID_ALERT_UUID).value, {
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    severity: AlertSeverity.CRITICAL,
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión',
    startedAt: STARTED_AT,
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null
  });
}

describe('GetAlertByIdUseCase', () => {
  let alertRepo: jest.Mocked<IAlertRepository>;
  let useCase: GetAlertByIdUseCase;

  beforeEach(() => {
    alertRepo = makeAlertRepo();
    useCase = new GetAlertByIdUseCase(alertRepo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('should fail on an invalid alert id', async () => {
    const result = await useCase.execute({ id: 'not-a-uuid' });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid alert ID');
    expect(alertRepo.findById).not.toHaveBeenCalled();
  });

  it('should return "not found" when no alert exists', async () => {
    alertRepo.findById.mockResolvedValue(Result.ok(null));
    const result = await useCase.execute({ id: VALID_ALERT_UUID });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });

  it('should fail when the repository fails', async () => {
    alertRepo.findById.mockResolvedValue(Result.fail('DB down'));
    const result = await useCase.execute({ id: VALID_ALERT_UUID });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Failed to load alert');
  });

  it('should return the alert DTO including the new fields', async () => {
    alertRepo.findById.mockResolvedValue(Result.ok(makeAlert()));
    const result = await useCase.execute({ id: VALID_ALERT_UUID });
    expect(result.isSuccess).toBe(true);
    expect(result.value).toMatchObject({
      id: VALID_ALERT_UUID,
      source: 'Disponibilidad',
      type: 'device_unreachable',
      description: 'Sin conexión',
      status: 'OPEN'
    });
  });
});
