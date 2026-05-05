// Source: src/domain/notifications/aggregates/Alert.ts

import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/notifications/enums/AlertSeverity';

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_ALERT_UUID  = '550e8400-e29b-41d4-a716-446655440002';

const STARTED_AT  = new Date('2024-06-01T10:00:00.000Z');
const RESOLVED_AT = new Date('2024-06-01T10:01:40.000Z'); // 100 seconds later

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeAlertId(): AlertId {
  return AlertId.parse(VALID_ALERT_UUID).value;
}

/** Open a fresh alert, throwing if the factory unexpectedly fails. */
function openAlert(
  deviceId: DeviceId = makeDeviceId(),
  severity: AlertSeverity = AlertSeverity.WARNING
): Alert {
  const result = Alert.open(deviceId, severity);
  if (result.isFailure) {
    throw new Error(`openAlert fixture failed: ${result.error}`);
  }
  return result.value;
}

/** Reconstitute an alert with full control over every prop. */
function reconstituteAlert(
  overrides: {
    deviceId?: DeviceId;
    severity?: AlertSeverity;
    startedAt?: Date;
    resolvedAt?: Date | null;
    notifiedAt?: Date | null;
    recoveryNotifiedAt?: Date | null;
    durationSecs?: number | null;
  } = {}
): Alert {
  return Alert.reconstitute(makeAlertId(), {
    deviceId:            overrides.deviceId            ?? makeDeviceId(),
    severity:            overrides.severity            ?? AlertSeverity.WARNING,
    startedAt:           overrides.startedAt           ?? STARTED_AT,
    resolvedAt:          overrides.resolvedAt          !== undefined ? overrides.resolvedAt          : null,
    notifiedAt:          overrides.notifiedAt          !== undefined ? overrides.notifiedAt          : null,
    recoveryNotifiedAt:  overrides.recoveryNotifiedAt  !== undefined ? overrides.recoveryNotifiedAt  : null,
    durationSecs:        overrides.durationSecs        !== undefined ? overrides.durationSecs        : null
  });
}

// ---------------------------------------------------------------------------

describe('Alert', () => {
  // ===========================================================================
  describe('open()', () => {
    // -------------------------------------------------------------------------
    describe('when given valid arguments', () => {
      it('should return a successful Result', () => {
        const result = Alert.open(makeDeviceId(), AlertSeverity.WARNING);

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should return an Alert instance', () => {
        const result = Alert.open(makeDeviceId(), AlertSeverity.WARNING);

        expect(result.value).toBeInstanceOf(Alert);
      });

      it('should set the provided deviceId on the alert', () => {
        const deviceId = makeDeviceId();
        const alert = openAlert(deviceId, AlertSeverity.WARNING);

        expect(alert.deviceId.toString()).toBe(VALID_DEVICE_UUID);
      });

      it('should set the provided severity to WARNING', () => {
        const alert = openAlert(makeDeviceId(), AlertSeverity.WARNING);

        expect(alert.severity).toBe(AlertSeverity.WARNING);
      });

      it('should set the provided severity to CRITICAL', () => {
        const alert = openAlert(makeDeviceId(), AlertSeverity.CRITICAL);

        expect(alert.severity).toBe(AlertSeverity.CRITICAL);
      });

      it('should set resolvedAt to null', () => {
        const alert = openAlert();

        expect(alert.resolvedAt).toBeNull();
      });

      it('should set notifiedAt to null', () => {
        const alert = openAlert();

        expect(alert.notifiedAt).toBeNull();
      });

      it('should set recoveryNotifiedAt to null', () => {
        const alert = openAlert();

        expect(alert.recoveryNotifiedAt).toBeNull();
      });

      it('should set durationSecs to null', () => {
        const alert = openAlert();

        expect(alert.durationSecs).toBeNull();
      });

      it('should report isOpen as true', () => {
        const alert = openAlert();

        expect(alert.isOpen).toBe(true);
      });

      it('should assign a generated AlertId to the alert', () => {
        const alert = openAlert();

        expect(alert.alertId).toBeInstanceOf(AlertId);
      });

      it('should assign a unique AlertId on each call', () => {
        const alertA = openAlert();
        const alertB = openAlert();

        expect(alertA.alertId.toString()).not.toBe(alertB.alertId.toString());
      });

      it('should set startedAt to a Date close to the current time', () => {
        const before = new Date();
        const alert  = openAlert();
        const after  = new Date();

        expect(alert.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(alert.startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      });
    });

    // -------------------------------------------------------------------------
    describe('when deviceId is null or undefined', () => {
      it('should return a failure Result when deviceId is null', () => {
        const result = Alert.open(null as unknown as DeviceId, AlertSeverity.WARNING);

        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });

      it('should return a failure Result when deviceId is undefined', () => {
        const result = Alert.open(undefined as unknown as DeviceId, AlertSeverity.WARNING);

        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });

      it('should include "deviceId" in the error message when null', () => {
        const result = Alert.open(null as unknown as DeviceId, AlertSeverity.WARNING);

        expect(result.error).toContain('deviceId');
      });

      it('should include "deviceId" in the error message when undefined', () => {
        const result = Alert.open(undefined as unknown as DeviceId, AlertSeverity.WARNING);

        expect(result.error).toContain('deviceId');
      });
    });
  });

  // ===========================================================================
  describe('reconstitute()', () => {
    it('should return an Alert instance without a Result wrapper', () => {
      const alert = reconstituteAlert();

      expect(alert).toBeInstanceOf(Alert);
    });

    it('should preserve the supplied AlertId', () => {
      const alertId = makeAlertId();
      const alert   = Alert.reconstitute(alertId, {
        deviceId:           makeDeviceId(),
        severity:           AlertSeverity.WARNING,
        startedAt:          STARTED_AT,
        resolvedAt:         null,
        notifiedAt:         null,
        recoveryNotifiedAt: null,
        durationSecs:       null
      });

      expect(alert.alertId.toString()).toBe(VALID_ALERT_UUID);
    });

    it('should preserve deviceId', () => {
      const alert = reconstituteAlert({ deviceId: makeDeviceId() });

      expect(alert.deviceId.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should preserve severity', () => {
      const alert = reconstituteAlert({ severity: AlertSeverity.CRITICAL });

      expect(alert.severity).toBe(AlertSeverity.CRITICAL);
    });

    it('should preserve startedAt', () => {
      const alert = reconstituteAlert({ startedAt: STARTED_AT });

      expect(alert.startedAt).toEqual(STARTED_AT);
    });

    it('should preserve a non-null resolvedAt', () => {
      const alert = reconstituteAlert({ resolvedAt: RESOLVED_AT, durationSecs: 100 });

      expect(alert.resolvedAt).toEqual(RESOLVED_AT);
    });

    it('should preserve null resolvedAt', () => {
      const alert = reconstituteAlert({ resolvedAt: null });

      expect(alert.resolvedAt).toBeNull();
    });

    it('should preserve a non-null notifiedAt', () => {
      const notifiedAt = new Date('2024-06-01T10:00:05.000Z');
      const alert = reconstituteAlert({ notifiedAt });

      expect(alert.notifiedAt).toEqual(notifiedAt);
    });

    it('should preserve null notifiedAt', () => {
      const alert = reconstituteAlert({ notifiedAt: null });

      expect(alert.notifiedAt).toBeNull();
    });

    it('should preserve a non-null recoveryNotifiedAt', () => {
      const recoveryNotifiedAt = new Date('2024-06-01T10:02:00.000Z');
      const alert = reconstituteAlert({
        resolvedAt:         RESOLVED_AT,
        recoveryNotifiedAt,
        durationSecs:       100
      });

      expect(alert.recoveryNotifiedAt).toEqual(recoveryNotifiedAt);
    });

    it('should preserve null recoveryNotifiedAt', () => {
      const alert = reconstituteAlert({ recoveryNotifiedAt: null });

      expect(alert.recoveryNotifiedAt).toBeNull();
    });

    it('should preserve a non-null durationSecs', () => {
      const alert = reconstituteAlert({
        resolvedAt:   RESOLVED_AT,
        durationSecs: 100
      });

      expect(alert.durationSecs).toBe(100);
    });

    it('should preserve null durationSecs', () => {
      const alert = reconstituteAlert({ durationSecs: null });

      expect(alert.durationSecs).toBeNull();
    });

    it('should report isOpen as true when resolvedAt is null', () => {
      const alert = reconstituteAlert({ resolvedAt: null });

      expect(alert.isOpen).toBe(true);
    });

    it('should report isOpen as false when resolvedAt is set', () => {
      const alert = reconstituteAlert({ resolvedAt: RESOLVED_AT, durationSecs: 100 });

      expect(alert.isOpen).toBe(false);
    });
  });

  // ===========================================================================
  describe('markNotified()', () => {
    it('should return a successful Result on the first call', () => {
      const alert  = openAlert();
      const result = alert.markNotified();

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
    });

    it('should set notifiedAt to a Date close to the current time', () => {
      const alert  = openAlert();
      const before = new Date();
      alert.markNotified();
      const after = new Date();

      expect(alert.notifiedAt).not.toBeNull();
      expect(alert.notifiedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(alert.notifiedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return a failure Result on the second call', () => {
      const alert = openAlert();
      alert.markNotified();

      const result = alert.markNotified();

      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
    });

    it('should include "already notified" in the error message when called twice', () => {
      const alert = openAlert();
      alert.markNotified();

      const result = alert.markNotified();

      expect(result.error).toMatch(/already notified/i);
    });

    it('should not overwrite the first notifiedAt timestamp on the second call', () => {
      const alert = openAlert();
      alert.markNotified();
      const firstTimestamp = alert.notifiedAt;

      alert.markNotified();

      expect(alert.notifiedAt).toEqual(firstTimestamp);
    });

    it('should leave notifiedAt non-null after a failed second call', () => {
      const alert = openAlert();
      alert.markNotified();
      alert.markNotified();

      expect(alert.notifiedAt).not.toBeNull();
    });
  });

  // ===========================================================================
  describe('resolve()', () => {
    it('should return a successful Result when the alert is open', () => {
      const alert  = openAlert();
      const result = alert.resolve(RESOLVED_AT);

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
    });

    it('should set resolvedAt to the provided date', () => {
      const alert = openAlert();
      alert.resolve(RESOLVED_AT);

      expect(alert.resolvedAt).toEqual(RESOLVED_AT);
    });

    it('should set isOpen to false after resolution', () => {
      const alert = openAlert();
      alert.resolve(RESOLVED_AT);

      expect(alert.isOpen).toBe(false);
    });

    it('should compute durationSecs as the integer number of seconds between startedAt and resolvedAt', () => {
      // Use reconstitute so we control startedAt precisely
      const alert = reconstituteAlert({ startedAt: STARTED_AT });
      alert.resolve(RESOLVED_AT); // 100 seconds later

      expect(alert.durationSecs).toBe(100);
    });

    it('should floor the duration when milliseconds do not divide evenly', () => {
      const startedAt  = new Date('2024-06-01T10:00:00.000Z');
      const resolvedAt = new Date('2024-06-01T10:00:01.999Z'); // 1.999 s → floor → 1
      const alert      = reconstituteAlert({ startedAt });
      alert.resolve(resolvedAt);

      expect(alert.durationSecs).toBe(1);
    });

    it('should set durationSecs to 0 when resolved immediately (same timestamp)', () => {
      const instant = new Date('2024-06-01T10:00:00.000Z');
      const alert   = reconstituteAlert({ startedAt: instant });
      alert.resolve(instant);

      expect(alert.durationSecs).toBe(0);
    });

    it('should return a failure Result when called a second time', () => {
      const alert = openAlert();
      alert.resolve(RESOLVED_AT);

      const result = alert.resolve(new Date());

      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
    });

    it('should include "already resolved" in the error message when called twice', () => {
      const alert = openAlert();
      alert.resolve(RESOLVED_AT);

      const result = alert.resolve(new Date());

      expect(result.error).toMatch(/already resolved/i);
    });

    it('should not overwrite resolvedAt on the second call', () => {
      const alert = openAlert();
      alert.resolve(RESOLVED_AT);

      alert.resolve(new Date('2024-12-01T00:00:00.000Z'));

      expect(alert.resolvedAt).toEqual(RESOLVED_AT);
    });
  });

  // ===========================================================================
  describe('markRecoveryNotified()', () => {
    // -------------------------------------------------------------------------
    describe('when the alert has been resolved', () => {
      it('should return a successful Result on the first call', () => {
        const alert = openAlert();
        alert.resolve(RESOLVED_AT);

        const result = alert.markRecoveryNotified();

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should set recoveryNotifiedAt to a Date close to the current time', () => {
        const alert = openAlert();
        alert.resolve(RESOLVED_AT);
        const before = new Date();
        alert.markRecoveryNotified();
        const after = new Date();

        expect(alert.recoveryNotifiedAt).not.toBeNull();
        expect(alert.recoveryNotifiedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(alert.recoveryNotifiedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
      });

      it('should return a failure Result on the second call', () => {
        const alert = openAlert();
        alert.resolve(RESOLVED_AT);
        alert.markRecoveryNotified();

        const result = alert.markRecoveryNotified();

        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });

      it('should include "already sent" in the error message when called twice', () => {
        const alert = openAlert();
        alert.resolve(RESOLVED_AT);
        alert.markRecoveryNotified();

        const result = alert.markRecoveryNotified();

        expect(result.error).toMatch(/already sent/i);
      });

      it('should not overwrite recoveryNotifiedAt on the second call', () => {
        const alert = openAlert();
        alert.resolve(RESOLVED_AT);
        alert.markRecoveryNotified();
        const firstTimestamp = alert.recoveryNotifiedAt;

        alert.markRecoveryNotified();

        expect(alert.recoveryNotifiedAt).toEqual(firstTimestamp);
      });
    });

    // -------------------------------------------------------------------------
    describe('when the alert is still open (not yet resolved)', () => {
      it('should return a failure Result', () => {
        const alert  = openAlert();
        const result = alert.markRecoveryNotified();

        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });

      it('should include "open alert" in the error message', () => {
        const alert  = openAlert();
        const result = alert.markRecoveryNotified();

        expect(result.error).toMatch(/open alert/i);
      });

      it('should leave recoveryNotifiedAt as null after the failed call', () => {
        const alert = openAlert();
        alert.markRecoveryNotified();

        expect(alert.recoveryNotifiedAt).toBeNull();
      });
    });
  });

  // ===========================================================================
  describe('isOpen getter', () => {
    it('should be true for a freshly opened alert', () => {
      const alert = openAlert();

      expect(alert.isOpen).toBe(true);
    });

    it('should be false after the alert is resolved', () => {
      const alert = openAlert();
      alert.resolve(RESOLVED_AT);

      expect(alert.isOpen).toBe(false);
    });

    it('should remain true after markNotified() without a resolution', () => {
      const alert = openAlert();
      alert.markNotified();

      expect(alert.isOpen).toBe(true);
    });
  });
});
