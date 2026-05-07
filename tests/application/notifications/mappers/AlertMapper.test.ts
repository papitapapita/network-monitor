// Source: src/application/notifications/mappers/AlertMapper.ts

import { AlertMapper } from '../../../../src/application/notifications/mappers/AlertMapper';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/notifications/enums/AlertSeverity';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ALERT_UUID  = '550e8400-e29b-41d4-a716-446655440010';
const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440011';

const STARTED_AT           = new Date('2024-06-01T10:00:00.000Z');
const RESOLVED_AT          = new Date('2024-06-01T10:01:40.000Z');
const NOTIFIED_AT          = new Date('2024-06-01T10:00:05.000Z');
const RECOVERY_NOTIFIED_AT = new Date('2024-06-01T10:01:45.000Z');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAlertId(): AlertId {
  return AlertId.parse(VALID_ALERT_UUID).value;
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeOpenAlert(): Alert {
  return Alert.reconstitute(makeAlertId(), {
    deviceId:           makeDeviceId(),
    severity:           AlertSeverity.CRITICAL,
    startedAt:          STARTED_AT,
    resolvedAt:         null,
    notifiedAt:         null,
    recoveryNotifiedAt: null,
    durationSecs:       null
  });
}

function makeResolvedAlert(): Alert {
  return Alert.reconstitute(makeAlertId(), {
    deviceId:           makeDeviceId(),
    severity:           AlertSeverity.CRITICAL,
    startedAt:          STARTED_AT,
    resolvedAt:         RESOLVED_AT,
    notifiedAt:         NOTIFIED_AT,
    recoveryNotifiedAt: RECOVERY_NOTIFIED_AT,
    durationSecs:       100
  });
}

// ---------------------------------------------------------------------------

describe('AlertMapper', () => {
  // ===========================================================================
  describe('toDTO()', () => {
    describe('when alert is open (no resolution or notification timestamps)', () => {
      it('should set status to OPEN', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.status).toBe('OPEN');
      });

      it('should map id from alertId.toString()', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.id).toBe(VALID_ALERT_UUID);
      });

      it('should map deviceId from deviceId.toString()', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.deviceId).toBe(VALID_DEVICE_UUID);
      });

      it('should map severity', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.severity).toBe(AlertSeverity.CRITICAL);
      });

      it('should map startedAt to ISO string', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.startedAt).toBe(STARTED_AT.toISOString());
      });

      it('should set resolvedAt to null', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.resolvedAt).toBeNull();
      });

      it('should set notifiedAt to null', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.notifiedAt).toBeNull();
      });

      it('should set recoveryNotifiedAt to null', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.recoveryNotifiedAt).toBeNull();
      });

      it('should set durationSecs to null', () => {
        // arrange
        const alert = makeOpenAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.durationSecs).toBeNull();
      });
    });

    describe('when alert is resolved with all timestamps populated', () => {
      it('should set status to RESOLVED', () => {
        // arrange
        const alert = makeResolvedAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.status).toBe('RESOLVED');
      });

      it('should map resolvedAt to ISO string', () => {
        // arrange
        const alert = makeResolvedAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.resolvedAt).toBe(RESOLVED_AT.toISOString());
      });

      it('should map notifiedAt to ISO string', () => {
        // arrange
        const alert = makeResolvedAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.notifiedAt).toBe(NOTIFIED_AT.toISOString());
      });

      it('should map recoveryNotifiedAt to ISO string', () => {
        // arrange
        const alert = makeResolvedAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.recoveryNotifiedAt).toBe(RECOVERY_NOTIFIED_AT.toISOString());
      });

      it('should map durationSecs', () => {
        // arrange
        const alert = makeResolvedAlert();

        // act
        const dto = AlertMapper.toDTO(alert);

        // assert
        expect(dto.durationSecs).toBe(100);
      });
    });
  });

  // ===========================================================================
  describe('toListDTO()', () => {
    it('should set hasMore to true when offset + items.length < total', () => {
      // arrange
      const alerts = [makeOpenAlert(), makeOpenAlert()];

      // act
      const dto = AlertMapper.toListDTO(alerts, 10, 5, 0);

      // assert
      expect(dto.hasMore).toBe(true);
    });

    it('should set hasMore to false when offset + items.length equals total', () => {
      // arrange
      const alerts = [makeOpenAlert(), makeOpenAlert()];

      // act
      const dto = AlertMapper.toListDTO(alerts, 2, 5, 0);

      // assert
      expect(dto.hasMore).toBe(false);
    });

    it('should set hasMore to false when offset + items.length exceeds total', () => {
      // arrange
      const alerts = [makeOpenAlert()];

      // act
      // offset=5, length=1 → 6 > 5 (total)
      const dto = AlertMapper.toListDTO(alerts, 5, 10, 5);

      // assert
      expect(dto.hasMore).toBe(false);
    });

    it('should map each alert through toDTO', () => {
      // arrange
      const open     = makeOpenAlert();
      const resolved = makeResolvedAlert();

      // act
      const dto = AlertMapper.toListDTO([open, resolved], 2, 10, 0);

      // assert
      expect(dto.alerts).toHaveLength(2);
      expect(dto.alerts[0].status).toBe('OPEN');
      expect(dto.alerts[1].status).toBe('RESOLVED');
    });

    it('should reflect total, limit, and offset in the DTO', () => {
      // arrange
      const alerts = [makeOpenAlert()];

      // act
      const dto = AlertMapper.toListDTO(alerts, 99, 25, 50);

      // assert
      expect(dto.total).toBe(99);
      expect(dto.limit).toBe(25);
      expect(dto.offset).toBe(50);
    });

    it('should return an empty alerts array when the input is empty', () => {
      // act
      const dto = AlertMapper.toListDTO([], 0, 10, 0);

      // assert
      expect(dto.alerts).toEqual([]);
      expect(dto.total).toBe(0);
      expect(dto.hasMore).toBe(false);
    });
  });
});
