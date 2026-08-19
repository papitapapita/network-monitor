import { SendAlertNotificationUseCase } from '../../../../src/application/notifications/use-cases/SendAlertNotificationUseCase';
import { SendAlertNotificationDTO } from '../../../../src/application/notifications/dtos/SendAlertNotificationDTO';
import { INotificationService } from '../../../../src/application/notifications/interfaces/INotificationService';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440050';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  } as unknown as jest.Mocked<ILogger>;
}

function makeDeviceRepo(
  name = 'Antena Cliente 42'
): jest.Mocked<Pick<IDeviceRepository, 'findById'>> {
  return {
    findById: jest
      .fn()
      .mockResolvedValue(Result.ok({ name: { value: name } }))
  } as unknown as jest.Mocked<Pick<IDeviceRepository, 'findById'>>;
}

function makeNotificationService(): jest.Mocked<INotificationService> {
  return { send: jest.fn().mockResolvedValue(Result.ok()) };
}

function makeRequest(
  overrides: Partial<SendAlertNotificationDTO> = {}
): SendAlertNotificationDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    severity: AlertSeverity.CRITICAL,
    source: 'Enlace inalámbrico',
    subject: 'signal_rx_dbm',
    detail: 'Señal crítica en equipo X: -83 dBm',
    occurredAt: FIXED_DATE,
    resolved: false,
    ...overrides
  };
}

describe('SendAlertNotificationUseCase', () => {
  let deviceRepo: ReturnType<typeof makeDeviceRepo>;
  let notificationService: jest.Mocked<INotificationService>;
  let useCase: SendAlertNotificationUseCase;

  beforeEach(() => {
    deviceRepo = makeDeviceRepo();
    notificationService = makeNotificationService();
    useCase = new SendAlertNotificationUseCase(
      deviceRepo as unknown as IDeviceRepository,
      notificationService,
      makeLogger()
    );
  });

  describe('beforeExecute — validation', () => {
    it('should fail when deviceId is empty', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '  ' })
      );

      expect(result.isFailure).toBe(true);
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should fail when detail is empty', async () => {
      const result = await useCase.execute(
        makeRequest({ detail: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  describe('executeImpl — severity in the delivered message', () => {
    it('should mark a CRITICAL alert with the critical header', async () => {
      await useCase.execute(
        makeRequest({ severity: AlertSeverity.CRITICAL })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain('ALERTA CRÍTICA');
      expect(message.title).toBe('🔴 Alerta crítica');
    });

    it('should mark a WARNING alert with the warning header', async () => {
      await useCase.execute(
        makeRequest({ severity: AlertSeverity.WARNING })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain('ADVERTENCIA');
      expect(message.title).toBe('🟡 Advertencia');
    });

    it('should mark a resolved alert as resolved regardless of severity', async () => {
      await useCase.execute(
        makeRequest({
          severity: AlertSeverity.CRITICAL,
          resolved: true
        })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain('ALERTA RESUELTA');
      expect(message.title).toBe('✅ Alerta resuelta');
    });

    it('should carry the severity through the metadata', async () => {
      await useCase.execute(
        makeRequest({ severity: AlertSeverity.WARNING })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.metadata.severity).toBe(AlertSeverity.WARNING);
    });
  });

  describe('executeImpl — message content', () => {
    it('should include the resolved device name', async () => {
      await useCase.execute(makeRequest());

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain('Antena Cliente 42');
      expect(message.metadata.deviceName).toBe('Antena Cliente 42');
    });

    it('should fall back to Unknown Device when lookup fails', async () => {
      deviceRepo.findById.mockResolvedValue(Result.fail('gone'));

      await useCase.execute(makeRequest());

      const message = notificationService.send.mock.calls[0][0];
      expect(message.metadata.deviceName).toBe('Unknown Device');
    });

    it('should fall back to Unknown Device when lookup throws', async () => {
      deviceRepo.findById.mockRejectedValue(new Error('db down'));

      await useCase.execute(makeRequest());

      const message = notificationService.send.mock.calls[0][0];
      expect(message.metadata.deviceName).toBe('Unknown Device');
    });

    it('should escape MarkdownV2 reserved characters in the detail', async () => {
      await useCase.execute(
        makeRequest({ detail: 'Señal: -83 dBm (umbral: -80 dBm)' })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain('\\-83');
      expect(message.body).toContain('\\(umbral');
    });

    it('should include the metric as the subject line', async () => {
      await useCase.execute(makeRequest({ subject: 'lan_status' }));

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain('lan\\_status');
    });
  });

  describe('executeImpl — delivery failure', () => {
    it('should fail when the notification service fails', async () => {
      notificationService.send.mockResolvedValue(
        Result.fail('Telegram API error')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to send alert notification'
      );
    });

    it('should succeed when the notification service succeeds', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });
  });
});
