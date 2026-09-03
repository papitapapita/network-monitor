// Source: src/domain/notifications/entities/DeviceNotificationPolicy.ts

import { DeviceNotificationPolicy } from '../../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { QuietHours } from '../../../../src/domain/notifications/value-objects/QuietHours';
import { TimeOfDay } from '../../../../src/domain/notifications/value-objects/TimeOfDay';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440080';

function time(value: string): TimeOfDay {
  return TimeOfDay.create(value).value;
}

function makeQuietHours(start = '22:00', end = '07:00'): QuietHours {
  return QuietHours.create(time(start), time(end)).value;
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

describe('DeviceNotificationPolicy', () => {
  describe('create(props, id)', () => {
    it('should succeed with no quiet hours and no delay override', () => {
      const result = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: null,
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should fail without a deviceId', () => {
      const result = DeviceNotificationPolicy.create(
        {
          deviceId: null as unknown as DeviceId,
          quietHours: null,
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail for a negative alert delay', () => {
      const result = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: null,
          alertDelayMinutes: -5
        },
        DeviceNotificationPolicyId.create()
      );

      expect(result.isFailure).toBe(true);
    });
  });

  describe('[NOT-170] isWithinQuietHours(now) — no window configured', () => {
    it('should always be false, regardless of the time', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: null,
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      ).value;

      expect(
        policy.isWithinQuietHours(new Date(2026, 5, 1, 3, 0))
      ).toBe(false);
    });
  });

  describe('isWithinQuietHours(now) — window configured', () => {
    it('should be true inside the configured window', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: makeQuietHours('22:00', '07:00'),
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      ).value;

      expect(
        policy.isWithinQuietHours(new Date(2026, 5, 1, 23, 0))
      ).toBe(true);
    });

    it('should be false outside the configured window', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: makeQuietHours('22:00', '07:00'),
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      ).value;

      expect(
        policy.isWithinQuietHours(new Date(2026, 5, 1, 12, 0))
      ).toBe(false);
    });
  });

  describe('setQuietHours(quietHours)', () => {
    it('should replace the window and bump updatedAt', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: null,
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      ).value;
      const before = policy.updatedAt;

      const result = policy.setQuietHours(makeQuietHours());

      expect(result.isSuccess).toBe(true);
      expect(policy.quietHours).not.toBeNull();
      expect(policy.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
    });

    it('should clear the window when set back to null', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: makeQuietHours(),
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      ).value;

      policy.setQuietHours(null);

      expect(policy.quietHours).toBeNull();
    });
  });

  describe('[NOT-173] setAlertDelayMinutes(minutes) / effectiveAlertDelayMs(defaultMs)', () => {
    it('should accept a non-negative override', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: null,
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      ).value;

      const result = policy.setAlertDelayMinutes(15);

      expect(result.isSuccess).toBe(true);
      expect(policy.alertDelayMinutes).toBe(15);
    });

    it('should reject a negative override', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: null,
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      ).value;

      const result = policy.setAlertDelayMinutes(-1);

      expect(result.isFailure).toBe(true);
      expect(policy.alertDelayMinutes).toBeNull();
    });

    it('should fall back to the system default when no override is set', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: null,
          alertDelayMinutes: null
        },
        DeviceNotificationPolicyId.create()
      ).value;

      expect(policy.effectiveAlertDelayMs(3_600_000)).toBe(3_600_000);
    });

    it('should use the override in milliseconds when one is set', () => {
      const policy = DeviceNotificationPolicy.create(
        {
          deviceId: makeDeviceId(),
          quietHours: null,
          alertDelayMinutes: 5
        },
        DeviceNotificationPolicyId.create()
      ).value;

      expect(policy.effectiveAlertDelayMs(3_600_000)).toBe(300_000);
    });
  });
});
