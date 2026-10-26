// Source: src/domain/notifications/entities/DeviceNotificationPolicy.ts

import { DeviceNotificationPolicy } from '../../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { QuietHours } from '../../../../src/domain/notifications/value-objects/QuietHours';
import { QuietHoursMode } from '../../../../src/domain/notifications/props';
import { TimeOfDay } from '../../../../src/domain/shared/value-objects/TimeOfDay';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440080';
const AT_23H = new Date(2026, 5, 1, 23, 0);
const AT_NOON = new Date(2026, 5, 1, 12, 0);
const AT_3AM = new Date(2026, 5, 1, 3, 0);

function time(value: string): TimeOfDay {
  return TimeOfDay.create(value).value;
}

function makeQuietHours(start = '22:00', end = '07:00'): QuietHours {
  return QuietHours.create(time(start), time(end)).value;
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeProps(
  overrides: Partial<{
    deviceId: DeviceId;
    quietHoursMode: QuietHoursMode;
    quietHours: QuietHours | null;
    alertDelayMinutes: number | null;
  }> = {}
) {
  return {
    deviceId: makeDeviceId(),
    quietHoursMode: 'INHERIT' as QuietHoursMode,
    quietHours: null,
    alertDelayMinutes: null,
    ...overrides
  };
}

function makePolicy(
  overrides: Parameters<typeof makeProps>[0] = {}
): DeviceNotificationPolicy {
  return DeviceNotificationPolicy.create(
    makeProps(overrides),
    DeviceNotificationPolicyId.create()
  ).value;
}

describe('DeviceNotificationPolicy', () => {
  describe('create(props, id)', () => {
    it('should succeed inheriting quiet hours with no delay override', () => {
      const result = DeviceNotificationPolicy.create(
        makeProps(),
        DeviceNotificationPolicyId.create()
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should fail without a deviceId', () => {
      const result = DeviceNotificationPolicy.create(
        makeProps({ deviceId: null as unknown as DeviceId }),
        DeviceNotificationPolicyId.create()
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail for a negative alert delay', () => {
      const result = DeviceNotificationPolicy.create(
        makeProps({ alertDelayMinutes: -5 }),
        DeviceNotificationPolicyId.create()
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail for an unknown quiet-hours mode', () => {
      const result = DeviceNotificationPolicy.create(
        makeProps({ quietHoursMode: 'SOMETIMES' as QuietHoursMode }),
        DeviceNotificationPolicyId.create()
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('quietHoursMode must be one of');
    });

    it('should fail for CUSTOM without a window', () => {
      const result = DeviceNotificationPolicy.create(
        makeProps({ quietHoursMode: 'CUSTOM', quietHours: null }),
        DeviceNotificationPolicyId.create()
      );

      expect(result.isFailure).toBe(true);
    });

    it.each<QuietHoursMode>(['INHERIT', 'ALWAYS_NOTIFY'])(
      'should fail for %s carrying a window of its own',
      (mode) => {
        const result = DeviceNotificationPolicy.create(
          makeProps({
            quietHoursMode: mode,
            quietHours: makeQuietHours()
          }),
          DeviceNotificationPolicyId.create()
        );

        expect(result.isFailure).toBe(true);
      }
    );
  });

  describe('[NOT-170] INHERIT follows the install window', () => {
    it('should be inside quiet hours when the install window covers now', () => {
      const policy = makePolicy();

      expect(
        policy.isWithinQuietHours(AT_23H, makeQuietHours())
      ).toBe(true);
    });

    it('should be outside quiet hours outside the install window', () => {
      const policy = makePolicy();

      expect(
        policy.isWithinQuietHours(AT_NOON, makeQuietHours())
      ).toBe(false);
    });

    it('should never be inside quiet hours when the install has none', () => {
      const policy = makePolicy();

      expect(policy.isWithinQuietHours(AT_3AM, null)).toBe(false);
    });
  });

  describe('[NOT-170] CUSTOM overrides the install window', () => {
    it('should use its own window inside it', () => {
      const policy = makePolicy({
        quietHoursMode: 'CUSTOM',
        quietHours: makeQuietHours('11:00', '13:00')
      });

      expect(policy.isWithinQuietHours(AT_NOON, null)).toBe(true);
    });

    it('should ignore the install window outside its own', () => {
      const policy = makePolicy({
        quietHoursMode: 'CUSTOM',
        quietHours: makeQuietHours('11:00', '13:00')
      });

      expect(
        policy.isWithinQuietHours(AT_23H, makeQuietHours())
      ).toBe(false);
    });
  });

  describe('[NOT-170] ALWAYS_NOTIFY escapes the install window', () => {
    it('should never be inside quiet hours, even inside the install window', () => {
      const policy = makePolicy({ quietHoursMode: 'ALWAYS_NOTIFY' });

      expect(
        policy.isWithinQuietHours(AT_23H, makeQuietHours())
      ).toBe(false);
      expect(policy.effectiveQuietHours(makeQuietHours())).toBeNull();
    });
  });

  describe('setQuietHours(mode, quietHours)', () => {
    it('should switch to CUSTOM with a window and bump updatedAt', () => {
      const policy = makePolicy();
      const before = policy.updatedAt;

      const result = policy.setQuietHours('CUSTOM', makeQuietHours());

      expect(result.isSuccess).toBe(true);
      expect(policy.quietHoursMode).toBe('CUSTOM');
      expect(policy.quietHours).not.toBeNull();
      expect(policy.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
    });

    it('should drop the window when switched back to INHERIT', () => {
      const policy = makePolicy({
        quietHoursMode: 'CUSTOM',
        quietHours: makeQuietHours()
      });

      policy.setQuietHours('INHERIT', null);

      expect(policy.quietHoursMode).toBe('INHERIT');
      expect(policy.quietHours).toBeNull();
    });

    it('should refuse a mode/window mismatch and leave the policy unchanged', () => {
      const policy = makePolicy();

      const result = policy.setQuietHours(
        'ALWAYS_NOTIFY',
        makeQuietHours()
      );

      expect(result.isFailure).toBe(true);
      expect(policy.quietHoursMode).toBe('INHERIT');
      expect(policy.quietHours).toBeNull();
    });
  });

  describe('[NOT-173] setAlertDelayMinutes(minutes) / effectiveAlertDelayMs(defaultMs)', () => {
    it('should accept a non-negative override', () => {
      const policy = makePolicy();

      const result = policy.setAlertDelayMinutes(15);

      expect(result.isSuccess).toBe(true);
      expect(policy.alertDelayMinutes).toBe(15);
    });

    it('should reject a negative override', () => {
      const policy = makePolicy();

      const result = policy.setAlertDelayMinutes(-1);

      expect(result.isFailure).toBe(true);
      expect(policy.alertDelayMinutes).toBeNull();
    });

    it('should fall back to the system default when no override is set', () => {
      const policy = makePolicy();

      expect(policy.effectiveAlertDelayMs(3_600_000)).toBe(3_600_000);
    });

    it('should use the override in milliseconds when one is set', () => {
      const policy = makePolicy({ alertDelayMinutes: 5 });

      expect(policy.effectiveAlertDelayMs(3_600_000)).toBe(300_000);
    });
  });
});
