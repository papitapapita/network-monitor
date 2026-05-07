// Source: src/application/notifications/event-handlers/DeviceCameOnlineNotificationHandler.ts

import { DeviceCameOnlineNotificationHandler } from '../../../../src/application/notifications/event-handlers/DeviceCameOnlineNotificationHandler';
import { SendDeviceRecoveryAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceRecoveryAlertUseCase';
import { DeviceCameOnlineEvent } from '../../../../src/domain/device-monitoring/events/DeviceCameOnlineEvent';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440060';
const FIXED_DATE        = new Date('2024-06-01T10:01:40.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeUseCase(): jest.Mocked<Pick<SendDeviceRecoveryAlertUseCase, 'execute'>> {
  return { execute: jest.fn() };
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeEvent(
  overrides: { latencyMs?: number | null; dateTimeOccurred?: Date } = {}
): DeviceCameOnlineEvent {
  return new DeviceCameOnlineEvent({
    aggregateId:      makeDeviceId(),
    latencyMs:        overrides.latencyMs        !== undefined ? overrides.latencyMs : 12,
    dateTimeOccurred: overrides.dateTimeOccurred ?? FIXED_DATE
  });
}

// Minimal AlertResponseDTO to satisfy the execute mock return type
const STUB_ALERT_DTO = {
  id:                  '550e8400-e29b-41d4-a716-446655440061',
  deviceId:            VALID_DEVICE_UUID,
  severity:            'CRITICAL',
  status:              'RESOLVED' as const,
  startedAt:           new Date('2024-06-01T10:00:00.000Z').toISOString(),
  resolvedAt:          FIXED_DATE.toISOString(),
  notifiedAt:          null,
  recoveryNotifiedAt:  null,
  durationSecs:        100
};

// ---------------------------------------------------------------------------

describe('DeviceCameOnlineNotificationHandler', () => {
  let useCase:  jest.Mocked<Pick<SendDeviceRecoveryAlertUseCase, 'execute'>>;
  let handler:  DeviceCameOnlineNotificationHandler;

  beforeEach(() => {
    useCase = makeUseCase();
    handler = new DeviceCameOnlineNotificationHandler(
      useCase as unknown as SendDeviceRecoveryAlertUseCase
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('handle — happy path', () => {
    it('should call sendDeviceRecoveryAlertUseCase.execute with the correct payload', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.ok(STUB_ALERT_DTO));
      const event = makeEvent({ latencyMs: 20, dateTimeOccurred: FIXED_DATE });

      // act
      await handler.handle(event);

      // assert
      expect(useCase.execute).toHaveBeenCalledTimes(1);
      expect(useCase.execute).toHaveBeenCalledWith({
        deviceId:   VALID_DEVICE_UUID,
        latencyMs:  20,
        occurredAt: FIXED_DATE
      });
    });

    it('should resolve without throwing when use case succeeds', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.ok(STUB_ALERT_DTO));

      // act / assert
      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });

    it('should pass null latencyMs when event carries no latency data', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.ok(STUB_ALERT_DTO));
      const event = makeEvent({ latencyMs: null });

      // act
      await handler.handle(event);

      // assert
      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ latencyMs: null })
      );
    });
  });

  // ===========================================================================
  describe('handle — use case returns failure', () => {
    it('should log an error when the use case returns a failure result', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.fail('No open alert found'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act
      await handler.handle(makeEvent());

      // assert
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should include the error in the console.error call payload', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.fail('No open alert found'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act
      await handler.handle(makeEvent());

      // assert
      const payload = consoleSpy.mock.calls[0][1] as { error: string };
      expect(payload.error).toBe('No open alert found');
      consoleSpy.mockRestore();
    });

    it('should not throw when the use case returns a failure result', async () => {
      // arrange
      useCase.execute.mockResolvedValue(Result.fail('Recovery skipped'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act / assert
      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });
  });

  // ===========================================================================
  describe('handle — unexpected exception', () => {
    it('should log an error when the use case throws unexpectedly', async () => {
      // arrange
      useCase.execute.mockRejectedValue(new Error('Unexpected crash'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act
      await handler.handle(makeEvent());

      // assert
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should not rethrow when the use case throws an unexpected error', async () => {
      // arrange
      useCase.execute.mockRejectedValue(new Error('Unexpected crash'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act / assert
      await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
    });

    it('should include the error message in the console.error payload on unexpected throw', async () => {
      // arrange
      useCase.execute.mockRejectedValue(new Error('OOM'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      // act
      await handler.handle(makeEvent());

      // assert
      const payload = consoleSpy.mock.calls[0][1] as { error: string };
      expect(payload.error).toBe('OOM');
      consoleSpy.mockRestore();
    });
  });
});
