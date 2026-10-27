// Source: src/domain/notifications/services/OutageAttribution.ts

import { OutageAttribution } from '../../../../src/domain/notifications/services/OutageAttribution';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';

const NOW = new Date('2024-06-01T10:00:00.000Z');
const DELAY_MS = 5 * 60_000;

function makeAlert(resolvedAt: Date | null = null): Alert {
  return Alert.reconstitute(AlertId.create(), {
    deviceId: DeviceId.parse('550e8400-e29b-41d4-a716-446655440001')
      .value,
    severity: AlertSeverity.CRITICAL,
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión.',
    startedAt: new Date(NOW.getTime() - 3_600_000),
    resolvedAt,
    notifiedAt: null,
    recoveryNotifiedAt: null
  });
}

describe('OutageAttribution', () => {
  describe('[NOT-240/241] rootCause()', () => {
    it('is null when nothing upstream is down', () => {
      expect(
        OutageAttribution.rootCause([
          { deviceId: 'ap', down: false },
          { deviceId: 'switch', down: false }
        ])
      ).toBeNull();
    });

    it('is null for a device with no upstream', () => {
      expect(OutageAttribution.rootCause([])).toBeNull();
    });

    it('is the highest down device, not the nearest', () => {
      expect(
        OutageAttribution.rootCause([
          { deviceId: 'ap', down: true },
          { deviceId: 'switch', down: true },
          { deviceId: 'gateway', down: false }
        ])
      ).toBe('switch');
    });

    it('walks past an up or unknown device in between', () => {
      expect(
        OutageAttribution.rootCause([
          { deviceId: 'ap', down: false },
          { deviceId: 'switch', down: true }
        ])
      ).toBe('switch');
    });
  });

  describe('decide()', () => {
    it('alerts on its own when there is no root cause', () => {
      expect(OutageAttribution.decide(null, null)).toEqual({
        kind: 'ALERT_SELF'
      });
    });

    it('[NOT-242] waits while the root has no open alert', () => {
      expect(OutageAttribution.decide('switch', null)).toEqual({
        kind: 'WAIT'
      });
    });

    it('[NOT-242] waits when the root alert handed in is already resolved', () => {
      expect(
        OutageAttribution.decide('switch', makeAlert(NOW))
      ).toEqual({ kind: 'WAIT' });
    });

    it('[NOT-241] attaches to the open root alert', () => {
      const root = makeAlert();

      const decision = OutageAttribution.decide('switch', root);

      expect(decision).toEqual({
        kind: 'ATTACH_TO',
        causeId: root.id
      });
    });
  });

  describe('[NOT-245] stillHeld()', () => {
    it('lets go when the cause is gone', () => {
      expect(OutageAttribution.stillHeld(null, NOW, DELAY_MS)).toBe(
        false
      );
    });

    it('holds while the cause is open', () => {
      expect(
        OutageAttribution.stillHeld(makeAlert(), NOW, DELAY_MS)
      ).toBe(true);
    });

    it('holds inside the delay after the cause recovered', () => {
      const cause = makeAlert(new Date(NOW.getTime() - DELAY_MS + 1));

      expect(OutageAttribution.stillHeld(cause, NOW, DELAY_MS)).toBe(
        true
      );
    });

    it('lets go once the delay since the recovery has passed', () => {
      const cause = makeAlert(new Date(NOW.getTime() - DELAY_MS));

      expect(OutageAttribution.stillHeld(cause, NOW, DELAY_MS)).toBe(
        false
      );
    });
  });
});
