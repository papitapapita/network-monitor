// Source: src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase.ts

import { SendDeviceRecoveryAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { IPollingConfigurationRepository } from '../../../../src/domain/device-monitoring/repository/IPollingConfigurationRepository';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { SendDeviceRecoveryAlertDTO } from '../../../../src/application/notifications/dtos/SendDeviceRecoveryAlertDTO';
import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440040';
const VALID_ALERT_UUID = '550e8400-e29b-41d4-a716-446655440041';
const INVALID_UUID = 'not-a-valid-uuid';

const STARTED_AT = new Date('2024-06-01T10:00:00.000Z');
const OCCURRED_AT = new Date('2024-06-01T10:01:40.000Z');

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
  overrides: Partial<SendDeviceRecoveryAlertDTO> = {}
): SendDeviceRecoveryAlertDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    latencyMs: 12,
    occurredAt: OCCURRED_AT,
    ...overrides
  };
}

/** Returns an open (unresolved) alert. */
function makeOpenAlert(): Alert {
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

/** Minimal fake polling config stub (only the field the use case reads). */
function makePollingConfig(ip = '192.168.1.1'): PollingConfiguration {
  return {
    ipAddress: { value: ip }
  } as unknown as PollingConfiguration;
}

// ---------------------------------------------------------------------------

describe('SendDeviceRecoveryAlertUseCase', () => {
  let alertRepo: jest.Mocked<IAlertRepository>;
  let pollingConfigRepo: jest.Mocked<IPollingConfigurationRepository>;
  let alertPublisher: jest.Mocked<IAlertPublisher>;
  let logger: ILogger;
  let useCase: SendDeviceRecoveryAlertUseCase;

  beforeEach(() => {
    alertRepo = makeAlertRepo();
    pollingConfigRepo = makePollingConfigRepo();
    alertPublisher = makeAlertPublisher();
    logger = makeLogger();
    useCase = new SendDeviceRecoveryAlertUseCase(
      alertRepo,
      pollingConfigRepo,
      alertPublisher,
      logger
    );
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
  describe('executeImpl — no open alert found (skip recovery)', () => {
    it('should return a failure with a skip message when no open alert exists', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      const result = await useCase.execute(makeRequest());
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('recovery skipped');
    });

    it('should not call alertRepository.save when no open alert is found', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      await useCase.execute(makeRequest());
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('should not publish when no open alert is found', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(null)
      );
      await useCase.execute(makeRequest());
      expect(alertPublisher.publish).not.toHaveBeenCalled();
    });

    it('should return a failure when findOpenByDeviceAndType itself returns a failure', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.fail('DB error')
      );
      const result = await useCase.execute(makeRequest());
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load open alert');
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path: resolves alert, publishes, saves', () => {
    beforeEach(() => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert())
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));
    });

    it('should return a successful DTO with status RESOLVED', async () => {
      const result = await useCase.execute(makeRequest());
      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('RESOLVED');
    });

    it('should call alertRepository.save exactly once', async () => {
      await useCase.execute(makeRequest());
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should publish exactly one resolved availability alert', async () => {
      await useCase.execute(makeRequest());
      expect(alertPublisher.publish).toHaveBeenCalledTimes(1);
      expect(alertPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: VALID_DEVICE_UUID,
          severity: AlertSeverity.CRITICAL,
          source: 'Disponibilidad',
          resolved: true,
          occurredAt: OCCURRED_AT
        })
      );
    });

    it('should save the alert with recoveryNotifiedAt set when publish succeeds', async () => {
      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      await useCase.execute(makeRequest());
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.recoveryNotifiedAt).not.toBeNull();
    });

    it('should set resolvedAt on the alert before saving', async () => {
      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      await useCase.execute(makeRequest());
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.resolvedAt).toEqual(OCCURRED_AT);
    });
  });

  // ===========================================================================
  describe('executeImpl — publish failure', () => {
    it('should still save the alert when publish fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert())
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      alertPublisher.publish.mockResolvedValue(
        Result.fail('Telegram down')
      );
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      const result = await useCase.execute(makeRequest());
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
      expect(result.isSuccess).toBe(true);
    });

    it('should save the alert without recoveryNotifiedAt when publish fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert())
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      alertPublisher.publish.mockResolvedValue(
        Result.fail('Telegram down')
      );

      let capturedAlert: Alert | null = null;
      alertRepo.save.mockImplementation(async (a) => {
        capturedAlert = a;
        return Result.ok(a);
      });

      await useCase.execute(makeRequest());
      expect(capturedAlert).not.toBeNull();
      expect(capturedAlert!.recoveryNotifiedAt).toBeNull();
    });
  });

  // ===========================================================================
  describe('executeImpl — repository save failure', () => {
    it('should return a failure result when alertRepository.save fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert())
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      alertRepo.save.mockResolvedValue(Result.fail('Write conflict'));

      const result = await useCase.execute(makeRequest());
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save alert');
    });
  });

  // ===========================================================================
  describe('executeImpl — IP + latency detail', () => {
    it('should fold IP and latency into the detail', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert())
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      await useCase.execute(makeRequest({ latencyMs: 42 }));
      const envelope = alertPublisher.publish.mock.calls[0][0];
      expect(envelope.detail).toContain('192.168.1.1');
      expect(envelope.detail).toContain('42ms');
    });

    it('should still publish (no IP in detail) when polling config lookup fails', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert())
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.fail('Unavailable')
      );
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      await useCase.execute(makeRequest());
      const envelope = alertPublisher.publish.mock.calls[0][0];
      expect(envelope.detail).not.toContain('IP:');
    });

    it('should succeed when latencyMs is null (no latency data)', async () => {
      alertRepo.findOpenByDeviceAndType.mockResolvedValue(
        Result.ok(makeOpenAlert())
      );
      pollingConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      alertRepo.save.mockImplementation(async (a) => Result.ok(a));

      const result = await useCase.execute(
        makeRequest({ latencyMs: null })
      );
      expect(result.isSuccess).toBe(true);
    });
  });
});
