// Source: src/application/notifications/event-handlers/DeviceWentOfflineNotificationHandler.ts

import { DeviceWentOfflineNotificationHandler } from '../../../../src/application/notifications/event-handlers/DeviceWentOfflineNotificationHandler';
import { SendDeviceDownAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { DeviceWentOfflineEvent } from '../../../../src/domain/device-monitoring/events/DeviceWentOfflineEvent';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440050';
const FIXED_DATE        = new Date('2024-06-01T10:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeUseCase(): jest.Mocked<Pick<SendDeviceDownAlertUseCase, 'execute'>> {
  return { execute: jest.fn() };
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeEvent(
  overrides: { consecutiveFailures?: number; dateTimeOccurred?: Date } = {}
): DeviceWentOfflineEvent {
  return new DeviceWentOfflineEvent({
    aggregateId:         makeDeviceId(),
    consecutiveFailures: overrides.consecutiveFailures ?? 3,
    dateTimeOccurred:    overrides.dateTimeOccurred    ?? FIXED_DATE
  });
}

// Minimal AlertResponseDTO to satisfy the execute mock return type
const STUB_ALERT_DTO = {
  id:                  '550e8400-e29b-41d4-a716-446655440051',
  deviceId:            VALID_DEVICE_UUID,
  severity:            'CRITICAL',
  status:              'OPEN' as const,
  startedAt:           FIXED_DATE.toISOString(),
  resolvedAt:          null,
  notifiedAt:          null,
  recoveryNotifiedAt:  null,
  durationSecs:        null
};

// ---------------------------------------------------------------------------

describe('DeviceWentOfflineNotificationHandler', () => {
  let useCase:  jest.Mocked<Pick<SendDeviceDownAlertUseCase, 'execute'>>;
  let handler:  DeviceWentOfflineNotificationHandler;

  beforeEach(() => {
    useCase = makeUseCase();
    handler = new DeviceWentOfflineNotificationHandler(
      useCase as unknown as SendDeviceDownAlertUseCase
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('handle — happy path', () => {
    it('should call sendDeviceDownAlertUseCase.execute with the correct payload', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.ok(STUB_ALERT_DTO));
      const event = makeEvent({ consecutiveFailures: 5, dateTimeOccurred: FIXED_DATE });

      // act
      await handler.handle(event);

      // assert
      expect(useCase.execute).toHaveBeenCalledTimes(1);
      expect(useCase.execute).toHaveBeenCalledWith({
        deviceId:            VALID_DEVICE_UUID,
        consecutiveFailures: 5,
        occurredAt:          FIXED_DATE
      });
    });

    it('should resolve without throwing when use case succeeds', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.ok(STUB_ALERT_DTO));

      // act / assert
      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  describe('handle — use case returns failure', () => {
    it('should log an error when the use case returns a failure result', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.fail('Repo unavailable'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act
      await handler.handle(makeEvent());

      // assert
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should include the error in the console.error call payload', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.fail('Repo unavailable'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act
      await handler.handle(makeEvent());

      // assert
      const payload = consoleSpy.mock.calls[0][1] as { error: string };
      expect(payload.error).toBe('Repo unavailable');
      consoleSpy.mockRestore();
    });

    it('should not throw when the use case returns a failure result', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.fail('Something failed'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act / assert
      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  describe('handle — unexpected exception', () => {
    it('should log an error when the use case throws unexpectedly', async () => {
      // arrange
      useCase.execute.mockRejectedValue(new Error('Fatal crash'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act
      await handler.handle(makeEvent());

      // assert
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should not rethrow when the use case throws an unexpected error', async () => {
      // arrange
      useCase.execute.mockRejectedValue(new Error('Fatal crash'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act / assert
      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });

    it('should include the error message in the console.error payload on unexpected throw', async () => {
      // arrange
      useCase.execute.mockRejectedValue(new Error('Disk full'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act
      await handler.handle(makeEvent());

      // assert
      const payload = consoleSpy.mock.calls[0][1] as { error: string };
      expect(payload.error).toBe('Disk full');
      consoleSpy.mockRestore();
    });
  });
});
