import { AlertPublisher } from '../../../src/infrastructure/notifications/AlertPublisher';
import { SendAlertNotificationUseCase } from '../../../src/application/notifications/use-cases/SendAlertNotificationUseCase';
import { AlertNotification } from '../../../src/application/shared/interfaces/IAlertPublisher';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../src/domain/shared/core/Result';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440070';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeUseCase(): jest.Mocked<
  Pick<SendAlertNotificationUseCase, 'execute'>
> {
  return { execute: jest.fn().mockResolvedValue(Result.ok()) };
}

function makeNotification(
  overrides: Partial<AlertNotification> = {}
): AlertNotification {
  return {
    deviceId: VALID_DEVICE_UUID,
    severity: AlertSeverity.CRITICAL,
    source: 'Enlace inalámbrico',
    subject: 'signal_rx_dbm',
    detail: 'Señal crítica: -83 dBm',
    occurredAt: FIXED_DATE,
    resolved: false,
    ...overrides
  };
}

describe('AlertPublisher', () => {
  let useCase: jest.Mocked<
    Pick<SendAlertNotificationUseCase, 'execute'>
  >;
  let publisher: AlertPublisher;

  beforeEach(() => {
    useCase = makeUseCase();
    publisher = new AlertPublisher(
      useCase as unknown as SendAlertNotificationUseCase
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should forward the envelope fields to the renderer verbatim', async () => {
    await publisher.publish(makeNotification());

    expect(useCase.execute).toHaveBeenCalledWith({
      deviceId: VALID_DEVICE_UUID,
      severity: AlertSeverity.CRITICAL,
      source: 'Enlace inalámbrico',
      subject: 'signal_rx_dbm',
      detail: 'Señal crítica: -83 dBm',
      occurredAt: FIXED_DATE,
      resolved: false
    });
  });

  it('should carry a resolved WARNING through unchanged', async () => {
    await publisher.publish(
      makeNotification({
        severity: AlertSeverity.WARNING,
        resolved: true
      })
    );

    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: AlertSeverity.WARNING,
        resolved: true
      })
    );
  });

  it('should return ok when the renderer succeeds', async () => {
    useCase.execute.mockResolvedValue(Result.ok());
    const result = await publisher.publish(makeNotification());
    expect(result.isSuccess).toBe(true);
  });

  it('should propagate a failure from the renderer', async () => {
    useCase.execute.mockResolvedValue(
      Result.fail('Telegram API error')
    );
    const result = await publisher.publish(makeNotification());
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Telegram API error');
  });
});
