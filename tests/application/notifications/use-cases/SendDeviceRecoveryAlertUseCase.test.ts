// Source: src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts

import { SendDeviceRecoveryAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { INotificationService } from '../../../../src/application/notifications/interfaces/INotificationService';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/notifications/enums/AlertSeverity';
import { SendDeviceRecoveryAlertDTO } from '../../../../src/application/notifications/dtos/SendDeviceRecoveryAlertDTO';
import { Device } from '../../../../src/domain/device-inventory/aggregates/Device';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440040';
const VALID_ALERT_UUID  = '550e8400-e29b-41d4-a716-446655440041';
const INVALID_UUID      = 'not-a-valid-uuid';

const STARTED_AT  = new Date('2024-06-01T10:00:00.000Z');
const OCCURRED_AT = new Date('2024-06-01T10:01:40.000Z');

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
    save:               jest.fn(),
    findById:           jest.fn(),
    findOpenByDeviceId: jest.fn(),
    findAllByDeviceId:  jest.fn(),
    findAll:            jest.fn()
  };
}

function makeDeviceRepo(): jest.Mocked<IDeviceRepository> {
  return {
    save:                jest.fn(),
    findById:            jest.fn(),
    delete:              jest.fn(),
    exists:              jest.fn(),
    count:               jest.fn(),
    findAll:             jest.fn(),
    findByLocation:      jest.fn(),
    findByDeviceModel:   jest.fn(),
    findByMacAddress:    jest.fn(),
    findByIpAddress:     jest.fn(),
    findByStatus:        jest.fn(),
    existsByMacAddress:  jest.fn(),
    existsByIpAddress:   jest.fn(),
    findByFilters:       jest.fn()
  };
}

function makePollingConfigRepo(): jest.Mocked<IPollingConfigurationRepository> {
  return {
    save:           jest.fn(),
    findById:       jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue:     jest.fn(),
    delete:         jest.fn()
  };
}

function makeNotificationService(): jest.Mocked<INotificationService> {
  return {
    send: jest.fn()
  };
}

function makeRequest(
  overrides: Partial<SendDeviceRecoveryAlertDTO> = {}
): SendDeviceRecoveryAlertDTO {
  return {
    deviceId:   VALID_DEVICE_UUID,
    latencyMs:  12,
    occurredAt: OCCURRED_AT,
    ...overrides
  };
}

/** Returns an open (unresolved) alert. */
function makeOpenAlert(): Alert {
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

/** Creates a minimal fake device stub (only the fields the use case reads). */
function makeDevice(name = 'Core-Router-01'): Device {
  return { name: { value: name } } as unknown as Device;
}

/** Creates a minimal fake polling config stub (only the field the use case reads). */
function makePollingConfig(ip = '192.168.1.1'): PollingConfiguration {
  return { ipAddress: { value: ip } } as unknown as PollingConfiguration;
}

// ---------------------------------------------------------------------------

describe('SendDeviceRecoveryAlertUseCase', () => {
  let alertRepo:           jest.Mocked<IAlertRepository>;
  let deviceRepo:          jest.Mocked<IDeviceRepository>;
  let pollingConfigRepo:   jest.Mocked<IPollingConfigurationRepository>;
  let notificationService: jest.Mocked<INotificationService>;
  let logger:              ILogger;
  let useCase:             SendDeviceRecoveryAlertUseCase;

  beforeEach(() => {
    alertRepo           = makeAlertRepo();
    deviceRepo          = makeDeviceRepo();
    pollingConfigRepo   = makePollingConfigRepo();
    notificationService = makeNotificationService();
    logger              = makeLogger();
    useCase = new SendDeviceRecoveryAlertUseCase(
      alertRepo,
      deviceRepo,
      pollingConfigRepo,
      notificationService,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — input validation', () => {
    it('should fail when deviceId is an empty string', async () => {
      // act
      const result = await useCase.execute(makeRequest({ deviceId: '' }));

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceId is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      // act
      const result = await useCase.execute(makeRequest({ deviceId: '   ' }));

      // assert
      expect(result.isFailure).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — invalid UUID', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      // act
      const result = await useCase.execute(makeRequest({ deviceId: INVALID_UUID }));

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — no open alert found (skip recovery)', () => {
    it('should return a failure with a skip message when no open alert exists', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('recovery skipped');
    });

    it('should not call alertRepository.save when no open alert is found', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('should not call notificationService.send when no open alert is found', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should return a failure when findOpenByDeviceId itself returns a failure', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.fail('DB error'));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load open alert');
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path: resolves alert, notifies, saves', () => {
    it('should return a successful DTO with status RESOLVED', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('RESOLVED');
    });

    it('should call alertRepository.save exactly once', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should call notificationService.send exactly once', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(notificationService.send).toHaveBeenCalledTimes(1);
    });

    it('should save the alert with recoveryNotifiedAt set when notification succeeds', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));

      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.recoveryNotifiedAt).not.toBeNull();
    });

    it('should set resolvedAt on the alert before saving', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));

      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.resolvedAt).toEqual(OCCURRED_AT);
    });
  });

  // ===========================================================================
  describe('executeImpl — notification failure', () => {
    it('should still save the alert when notificationService.send fails', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.fail('Telegram down'));
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
      expect(result.isSuccess).toBe(true);
    });

    it('should save the alert without recoveryNotifiedAt when notification fails', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.fail('Telegram down'));

      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.recoveryNotifiedAt).toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — repository save failure', () => {
    it('should return a failure result when alertRepository.save fails', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockResolvedValue(Result.fail('Write conflict'));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save alert');
    });
  });

  // ===========================================================================
  describe('executeImpl — device name fallback on resolution', () => {
    it('should use "Unknown Device" when deviceRepository.findById returns a failure', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.fail('Not found'));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isSuccess).toBe(true);
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.deviceName).toBe('Unknown Device');
    });

    it('should use null IP when pollingConfigRepository returns a failure', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.fail('Unavailable'));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      // act
      await useCase.execute(makeRequest());

      // assert
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.ipAddress).toBeNull();
    });

    it('should use null IP when pollingConfigRepository throws', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockRejectedValue(new Error('Timeout'));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isSuccess).toBe(true);
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.ipAddress).toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — latencyMs variants', () => {
    it('should succeed when latencyMs is null (no latency data)', async () => {
      // arrange
      const openAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(openAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      // act
      const result = await useCase.execute(makeRequest({ latencyMs: null }));

      // assert
      expect(result.isSuccess).toBe(true);
    });
  });
});
