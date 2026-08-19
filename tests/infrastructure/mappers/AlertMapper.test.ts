// Source: src/infrastructure/mappers/AlertMapper.ts

import { AlertMapper } from '../../../src/infrastructure/mappers/AlertMapper';
import { Alert } from '../../../src/domain/notifications/aggregates/Alert';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

const STARTED_AT = new Date('2024-01-01T00:00:00.000Z');
const RESOLVED_AT = new Date('2024-01-01T00:05:00.000Z');
const NOTIFIED_AT = new Date('2024-01-01T00:00:30.000Z');
const RECOVERY_NOTIFIED_AT = new Date('2024-01-01T00:05:10.000Z');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type RawAlertRecord = {
  id: string;
  deviceId: string;
  severity: string;
  source: string;
  type: string;
  description: string;
  startedAt: Date;
  resolvedAt: Date | null;
  notifiedAt: Date | null;
  recoveryNotifiedAt: Date | null;
};

function makeRawAlertRecord(
  overrides: Partial<RawAlertRecord> = {}
): RawAlertRecord {
  return {
    id: VALID_UUID_1,
    deviceId: VALID_UUID_2,
    severity: 'WARNING',
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión',
    startedAt: STARTED_AT,
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('AlertMapper', () => {
  // =========================================================================
  describe('toDomain()', () => {
    // -----------------------------------------------------------------------
    describe('happy path — WARNING severity, all nullable fields null', () => {
      it('should return an Alert instance', () => {
        const raw = makeRawAlertRecord({ severity: 'WARNING' });

        const alert = AlertMapper.toDomain(raw);

        expect(alert).toBeInstanceOf(Alert);
      });

      it('should map alertId to the correct string value', () => {
        const raw = makeRawAlertRecord();

        const alert = AlertMapper.toDomain(raw);

        expect(alert.id.toString()).toBe(VALID_UUID_1);
      });

      it('should map deviceId to the correct string value', () => {
        const raw = makeRawAlertRecord();

        const alert = AlertMapper.toDomain(raw);

        expect(alert.deviceId.toString()).toBe(VALID_UUID_2);
      });

      it('should map severity to AlertSeverity.WARNING', () => {
        const raw = makeRawAlertRecord({ severity: 'WARNING' });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.severity).toBe(AlertSeverity.WARNING);
      });

      it('should map startedAt correctly', () => {
        const raw = makeRawAlertRecord();

        const alert = AlertMapper.toDomain(raw);

        expect(alert.startedAt).toEqual(STARTED_AT);
      });

      it('should map resolvedAt as null when raw.resolvedAt is null', () => {
        const raw = makeRawAlertRecord({ resolvedAt: null });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.resolvedAt).toBeNull();
      });

      it('should map notifiedAt as null when raw.notifiedAt is null', () => {
        const raw = makeRawAlertRecord({ notifiedAt: null });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.notifiedAt).toBeNull();
      });

      it('should map recoveryNotifiedAt as null when raw.recoveryNotifiedAt is null', () => {
        const raw = makeRawAlertRecord({ recoveryNotifiedAt: null });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.recoveryNotifiedAt).toBeNull();
      });

      it('should compute durationSecs as null when resolvedAt is null', () => {
        const raw = makeRawAlertRecord({ resolvedAt: null });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.durationSecs).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('happy path — CRITICAL severity', () => {
      it('should map severity to AlertSeverity.CRITICAL', () => {
        const raw = makeRawAlertRecord({ severity: 'CRITICAL' });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.severity).toBe(AlertSeverity.CRITICAL);
      });
    });

    // -----------------------------------------------------------------------
    describe('happy path — all nullable fields populated', () => {
      it('should map resolvedAt when present', () => {
        const raw = makeRawAlertRecord({ resolvedAt: RESOLVED_AT });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.resolvedAt).toEqual(RESOLVED_AT);
      });

      it('should map notifiedAt when present', () => {
        const raw = makeRawAlertRecord({ notifiedAt: NOTIFIED_AT });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.notifiedAt).toEqual(NOTIFIED_AT);
      });

      it('should map recoveryNotifiedAt when present', () => {
        const raw = makeRawAlertRecord({
          resolvedAt: RESOLVED_AT,
          recoveryNotifiedAt: RECOVERY_NOTIFIED_AT
        });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.recoveryNotifiedAt).toEqual(
          RECOVERY_NOTIFIED_AT
        );
      });

      it('should compute durationSecs from startedAt and resolvedAt', () => {
        const raw = makeRawAlertRecord({ resolvedAt: RESOLVED_AT });

        const alert = AlertMapper.toDomain(raw);

        expect(alert.durationSecs).toBe(300);
      });
    });

    // -----------------------------------------------------------------------
    describe('data integrity violation — invalid alertId', () => {
      it('should throw when alertId is not a valid UUID', () => {
        const raw = makeRawAlertRecord({ id: 'not-a-uuid' });

        expect(() => AlertMapper.toDomain(raw)).toThrow();
      });

      it('should include "Data integrity violation" in the error message', () => {
        const raw = makeRawAlertRecord({ id: 'not-a-uuid' });

        expect(() => AlertMapper.toDomain(raw)).toThrow(
          'Data integrity violation'
        );
      });

      it('should include the invalid alertId value in the error message', () => {
        const raw = makeRawAlertRecord({ id: 'bad-alert-id' });

        expect(() => AlertMapper.toDomain(raw)).toThrow(
          'bad-alert-id'
        );
      });

      it('should throw when alertId is an empty string', () => {
        const raw = makeRawAlertRecord({ id: '' });

        expect(() => AlertMapper.toDomain(raw)).toThrow();
      });
    });

    // -----------------------------------------------------------------------
    describe('data integrity violation — invalid deviceId', () => {
      it('should throw when deviceId is not a valid UUID', () => {
        const raw = makeRawAlertRecord({ deviceId: 'not-a-uuid' });

        expect(() => AlertMapper.toDomain(raw)).toThrow();
      });

      it('should include "Data integrity violation" in the error message', () => {
        const raw = makeRawAlertRecord({ deviceId: 'bad-device-id' });

        expect(() => AlertMapper.toDomain(raw)).toThrow(
          'Data integrity violation'
        );
      });

      it('should include the invalid deviceId value in the error message', () => {
        const raw = makeRawAlertRecord({
          deviceId: 'clearly-invalid'
        });

        expect(() => AlertMapper.toDomain(raw)).toThrow(
          'clearly-invalid'
        );
      });

      it('should throw when deviceId is an empty string', () => {
        const raw = makeRawAlertRecord({ deviceId: '' });

        expect(() => AlertMapper.toDomain(raw)).toThrow();
      });
    });

    // -----------------------------------------------------------------------
    describe('data integrity violation — unknown severity', () => {
      it('should throw when severity is an unrecognised string', () => {
        const raw = makeRawAlertRecord({ severity: 'FATAL' });

        expect(() => AlertMapper.toDomain(raw)).toThrow();
      });

      it('should include "Data integrity violation" in the error message', () => {
        const raw = makeRawAlertRecord({ severity: 'FATAL' });

        expect(() => AlertMapper.toDomain(raw)).toThrow(
          'Data integrity violation'
        );
      });

      it('should include the unrecognised severity value in the error message', () => {
        const raw = makeRawAlertRecord({ severity: 'FATAL' });

        expect(() => AlertMapper.toDomain(raw)).toThrow('FATAL');
      });

      it('should throw for a lowercase severity string "warning"', () => {
        const raw = makeRawAlertRecord({ severity: 'warning' });

        expect(() => AlertMapper.toDomain(raw)).toThrow();
      });

      it('should throw for an empty severity string', () => {
        const raw = makeRawAlertRecord({ severity: '' });

        expect(() => AlertMapper.toDomain(raw)).toThrow();
      });
    });
  });

  // =========================================================================
  describe('toPersistence()', () => {
    // -----------------------------------------------------------------------
    function buildFullyPopulatedAlert(): Alert {
      return AlertMapper.toDomain(
        makeRawAlertRecord({
          resolvedAt: RESOLVED_AT,
          notifiedAt: NOTIFIED_AT,
          recoveryNotifiedAt: RECOVERY_NOTIFIED_AT
        })
      );
    }

    function buildNullableNullAlert(): Alert {
      return AlertMapper.toDomain(makeRawAlertRecord());
    }

    describe('happy path — fully populated Alert', () => {
      it('should serialize id as a string', () => {
        const alert = buildFullyPopulatedAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.id).toBe(VALID_UUID_1);
      });

      it('should serialize deviceId as a string', () => {
        const alert = buildFullyPopulatedAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.deviceId).toBe(VALID_UUID_2);
      });

      it('should serialize severity as a string', () => {
        const alert = buildFullyPopulatedAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.severity).toBe('WARNING');
      });

      it('should serialize startedAt as a Date', () => {
        const alert = buildFullyPopulatedAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.startedAt).toEqual(STARTED_AT);
      });

      it('should serialize resolvedAt when present', () => {
        const alert = buildFullyPopulatedAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.resolvedAt).toEqual(RESOLVED_AT);
      });

      it('should serialize notifiedAt when present', () => {
        const alert = buildFullyPopulatedAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.notifiedAt).toEqual(NOTIFIED_AT);
      });

      it('should serialize recoveryNotifiedAt when present', () => {
        const alert = buildFullyPopulatedAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.recoveryNotifiedAt).toEqual(RECOVERY_NOTIFIED_AT);
      });
    });

    // -----------------------------------------------------------------------
    describe('nullable fields serialize as null when null', () => {
      it('should serialize resolvedAt as null', () => {
        const alert = buildNullableNullAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.resolvedAt).toBeNull();
      });

      it('should serialize notifiedAt as null', () => {
        const alert = buildNullableNullAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.notifiedAt).toBeNull();
      });

      it('should serialize recoveryNotifiedAt as null', () => {
        const alert = buildNullableNullAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.recoveryNotifiedAt).toBeNull();
      });

      it('resolvedAt null value should be strictly null, not undefined', () => {
        const alert = buildNullableNullAlert();

        const raw = AlertMapper.toPersistence(alert);

        expect(raw.resolvedAt).toStrictEqual(null);
      });
    });

    // -----------------------------------------------------------------------
    describe('round-trip — toDomain → toPersistence', () => {
      it('should reproduce id after a round-trip', () => {
        const originalRaw = makeRawAlertRecord();

        const serialized = AlertMapper.toPersistence(
          AlertMapper.toDomain(originalRaw)
        );

        expect(serialized.id).toBe(originalRaw.id);
      });

      it('should reproduce deviceId after a round-trip', () => {
        const originalRaw = makeRawAlertRecord();

        const serialized = AlertMapper.toPersistence(
          AlertMapper.toDomain(originalRaw)
        );

        expect(serialized.deviceId).toBe(originalRaw.deviceId);
      });

      it('should reproduce severity after a round-trip', () => {
        const originalRaw = makeRawAlertRecord({
          severity: 'CRITICAL'
        });

        const serialized = AlertMapper.toPersistence(
          AlertMapper.toDomain(originalRaw)
        );

        expect(serialized.severity).toBe(originalRaw.severity);
      });

      it('should reproduce startedAt after a round-trip', () => {
        const originalRaw = makeRawAlertRecord();

        const serialized = AlertMapper.toPersistence(
          AlertMapper.toDomain(originalRaw)
        );

        expect(serialized.startedAt).toEqual(originalRaw.startedAt);
      });

      it('should reproduce all nullable fields as null after a round-trip with null inputs', () => {
        const originalRaw = makeRawAlertRecord();

        const serialized = AlertMapper.toPersistence(
          AlertMapper.toDomain(originalRaw)
        );

        expect(serialized.resolvedAt).toBeNull();
        expect(serialized.notifiedAt).toBeNull();
        expect(serialized.recoveryNotifiedAt).toBeNull();
      });

      it('should reproduce all nullable fields when populated after a round-trip', () => {
        const originalRaw = makeRawAlertRecord({
          resolvedAt: RESOLVED_AT,
          notifiedAt: NOTIFIED_AT,
          recoveryNotifiedAt: RECOVERY_NOTIFIED_AT
        });

        const serialized = AlertMapper.toPersistence(
          AlertMapper.toDomain(originalRaw)
        );

        expect(serialized.resolvedAt).toEqual(originalRaw.resolvedAt);
        expect(serialized.notifiedAt).toEqual(originalRaw.notifiedAt);
        expect(serialized.recoveryNotifiedAt).toEqual(
          originalRaw.recoveryNotifiedAt
        );
      });
    });
  });
});
