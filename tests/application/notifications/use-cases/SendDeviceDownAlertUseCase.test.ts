// Source: src/application/notifications/use-cases/SendDeviceDownAlertUseCase.ts

import { SendDeviceDownAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { SendDeviceDownAlertDTO } from '../../../../src/application/notifications/dtos/SendDeviceDownAlertDTO';
import { QUIET_HOURS_SUPPRESSED } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import {
  Device,
  DeviceEligibilityService,
  DeviceName,
  DeviceOwnerType,
  DeviceStatus,
  SerialNumber
} from '../../../../src/domain/device-inventory';
import { DeviceModelId } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440030';
const VALID_ALERT_UUID = '550e8400-e29b-41d4-a716-446655440031';
const INVALID_UUID = 'not-a-valid-uuid';

const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

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

function makePollingConfigRepo(): jest.Mocked<IPollingConfigurationRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    delete: jest.fn()
  };
}

function makeAlertPublisher(): jest.Mocked<IAlertPublisher> {
  return {
    publish: jest.fn().mockResolvedValue(Result.ok())
  };
}

function makeRequest(
  overrides: Partial<SendDeviceDownAlertDTO> = {}
): SendDeviceDownAlertDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    consecutiveFailures: 3,
    occurredAt: FIXED_DATE,
    ...overrides
  };
}

function makeOpenAlert(notifiedAt: Date | null = null): Alert {
  return Alert.reconstitute(AlertId.parse(VALID_ALERT_UUID).value, {
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    severity: AlertSeverity.CRITICAL,
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión',
    startedAt: FIXED_DATE,
    resolvedAt: null,
    notifiedAt,
    recoveryNotifiedAt: null
  });
}

// The eligibility service is pure, so the real one is used rather than a
// mock — only the device it reads is faked.
function makeDevice(
  overrides: Partial<Parameters<typeof Device.reconstitute>[1]> = {}
): Device {
  return Device.reconstitute(
    DeviceId.parse(VALID_DEVICE_UUID).value,
    {
      deviceModelId: DeviceModelId.create(),
      name: DeviceName.create('CPE-Vargas').value,
      status: DeviceStatus.createActive(),
      ownerType: DeviceOwnerType.COMPANY,
      locationId: null,
      category: null,
      serialNumber: SerialNumber.create('SN-DEFAULT').value,
      macAddress: null,
      ipAddress: null,
      description: null,
      installedDate: null,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      monitoringEnabled: true,
      ...overrides
    }
  );
}

function makeDeviceRepo(device: Device | null = makeDevice()) {
  return {
    findById: jest.fn().mockResolvedValue(Result.ok(device))
  };
}

/** Minimal fake polling config stub (only the field the use case reads). */
function makePollingConfig(ip = '192.168.1.1'): PollingConfiguration {
  return {
    ipAddress: { value: ip }
  } as unknown as PollingConfiguration;
}

// ---------------------------------------------------------------------------

describe('SendDeviceDownAlertUseCase', () => {
  let alertRepo: jest.Mocked<IAlertRepository>;
  let pollingConfigRepo: jest.Mocked<IPollingConfigurationRepository>;
  let alertPublisher: jest.Mocked<IAlertPublisher>;
  let deviceRepo: ReturnType<typeof makeDeviceRepo>;
  let logger: ILogger;
  let useCase: SendDeviceDownAlertUseCase;

  function buildUseCase(
    repo = deviceRepo
  ): SendDeviceDownAlertUseCase {
    return new SendDeviceDownAlertUseCase(
      alertRepo,
      pollingConfigRepo,
      repo as unknown as IDeviceRepository,
      new DeviceEligibilityService(),
      alertPublisher,
      logger
    );
  }

  beforeEach(() => {
    alertRepo = makeAlertRepo();
    pollingConfigRepo = makePollingConfigRepo();
    alertPublisher = makeAlertPublisher();
    deviceRepo = makeDeviceRepo();
    logger = makeLogger();
    useCase = buildUseCase();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — input validation', () => {
    it('should fail when deviceId is an empty string', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '' })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceId is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '   ' })
      );
      expect(result.isFailure).toBe(true);
    });

    it('should fail when consecutiveFailures is negative', async () => {
      const result = await useCase.execute(
        makeRequest({ consecutiveFailures: -1 })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'consecutiveFailures must be >= 0'
      );
    });

    it('should not fail when consecutiveFailures is zero', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );

      const result = await useCase.execute(
        makeRequest({ consecutiveFailures: 0 })
      );
      expect(result.isFailure).toBe(false);
    });
  });

  // ===========================================================================
  describe('executeImpl — invalid UUID', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: INVALID_UUID })
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('[DEV-087] executeImpl — device eligibility at dispatch time', () => {
    it('should suppress the alert when the device has been deleted', async () => {
      const suppressed = buildUseCase(makeDeviceRepo(null));

      const result = await suppressed.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
      expect(alertRepo.save).not.toHaveBeenCalled();
      expect(alertPublisher.publish).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should suppress the alert when the device has been retired', async () => {
      const suppressed = buildUseCase(
        makeDeviceRepo(
          makeDevice({ status: DeviceStatus.createDamaged() })
        )
      );

      const result = await suppressed.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('should not even look for an existing alert when suppressed', async () => {
      const suppressed = buildUseCase(makeDeviceRepo(null));

      await suppressed.execute(makeRequest());

      expect(
        alertRepo.findOpenByDeviceAndType
      ).not.toHaveBeenCalled();
    });

    it('should fail when the device lookup itself fails', async () => {
      const broken = buildUseCase({
        findById: jest.fn().mockResolvedValue(Result.fail('db down'))
      });

      const result = await broken.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to load device for alert'
      );
      expect(alertRepo.save).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — existing open alert, already notified', () => {
    it('should return the existing open alert DTO without creating a new one', async () => {
      const existing = makeOpenAlert(FIXED_DATE);
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(existing)
      );

      const result = await useCase.execute(makeRequest());
      expect(result.isSuccess).toBe(true);
      expect(result.value?.id).toBe(VALID_ALERT_UUID);
    });

    it('should not call alertRepository.save when the open alert was already notified', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert(FIXED_DATE))
      );
      await useCase.execute(makeRequest());
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('should not publish again when the open alert was already notified', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert(FIXED_DATE))
      );
      await useCase.execute(makeRequest());
      expect(alertPublisher.publish).not.toHaveBeenCalled();
    });

    it('should return a failure when findOpenByDeviceAndType itself fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.fail('Repo error')
      );
      const result = await useCase.execute(makeRequest());
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to check existing alerts'
      );
    });
  });

  // ===========================================================================
  describe('[NOT-175] executeImpl — existing open alert, not yet notified', () => {
    beforeEach(() => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert(null))
      );
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));
    });

    it('retries delivery instead of handing the alert back untouched', async () => {
      await useCase.execute(makeRequest());
      expect(alertPublisher.publish).toHaveBeenCalledTimes(1);
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
    });

    it('marks the alert notified once the retry succeeds', async () => {
      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      await useCase.execute(makeRequest());
      expect(capturedAlert!.notifiedAt).not.toBeNull();
    });

    it('does not log a suppressed quiet-hours retry as an error', async () => {
      alertPublisher.publish.mockResolvedValue(
        Result.fail(QUIET_HOURS_SUPPRESSED)
      );

      await useCase.execute(makeRequest());
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('leaves the alert unnotified when the quiet-hours retry is suppressed', async () => {
      alertPublisher.publish.mockResolvedValue(
        Result.fail(QUIET_HOURS_SUPPRESSED)
      );
      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      await useCase.execute(makeRequest());
      expect(capturedAlert!.notifiedAt).toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path: creates alert, publishes, saves', () => {
    beforeEach(() => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
    });

    it('should return a successful DTO with status OPEN', async () => {
      const result = await useCase.execute(makeRequest());
      expect(result.isSuccess).toBe(true);
      expect(result.value?.status).toBe('OPEN');
    });

    it('should call alertRepository.save exactly once', async () => {
      await useCase.execute(makeRequest());
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should publish exactly one CRITICAL, unresolved availability alert', async () => {
      await useCase.execute(makeRequest());
      expect(alertPublisher.publish).toHaveBeenCalledTimes(1);
      expect(alertPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: VALID_DEVICE_UUID,
          severity: AlertSeverity.CRITICAL,
          source: 'Disponibilidad',
          resolved: false,
          occurredAt: FIXED_DATE
        })
      );
    });

    it('should fold the IP into the detail', async () => {
      await useCase.execute(makeRequest({ consecutiveFailures: 5 }));
      const envelope = alertPublisher.publish.mock.calls[0][0];
      expect(envelope.detail).toContain('192.168.1.1');
    });

    it('should save the alert with notifiedAt set when publish succeeds', async () => {
      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      await useCase.execute(makeRequest());
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.notifiedAt).not.toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — publish failure', () => {
    it('should still save the alert when publish fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      alertPublisher.publish.mockResolvedValue(
        Result.fail('Telegram unavailable')
      );
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );

      const result = await useCase.execute(makeRequest());
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
      expect(result.isSuccess).toBe(true);
    });

    it('should save the alert without notifiedAt when publish fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      alertPublisher.publish.mockResolvedValue(
        Result.fail('Telegram unavailable')
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );

      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      await useCase.execute(makeRequest());
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.notifiedAt).toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — repository save failure', () => {
    it('should return a failure result when alertRepository.save fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      alertRepo.save.mockResolvedValue(Result.fail('Write conflict'));
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );

      const result = await useCase.execute(makeRequest());
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save alert');
    });
  });

  // ===========================================================================
  describe('executeImpl — IP address fallback', () => {
    it('should still publish (without IP in detail) when polling config lookup fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.fail('Repo error')
      );
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));

      await useCase.execute(makeRequest());
      const envelope = alertPublisher.publish.mock.calls[0][0];
      expect(envelope.detail).not.toContain('IP:');
    });

    it('should still publish when pollingConfigRepository.findByDeviceId throws', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      pollingConfigRepo.findByDeviceId.mockRejectedValue(
        new Error('Timeout')
      );
      alertRepo.save.mockResolvedValue(Result.ok(makeOpenAlert()));

      const result = await useCase.execute(makeRequest());
      expect(result.isSuccess).toBe(true);
      expect(alertPublisher.publish).toHaveBeenCalledTimes(1);
    });
  });
});
