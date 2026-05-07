// Source: src/application/notifications/use-cases/ListAlertsUseCase.ts

import { ListAlertsUseCase } from '../../../../src/application/notifications/use-cases/ListAlertsUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/notifications/enums/AlertSeverity';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440020';
const VALID_ALERT_UUID  = '550e8400-e29b-41d4-a716-446655440021';
const INVALID_UUID      = 'not-a-valid-uuid';

const STARTED_AT = new Date('2024-06-01T10:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeAlertRepo(): jest.Mocked<IAlertRepository> {
  return {
    save:                jest.fn(),
    findById:            jest.fn(),
    findOpenByDeviceId:  jest.fn(),
    findAllByDeviceId:   jest.fn(),
    findAll:             jest.fn()
  };
}

function makeAlert(): Alert {
  return Alert.reconstitute(AlertId.parse(VALID_ALERT_UUID).value, {
    deviceId:           DeviceId.parse(VALID_DEVICE_UUID).value,
    severity:           AlertSeverity.CRITICAL,
    startedAt:          STARTED_AT,
    resolvedAt:         null,
    notifiedAt:         null,
    recoveryNotifiedAt: null,
    durationSecs:       null
  });
}

// ---------------------------------------------------------------------------

describe('ListAlertsUseCase', () => {
  let alertRepo: jest.Mocked<IAlertRepository>;
  let logger: ILogger;
  let useCase: ListAlertsUseCase;

  beforeEach(() => {
    alertRepo = makeAlertRepo();
    logger    = makeLogger();
    useCase   = new ListAlertsUseCase(alertRepo, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('executeImpl — listing all alerts (no deviceId)', () => {
    it('should return a successful result with alert list DTO', async () => {
      // arrange
      const alert = makeAlert();
      alertRepo.findAll.mockResolvedValue(Result.ok([alert]));

      // act
      const result = await useCase.execute({});

      // assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.alerts).toHaveLength(1);
    });

    it('should call findAll with default limit=50 and offset=0', async () => {
      // arrange
      alertRepo.findAll.mockResolvedValue(Result.ok([]));

      // act
      await useCase.execute({});

      // assert
      expect(alertRepo.findAll).toHaveBeenCalledWith(50, 0);
    });

    it('should call findAll with the provided limit and offset', async () => {
      // arrange
      alertRepo.findAll.mockResolvedValue(Result.ok([]));

      // act
      await useCase.execute({ limit: 10, offset: 20 });

      // assert
      expect(alertRepo.findAll).toHaveBeenCalledWith(10, 20);
    });

    it('should not call findAllByDeviceId when no deviceId is provided', async () => {
      // arrange
      alertRepo.findAll.mockResolvedValue(Result.ok([]));

      // act
      await useCase.execute({});

      // assert
      expect(alertRepo.findAllByDeviceId).not.toHaveBeenCalled();
    });

    it('should return a failure when findAll returns a failure', async () => {
      // arrange
      alertRepo.findAll.mockResolvedValue(Result.fail('DB connection lost'));

      // act
      const result = await useCase.execute({});

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to list alerts');
    });

    it('should return an empty alerts array when the repository returns an empty list', async () => {
      // arrange
      alertRepo.findAll.mockResolvedValue(Result.ok([]));

      // act
      const result = await useCase.execute({});

      // assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.alerts).toEqual([]);
      expect(result.value.total).toBe(0);
    });
  });

  // ===========================================================================
  describe('executeImpl — listing alerts by deviceId', () => {
    it('should call findAllByDeviceId with the parsed DeviceId', async () => {
      // arrange
      alertRepo.findAllByDeviceId.mockResolvedValue(Result.ok([]));

      // act
      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      // assert
      expect(alertRepo.findAllByDeviceId).toHaveBeenCalledTimes(1);
      const calledDeviceId: DeviceId = alertRepo.findAllByDeviceId.mock.calls[0][0];
      expect(calledDeviceId.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should call findAllByDeviceId with default limit and offset', async () => {
      // arrange
      alertRepo.findAllByDeviceId.mockResolvedValue(Result.ok([]));

      // act
      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      // assert
      expect(alertRepo.findAllByDeviceId).toHaveBeenCalledWith(
        expect.anything(),
        50,
        0
      );
    });

    it('should return a successful result filtered to the device', async () => {
      // arrange
      const alert = makeAlert();
      alertRepo.findAllByDeviceId.mockResolvedValue(Result.ok([alert]));

      // act
      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      // assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.alerts[0].deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should return a failure when deviceId is an invalid UUID', async () => {
      // act
      const result = await useCase.execute({ deviceId: INVALID_UUID });

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should not call findAll when a deviceId is provided', async () => {
      // arrange
      alertRepo.findAllByDeviceId.mockResolvedValue(Result.ok([]));

      // act
      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      // assert
      expect(alertRepo.findAll).not.toHaveBeenCalled();
    });

    it('should return a failure when findAllByDeviceId returns a failure', async () => {
      // arrange
      alertRepo.findAllByDeviceId.mockResolvedValue(Result.fail('Timeout'));

      // act
      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to list alerts');
    });
  });
});
