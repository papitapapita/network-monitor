import { DeviceWentOfflineNotificationHandler } from '../../../../src/application/notifications/event-handlers/DeviceWentOfflineNotificationHandler';
import { SendDeviceDownAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { DeviceWentOfflineEvent } from '../../../../src/domain/device-monitoring/events/DeviceWentOfflineEvent';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440050';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeUseCase(): jest.Mocked<
  Pick<SendDeviceDownAlertUseCase, 'execute'>
> {
  return { execute: jest.fn() };
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  } as unknown as jest.Mocked<ILogger>;
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeEvent(
  overrides: {
    consecutiveFailures?: number;
    dateTimeOccurred?: Date;
  } = {}
): DeviceWentOfflineEvent {
  return new DeviceWentOfflineEvent({
    aggregateId: makeDeviceId(),
    consecutiveFailures: overrides.consecutiveFailures ?? 3,
    dateTimeOccurred: overrides.dateTimeOccurred ?? FIXED_DATE
  });
}

const STUB_ALERT_DTO = {
  id: '550e8400-e29b-41d4-a716-446655440051',
  deviceId: VALID_DEVICE_UUID,
  severity: 'CRITICAL',
  source: 'Disponibilidad',
  type: 'device_unreachable',
  description: 'Sin conexión',
  details: {},
  status: 'OPEN' as const,
  startedAt: FIXED_DATE.toISOString(),
  resolvedAt: null,
  notifiedAt: null,
  recoveryNotifiedAt: null,
  durationSecs: null
};

describe('DeviceWentOfflineNotificationHandler', () => {
  let useCase: jest.Mocked<
    Pick<SendDeviceDownAlertUseCase, 'execute'>
  >;
  let logger: jest.Mocked<ILogger>;
  let handler: DeviceWentOfflineNotificationHandler;

  beforeEach(() => {
    useCase = makeUseCase();
    logger = makeLogger();
    handler = new DeviceWentOfflineNotificationHandler(
      useCase as unknown as SendDeviceDownAlertUseCase,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handle — happy path', () => {
    it('should call sendDeviceDownAlertUseCase.execute with the correct payload', async () => {
      useCase.execute.mockResolvedValue(Result.ok(STUB_ALERT_DTO));
      const event = makeEvent({
        consecutiveFailures: 5,
        dateTimeOccurred: FIXED_DATE
      });

      await handler.handle(event);

      expect(useCase.execute).toHaveBeenCalledTimes(1);
      expect(useCase.execute).toHaveBeenCalledWith({
        deviceId: VALID_DEVICE_UUID,
        consecutiveFailures: 5,
        occurredAt: FIXED_DATE
      });
    });

    it('should resolve without throwing when use case succeeds', async () => {
      useCase.execute.mockResolvedValue(Result.ok(STUB_ALERT_DTO));

      await expect(
        handler.handle(makeEvent())
      ).resolves.toBeUndefined();
    });
  });

  describe('handle — use case returns failure', () => {
    it('should log an error when the use case returns a failure result', async () => {
      useCase.execute.mockResolvedValue(
        Result.fail('Repo unavailable')
      );

      await handler.handle(makeEvent());

      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should include the error in the logger.error call context', async () => {
      useCase.execute.mockResolvedValue(
        Result.fail('Repo unavailable')
      );

      await handler.handle(makeEvent());

      const context = (logger.error as jest.Mock).mock
        .calls[0][2] as { error: string };
      expect(context.error).toBe('Repo unavailable');
    });

    it('should not throw when the use case returns a failure result', async () => {
      useCase.execute.mockResolvedValue(
        Result.fail('Something failed')
      );

      await expect(
        handler.handle(makeEvent())
      ).resolves.toBeUndefined();
    });
  });

  describe('handle — unexpected exception', () => {
    it('should log an error when the use case throws unexpectedly', async () => {
      useCase.execute.mockRejectedValue(new Error('Fatal crash'));

      await handler.handle(makeEvent());

      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should not rethrow when the use case throws an unexpected error', async () => {
      useCase.execute.mockRejectedValue(new Error('Fatal crash'));

      await expect(
        handler.handle(makeEvent())
      ).resolves.toBeUndefined();
    });

    it('should pass the error to logger.error on unexpected throw', async () => {
      useCase.execute.mockRejectedValue(new Error('Disk full'));

      await handler.handle(makeEvent());

      const secondArg = (logger.error as jest.Mock).mock.calls[0][1];
      expect(secondArg).toBeInstanceOf(Error);
      expect((secondArg as Error).message).toBe('Disk full');
    });
  });
});
