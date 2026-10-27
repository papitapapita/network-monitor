// Source: src/domain/device-backups/aggregates/ConfigBackup.ts

import { describe, it, expect } from '@jest/globals';
import {
  BackupFormat,
  BackupTrigger,
  ConfigBackup,
  MAX_CONFIG_BYTES
} from '../../../../src/domain/device-backups';
import { DeviceId } from '../../../../src/domain/shared/ids';

const HASH = 'a'.repeat(64);
const TAKEN_AT = new Date('2026-10-07T08:00:00Z');

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: DeviceId.create(),
    format: BackupFormat.AIROS_CFG,
    contentHash: HASH,
    sizeBytes: 2048,
    trigger: BackupTrigger.SCHEDULED,
    takenAt: TAKEN_AT,
    ...overrides
  } as Parameters<typeof ConfigBackup.create>[0];
}

function makeBackup(overrides: Record<string, unknown> = {}) {
  const result = ConfigBackup.create(makeProps(overrides));
  if (result.isFailure)
    throw new Error(`fixture failed: ${result.error}`);
  return result.value;
}

describe('ConfigBackup', () => {
  describe('create()', () => {
    it('[BKP-001] should start checked at the moment it was taken', () => {
      const backup = makeBackup();

      expect(backup.lastCheckedAt).toEqual(TAKEN_AT);
      expect(backup.takenAt).toEqual(TAKEN_AT);
    });

    it('[BKP-002] should reject a hash that is not a SHA-256 hex digest', () => {
      const result = ConfigBackup.create(
        makeProps({ contentHash: 'ABC' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Backup content hash must be a SHA-256 hex digest'
      );
    });

    it('[BKP-003] should reject an empty file', () => {
      const result = ConfigBackup.create(makeProps({ sizeBytes: 0 }));

      expect(result.error).toBe(
        'A configuration backup cannot be empty'
      );
    });

    it('[BKP-004] should reject a file over the size limit', () => {
      const result = ConfigBackup.create(
        makeProps({ sizeBytes: MAX_CONFIG_BYTES + 1 })
      );

      expect(result.error).toBe(
        `A configuration backup cannot exceed ${MAX_CONFIG_BYTES} bytes`
      );
    });

    it('[BKP-004] should accept a file exactly at the size limit', () => {
      const result = ConfigBackup.create(
        makeProps({ sizeBytes: MAX_CONFIG_BYTES })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should reject an unknown format', () => {
      const result = ConfigBackup.create(
        makeProps({ format: 'ZIP' })
      );

      expect(result.error).toBe('Unknown backup format: ZIP');
    });

    it('should reject a missing device', () => {
      const result = ConfigBackup.create(
        makeProps({ deviceId: undefined })
      );

      expect(result.error).toBe('deviceId is null or undefined');
    });
  });

  describe('matches()', () => {
    it('should compare by content hash', () => {
      const backup = makeBackup();

      expect(backup.matches(HASH)).toBe(true);
      expect(backup.matches('b'.repeat(64))).toBe(false);
    });
  });

  describe('confirmUnchanged()', () => {
    it('[BKP-006] should move the last check forward', () => {
      const backup = makeBackup();
      const later = new Date('2026-10-08T08:00:00Z');

      const result = backup.confirmUnchanged(later);

      expect(result.isSuccess).toBe(true);
      expect(backup.lastCheckedAt).toEqual(later);
      expect(backup.takenAt).toEqual(TAKEN_AT);
    });

    it('[BKP-007] should never move the last check backwards', () => {
      const backup = makeBackup();
      backup.confirmUnchanged(new Date('2026-10-09T08:00:00Z'));

      backup.confirmUnchanged(new Date('2026-10-08T08:00:00Z'));

      expect(backup.lastCheckedAt).toEqual(
        new Date('2026-10-09T08:00:00Z')
      );
    });

    it('[BKP-007] should ignore a check from before the backup was taken', () => {
      const backup = makeBackup();

      const result = backup.confirmUnchanged(
        new Date('2026-10-06T08:00:00Z')
      );

      expect(result.isSuccess).toBe(true);
      expect(backup.lastCheckedAt).toEqual(TAKEN_AT);
    });
  });
});
