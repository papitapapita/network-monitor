import { WirelessAlertNotifier } from '../../../src/infrastructure/notifications/WirelessAlertNotifier';
import { SendAlertNotificationUseCase } from '../../../src/application/notifications/use-cases/SendAlertNotificationUseCase';
import { AlertSeverity } from '../../../src/domain/notifications/enums/AlertSeverity';
import { Result } from '../../../src/domain/shared/core/Result';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440050';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeUseCase(): jest.Mocked<
  Pick<SendAlertNotificationUseCase, 'execute'>
> {
  return { execute: jest.fn().mockResolvedValue(Result.ok()) };
}

describe('WirelessAlertNotifier', () => {
  let useCase: ReturnType<typeof makeUseCase>;
  let notifier: WirelessAlertNotifier;

  beforeEach(() => {
    useCase = makeUseCase();
    notifier = new WirelessAlertNotifier(
      useCase as unknown as SendAlertNotificationUseCase
    );
  });

  describe('notifyTriggered — severity translation', () => {
    it('should translate CRITICAL to AlertSeverity.CRITICAL', async () => {
      await notifier.notifyTriggered({
        deviceId: VALID_DEVICE_UUID,
        metric: 'signal_rx_dbm',
        severity: 'CRITICAL',
        threshold: -80,
        currentValue: -83,
        message: 'Señal crítica',
        triggeredAt: FIXED_DATE
      });

      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AlertSeverity.CRITICAL,
          resolved: false
        })
      );
    });

    it('should translate WARNING to AlertSeverity.WARNING', async () => {
      await notifier.notifyTriggered({
        deviceId: VALID_DEVICE_UUID,
        metric: 'lan_speed_mbps',
        severity: 'WARNING',
        threshold: 10,
        currentValue: 10,
        message: 'Velocidad LAN muy baja',
        triggeredAt: FIXED_DATE
      });

      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ severity: AlertSeverity.WARNING })
      );
    });
  });

  describe('notifyTriggered — payload', () => {
    it('should pass the rule message through as the detail', async () => {
      await notifier.notifyTriggered({
        deviceId: VALID_DEVICE_UUID,
        metric: 'lan_status',
        severity: 'CRITICAL',
        threshold: 0,
        currentValue: 0,
        message: 'Puerto LAN caído en equipo X',
        triggeredAt: FIXED_DATE
      });

      expect(useCase.execute).toHaveBeenCalledWith({
        deviceId: VALID_DEVICE_UUID,
        severity: AlertSeverity.CRITICAL,
        source: 'Enlace inalámbrico',
        subject: 'lan_status',
        detail: 'Puerto LAN caído en equipo X',
        occurredAt: FIXED_DATE,
        resolved: false
      });
    });

    it('should propagate a use case failure', async () => {
      useCase.execute.mockResolvedValue(Result.fail('telegram down'));

      const result = await notifier.notifyTriggered({
        deviceId: VALID_DEVICE_UUID,
        metric: 'snr_db',
        severity: 'CRITICAL',
        threshold: 10,
        currentValue: 8,
        message: 'SNR crítico',
        triggeredAt: FIXED_DATE
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('telegram down');
    });
  });

  describe('notifyCleared', () => {
    it('should mark the notification as resolved', async () => {
      await notifier.notifyCleared({
        deviceId: VALID_DEVICE_UUID,
        metric: 'signal_rx_dbm',
        severity: 'CRITICAL',
        clearedAt: FIXED_DATE
      });

      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          resolved: true,
          occurredAt: FIXED_DATE,
          subject: 'signal_rx_dbm'
        })
      );
    });

    it('should succeed when the use case succeeds', async () => {
      const result = await notifier.notifyCleared({
        deviceId: VALID_DEVICE_UUID,
        metric: 'snr_db',
        severity: 'CRITICAL',
        clearedAt: FIXED_DATE
      });

      expect(result.isSuccess).toBe(true);
    });
  });
});
