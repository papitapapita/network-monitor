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
  name = 'Antena Cliente 42',
  ipAddress: string | null = '10.0.5.42'
): jest.Mocked<Pick<IDeviceRepository, 'findById'>> {
  return {
    findById: jest.fn().mockResolvedValue(
      Result.ok({
        name: { value: name },
        ipAddress: ipAddress === null ? null : { value: ipAddress }
      })
    )
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
    summary: 'Señal crítica en equipo X: -83 dBm',
    detail: null,
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

    it('should fail when summary is empty', async () => {
      const result = await useCase.execute(
        makeRequest({ summary: '  ' })
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

  describe('[NOT-102] executeImpl — the summary leads, under the severity icon', () => {
    it('should open a CRITICAL alert with the red icon and the bold summary', async () => {
      await useCase.execute(
        makeRequest({
          severity: AlertSeverity.CRITICAL,
          summary: 'AP Norte no responde'
        })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body.split('\n')[0]).toBe(
        '🔴 *AP Norte no responde*'
      );
      expect(message.title).toBe('🔴 AP Norte no responde');
    });

    it('should open a WARNING alert with the yellow icon', async () => {
      await useCase.execute(
        makeRequest({ severity: AlertSeverity.WARNING })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body.startsWith('🟡 *')).toBe(true);
    });

    it('should open a resolved alert with the check icon regardless of severity', async () => {
      await useCase.execute(
        makeRequest({
          severity: AlertSeverity.CRITICAL,
          resolved: true
        })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body.startsWith('✅ *')).toBe(true);
    });

    it('should carry no title-style header any more', async () => {
      await useCase.execute(makeRequest());

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).not.toContain('ALERTA CRÍTICA');
      expect(message.body).not.toContain('Severidad');
    });

    it('should put the detail right under the summary', async () => {
      await useCase.execute(
        makeRequest({
          summary: 'AP Norte',
          detail: 'Latencia: 12 ms'
        })
      );

      const lines =
        notificationService.send.mock.calls[0][0].body.split('\n');
      expect(lines[1]).toBe('Latencia: 12 ms');
    });

    it('should leave a blank line under the summary when there is no detail', async () => {
      await useCase.execute(makeRequest({ detail: null }));

      const lines =
        notificationService.send.mock.calls[0][0].body.split('\n');
      expect(lines[1]).toBe('');
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
      expect(message.body).toContain('📛 Antena Cliente 42');
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

    it('should escape MarkdownV2 reserved characters in the summary and detail', async () => {
      await useCase.execute(
        makeRequest({
          summary: 'Señal: -83 dBm (umbral: -80 dBm)',
          detail: 'Latencia: 1.5 ms'
        })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain('\\-83');
      expect(message.body).toContain('\\(umbral');
      expect(message.body).toContain('1\\.5');
    });

    it('should end with the time and the source', async () => {
      await useCase.execute(
        makeRequest({ source: 'Enlace inalámbrico · isp.example' })
      );

      const lines =
        notificationService.send.mock.calls[0][0].body.split('\n');
      expect(lines[lines.length - 1]).toBe(
        '🕐 01/06/2024, 05:00:00 · Enlace inalámbrico · isp\\.example'
      );
    });
  });

  describe('[NOT-103] executeImpl — links to the device', () => {
    it('should link the device IP to its own web page', async () => {
      await useCase.execute(makeRequest());

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain(
        '🌐 [10\\.0\\.5\\.42](http://10.0.5.42)'
      );
      expect(message.metadata.ipAddress).toBe('10.0.5.42');
    });

    it('should leave the IP line out for a device with no IP', async () => {
      deviceRepo = makeDeviceRepo('Antena Cliente 42', null);
      useCase = new SendAlertNotificationUseCase(
        deviceRepo as unknown as IDeviceRepository,
        notificationService,
        makeLogger()
      );

      await useCase.execute(makeRequest());

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).not.toContain('🌐');
      expect(message.metadata.ipAddress).toBeNull();
    });

    it('should leave the app link out when no app URL is configured', async () => {
      await useCase.execute(makeRequest());

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).not.toContain('📱');
    });

    it('should link to the device page in the app when an app URL is configured', async () => {
      useCase = new SendAlertNotificationUseCase(
        deviceRepo as unknown as IDeviceRepository,
        notificationService,
        makeLogger(),
        'http://192.168.1.10:3001'
      );

      await useCase.execute(makeRequest());

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).toContain(
        `📱 [Ver en la app](http://192.168.1.10:3001/devices/${VALID_DEVICE_UUID})`
      );
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

  describe('executeImpl — an alert with no device', () => {
    it('should send it without looking up a device', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: null, source: 'Agente Torre Norte' })
      );

      expect(result.isSuccess).toBe(true);
      expect(deviceRepo.findById).not.toHaveBeenCalled();
    });

    it('should leave the device lines out of the message', async () => {
      useCase = new SendAlertNotificationUseCase(
        deviceRepo as unknown as IDeviceRepository,
        notificationService,
        makeLogger(),
        'https://app.example.com'
      );

      await useCase.execute(
        makeRequest({ deviceId: null, source: 'Agente Torre Norte' })
      );

      const message = notificationService.send.mock.calls[0][0];
      expect(message.body).not.toContain('📛');
      expect(message.body).not.toContain('🌐');
      expect(message.body).not.toContain('📱');
      expect(message.body).toContain('Agente Torre Norte');
      expect(message.metadata.deviceId).toBeNull();
      expect(message.metadata.deviceName).toBeNull();
    });
  });
});
