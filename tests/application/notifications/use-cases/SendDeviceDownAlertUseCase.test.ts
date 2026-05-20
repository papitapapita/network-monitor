// Source: src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts

import { SendDeviceDownAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceDownAlertUseCase';
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
import { SendDeviceDownAlertDTO } from '../../../../src/application/notifications/dtos/SendDeviceDownAlertDTO';
import { Device } from '../../../../src/domain/device-inventory/aggregates/Device';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440030';
const VALID_ALERT_UUID  = '550e8400-e29b-41d4-a716-446655440031';
const INVALID_UUID      = 'not-a-valid-uuid';

const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

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
    save:         jest.fn(),
    findById:     jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue:   jest.fn(),
    delete:       jest.fn()
  };
}

function makeNotificationService(): jest.Mocked<INotificationService> {
  return {
    send: jest.fn()
  };
}

function makeRequest(
  overrides: Partial<SendDeviceDownAlertDTO> = {}
): SendDeviceDownAlertDTO {
  return {
    deviceId:            VALID_DEVICE_UUID,
    consecutiveFailures: 3,
    occurredAt:          FIXED_DATE,
    ...overrides
  };
}

function makeOpenAlert(): Alert {
  return Alert.reconstitute(AlertId.parse(VALID_ALERT_UUID).value, {
    deviceId:           DeviceId.parse(VALID_DEVICE_UUID).value,
    severity:           AlertSeverity.CRITICAL,
    startedAt:          FIXED_DATE,
    resolvedAt:         null,
    notifiedAt:         null,
    recoveryNotifiedAt: null,
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

describe('SendDeviceDownAlertUseCase', () => {
  let alertRepo:           jest.Mocked<IAlertRepository>;
  let deviceRepo:          jest.Mocked<IDeviceRepository>;
  let pollingConfigRepo:   jest.Mocked<IPollingConfigurationRepository>;
  let notificationService: jest.Mocked<INotificationService>;
  let logger:              ILogger;
  let useCase:             SendDeviceDownAlertUseCase;

  beforeEach(() => {
    alertRepo           = makeAlertRepo();
    deviceRepo          = makeDeviceRepo();
    pollingConfigRepo   = makePollingConfigRepo();
    notificationService = makeNotificationService();
    logger              = makeLogger();
    useCase = new SendDeviceDownAlertUseCase(
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

    it('should fail when consecutiveFailures is negative', async () => {
      // act
      const result = await useCase.execute(
        makeRequest({ consecutiveFailures: -1 })
      );

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('consecutiveFailures must be >= 0');
    });

    it('should not fail when consecutiveFailures is zero', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));

      // act
      const result = await useCase.execute(
        makeRequest({ consecutiveFailures: 0 })
      );

      // assert
      expect(result.isFailure).toBe(false);
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
  describe('executeImpl — existing open alert', () => {
    it('should return the existing open alert DTO without creating a new one', async () => {
      // arrange
      const existing = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(existing));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBe(VALID_ALERT_UUID);
    });

    it('should not call alertRepository.save when an open alert already exists', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(makeOpenAlert()));

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('should not call notificationService.send when an open alert already exists', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(makeOpenAlert()));

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should return a failure when findOpenByDeviceId itself fails', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.fail('Repo error'));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to check existing alerts');
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path: creates alert, notifies, saves', () => {
    it('should return a successful DTO with status OPEN', async () => {
      // arrange
      const savedAlert = makeOpenAlert();
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      alertRepo.save.mockResolvedValue(Result.ok(savedAlert));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('OPEN');
    });

    it('should call alertRepository.save exactly once', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should call notificationService.send exactly once', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));
      notificationService.send.mockResolvedValue(Result.ok(undefined));

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(notificationService.send).toHaveBeenCalledTimes(1);
    });

    it('should save the alert with notifiedAt set when notification succeeds', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));

      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.notifiedAt).not.toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — notification failure', () => {
    it('should still save the alert when notificationService.send fails', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      notificationService.send.mockResolvedValue(Result.fail('Telegram unavailable'));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
      expect(result.isSuccess).toBe(true);
    });

    it('should save the alert without notifiedAt when notification fails', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      notificationService.send.mockResolvedValue(Result.fail('Telegram unavailable'));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));

      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      // act
      await useCase.execute(makeRequest());

      // assert
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.notifiedAt).toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — repository save failure', () => {
    it('should return a failure result when alertRepository.save fails', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockResolvedValue(Result.fail('Write conflict'));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(makePollingConfig()));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save alert');
    });
  });

  // ===========================================================================
  describe('executeImpl — device name fallback', () => {
    it('should use "Unknown Device" when deviceRepository.findById returns a failure', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      deviceRepo.findById.mockResolvedValue(Result.fail('Not found'));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));

      // act
      const result = await useCase.execute(makeRequest());

      // assert — no crash, still succeeds
      expect(result.isSuccess).toBe(true);
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.deviceName).toBe('Unknown Device');
    });

    it('should use "Unknown Device" when deviceRepository.findById returns null', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      deviceRepo.findById.mockResolvedValue(Result.ok(null));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));

      // act
      await useCase.execute(makeRequest());

      // assert
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.deviceName).toBe('Unknown Device');
    });

    it('should use "Unknown Device" when deviceRepository.findById throws', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      deviceRepo.findById.mockRejectedValue(new Error('DB crash'));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));

      // act
      const result = await useCase.execute(makeRequest());

      // assert — should not throw, still continues
      expect(result.isSuccess).toBe(true);
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.deviceName).toBe('Unknown Device');
    });
  });

  // ===========================================================================
  describe('executeImpl — IP address fallback', () => {
    it('should use null IP when pollingConfigRepository.findByDeviceId returns a failure', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(Result.fail('Repo error'));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));

      // act
      await useCase.execute(makeRequest());

      // assert
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.ipAddress).toBeNull();
    });

    it('should use null IP when polling config has no ipAddress', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok({ ipAddress: null } as unknown as PollingConfiguration)
      );
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));

      // act
      await useCase.execute(makeRequest());

      // assert
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.ipAddress).toBeNull();
    });

    it('should use null IP when pollingConfigRepository.findByDeviceId throws', async () => {
      // arrange
      alertRepo.findOpenByDeviceId.mockResolvedValue(Result.ok(null));
      deviceRepo.findById.mockResolvedValue(Result.ok(makeDevice()));
      pollingConfigRepo.findByDeviceId.mockRejectedValue(new Error('Timeout'));
      notificationService.send.mockResolvedValue(Result.ok(undefined));
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));

      // act
      const result = await useCase.execute(makeRequest());

      // assert
      expect(result.isSuccess).toBe(true);
      const sentMessage = notificationService.send.mock.calls[0][0];
      expect(sentMessage.metadata.ipAddress).toBeNull();
    });
  });
});
