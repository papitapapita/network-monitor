// Source: src/domain/device-backups/aggregates/DeviceBackupState.ts

import { describe, it, expect } from '@jest/globals';
import {
  BACKUP_FAILURES_BEFORE_ALERT,
  BackupOutcome,
  DeviceBackupState,
  MAX_BACKUP_ERROR_LENGTH
} from '../../../../src/domain/device-backups';
import { DeviceBackupFailingEvent } from '../../../../src/domain/device-backups/events';
import { DeviceId } from '../../../../src/domain/shared/ids';

const T1 = new Date('2026-10-07T08:00:00Z');
const T2 = new Date('2026-10-08T08:00:00Z');
const T3 = new Date('2026-10-09T08:00:00Z');

function makeState(): DeviceBackupState {
  const result = DeviceBackupState.create(DeviceId.create());
  if (result.isFailure)
    throw new Error(`fixture failed: ${result.error}`);
  return result.value;
}

describe('DeviceBackupState', () => {
  describe('create()', () => {
    it('should start with no attempts', () => {
      const state = makeState();

      expect(state.lastAttemptAt).toBeNull();
      expect(state.lastOutcome).toBeNull();
      expect(state.consecutiveFailures).toBe(0);
    });
  });

  describe('recordSuccess()', () => {
    it('[BKP-020] should record the outcome and the time of success', () => {
      const state = makeState();

      state.recordSuccess(BackupOutcome.SAVED, T1);

      expect(state.lastAttemptAt).toEqual(T1);
      expect(state.lastOutcome).toBe(BackupOutcome.SAVED);
      expect(state.lastSuccessAt).toEqual(T1);
      expect(state.lastError).toBeNull();
    });

    it('[BKP-021] should clear a failure streak', () => {
      const state = makeState();
      state.recordFailure('timeout', T1, 'AP Norte');
      state.recordFailure('timeout', T2, 'AP Norte');

      state.recordSuccess(BackupOutcome.UNCHANGED, T3);

      expect(state.consecutiveFailures).toBe(0);
      expect(state.failingSince).toBeNull();
      expect(state.lastError).toBeNull();
      expect(state.lastOutcome).toBe(BackupOutcome.UNCHANGED);
    });
  });

  describe('recordFailure()', () => {
    it('[BKP-021] should keep the first failure of a streak as failing-since', () => {
      const state = makeState();

      state.recordFailure('timeout', T1, 'AP Norte');
      state.recordFailure('login rejected', T2, 'AP Norte');

      expect(state.failingSince).toEqual(T1);
      expect(state.lastAttemptAt).toEqual(T2);
      expect(state.lastError).toBe('login rejected');
    });

    it('[BKP-022] should count failures in a row', () => {
      const state = makeState();

      state.recordFailure('timeout', T1, 'AP Norte');
      state.recordFailure('timeout', T2, 'AP Norte');

      expect(state.consecutiveFailures).toBe(2);
      expect(state.lastOutcome).toBe(BackupOutcome.FAILED);
    });

    it('[BKP-020] should keep the last success through failures', () => {
      const state = makeState();
      state.recordSuccess(BackupOutcome.SAVED, T1);

      state.recordFailure('timeout', T2, 'AP Norte');

      expect(state.lastSuccessAt).toEqual(T1);
    });

    it('[BKP-023] should cut a long error instead of refusing it', () => {
      const state = makeState();

      const result = state.recordFailure(
        'x'.repeat(MAX_BACKUP_ERROR_LENGTH + 100),
        T1,
        'AP Norte'
      );

      expect(result.isSuccess).toBe(true);
      expect(state.lastError).toHaveLength(MAX_BACKUP_ERROR_LENGTH);
    });

    it('should name a blank error', () => {
      const state = makeState();

      state.recordFailure('  ', T1, 'AP Norte');

      expect(state.lastError).toBe('Unknown error');
    });
  });

  describe('invariants', () => {
    it('[BKP-024] should keep error, streak and failing-since only while failing', () => {
      const state = makeState();

      state.recordFailure('timeout', T1, 'AP Norte');
      expect([
        state.lastError,
        state.consecutiveFailures,
        state.failingSince
      ]).toEqual(['timeout', 1, T1]);

      state.recordSuccess(BackupOutcome.SAVED, T2);
      expect([
        state.lastError,
        state.consecutiveFailures,
        state.failingSince
      ]).toEqual([null, 0, null]);
    });
  });

  describe('succeededSince()', () => {
    it('[BKP-012] should be true only for a success at or after the cutoff', () => {
      const state = makeState();
      expect(state.succeededSince(T1)).toBe(false);

      state.recordSuccess(BackupOutcome.SAVED, T2);

      expect(state.succeededSince(T1)).toBe(true);
      expect(state.succeededSince(T2)).toBe(true);
      expect(state.succeededSince(T3)).toBe(false);
    });
  });

  describe('reconstitute()', () => {
    it('[BKP-021] should date a stored failure that lacks its start from the next failure', () => {
      const state = DeviceBackupState.reconstitute(
        DeviceId.create(),
        {
          lastAttemptAt: T1,
          lastOutcome: BackupOutcome.FAILED,
          lastError: 'timeout',
          lastSuccessAt: null,
          failingSince: null,
          consecutiveFailures: 1
        }
      );

      const result = state.recordFailure('timeout', T2, 'AP Norte');

      expect(result.isSuccess).toBe(true);
      expect(state.failingSince).toEqual(T2);
    });
  });

  describe('failing alert', () => {
    const fail = (state: DeviceBackupState, times: number) => {
      for (let i = 0; i < times; i++)
        state.recordFailure(
          `timeout ${i + 1}`,
          new Date(T1.getTime() + i * 86_400_000),
          'AP Norte'
        );
    };

    it('[BKP-061] should stay quiet before the failure threshold', () => {
      const state = makeState();

      fail(state, BACKUP_FAILURES_BEFORE_ALERT - 1);

      expect(state.domainEvents).toHaveLength(0);
    });

    it('[BKP-061] should announce the streak when it reaches the threshold', () => {
      const state = makeState();
      state.recordSuccess(
        BackupOutcome.SAVED,
        new Date('2026-10-01T08:00:00Z')
      );

      fail(state, BACKUP_FAILURES_BEFORE_ALERT);

      expect(state.domainEvents).toHaveLength(1);
      const event = state.domainEvents[0] as DeviceBackupFailingEvent;
      expect(event).toBeInstanceOf(DeviceBackupFailingEvent);
      expect(event.aggregateId.equals(state.deviceId)).toBe(true);
      expect(event.deviceName).toBe('AP Norte');
      expect(event.consecutiveFailures).toBe(
        BACKUP_FAILURES_BEFORE_ALERT
      );
      expect(event.failingSince).toEqual(T1);
      expect(event.lastSuccessAt).toEqual(
        new Date('2026-10-01T08:00:00Z')
      );
      expect(event.lastError).toBe(
        `timeout ${BACKUP_FAILURES_BEFORE_ALERT}`
      );
    });

    it('[BKP-061] should announce a streak only once', () => {
      const state = makeState();

      fail(state, BACKUP_FAILURES_BEFORE_ALERT + 3);

      expect(state.domainEvents).toHaveLength(1);
    });

    it('[BKP-061] should announce again a new streak after a success', () => {
      const state = makeState();
      fail(state, BACKUP_FAILURES_BEFORE_ALERT);
      state.clearEvents();
      state.recordSuccess(BackupOutcome.UNCHANGED, T3);

      fail(state, BACKUP_FAILURES_BEFORE_ALERT);

      expect(state.domainEvents).toHaveLength(1);
    });
  });

  describe('failures that say backing up is not available yet', () => {
    it('[BKP-063] should count them without announcing a streak', () => {
      const state = makeState();

      for (
        let night = 0;
        night < BACKUP_FAILURES_BEFORE_ALERT;
        night++
      )
        state.recordFailure(
          'Backups are not supported for this vendor yet',
          new Date(T1.getTime() + night * 86_400_000),
          'AP Norte',
          false
        );

      expect(state.consecutiveFailures).toBe(
        BACKUP_FAILURES_BEFORE_ALERT
      );
      expect(state.lastError).toBe(
        'Backups are not supported for this vendor yet'
      );
      expect(state.domainEvents).toHaveLength(0);
    });
  });
});
