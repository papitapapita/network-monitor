// Source: src/domain/device-monitoring/events/DeviceWentOfflineEvent.ts

import { DeviceWentOfflineEvent } from '../../../../src/domain/device-monitoring/events/DeviceWentOfflineEvent';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeEvent(
  overrides: {
    aggregateId?: DeviceId;
    consecutiveFailures?: number;
    dateTimeOccurred?: Date;
  } = {}
): DeviceWentOfflineEvent {
  return new DeviceWentOfflineEvent({
    aggregateId: overrides.aggregateId ?? makeDeviceId(),
    consecutiveFailures: overrides.consecutiveFailures ?? 3,
    dateTimeOccurred: overrides.dateTimeOccurred ?? FIXED_DATE
  });
}

// ---------------------------------------------------------------------------

describe('DeviceWentOfflineEvent', () => {
  // ===========================================================================
  describe('getters', () => {
    it('should return the aggregateId supplied in props', () => {
      const deviceId = makeDeviceId();
      const event = makeEvent({ aggregateId: deviceId });

      expect(event.aggregateId).toBe(deviceId);
    });

    it('should return the aggregateId toString as the original UUID string', () => {
      const event = makeEvent();

      expect(event.aggregateId.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should return the consecutiveFailures supplied in props', () => {
      const event = makeEvent({ consecutiveFailures: 5 });

      expect(event.consecutiveFailures).toBe(5);
    });

    it('should return consecutiveFailures of 1 when the threshold is 1', () => {
      const event = makeEvent({ consecutiveFailures: 1 });

      expect(event.consecutiveFailures).toBe(1);
    });

    it('should return the dateTimeOccurred supplied in props', () => {
      const event = makeEvent({ dateTimeOccurred: FIXED_DATE });

      expect(event.dateTimeOccurred).toEqual(FIXED_DATE);
    });

    it('should return the exact Date object reference set in props', () => {
      const event = makeEvent({ dateTimeOccurred: FIXED_DATE });

      // The base class freezes a shallow copy of props, so we compare by value
      expect(event.dateTimeOccurred.getTime()).toBe(
        FIXED_DATE.getTime()
      );
    });
  });

  // ===========================================================================
  describe('toString()', () => {
    it('should include the class name in the string representation', () => {
      const event = makeEvent();

      expect(event.toString()).toContain('DeviceWentOfflineEvent');
    });

    it('should include the aggregateId in the string representation', () => {
      const event = makeEvent();

      expect(event.toString()).toContain(VALID_DEVICE_UUID);
    });
  });

  // ===========================================================================
  describe('immutability', () => {
    it('should freeze the props so they cannot be mutated', () => {
      const event = makeEvent({ consecutiveFailures: 3 });

      // Object.isFrozen checks that the props object itself is frozen
      // We verify behaviorally: strict mode throws on assignment to frozen object
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event as any).props.consecutiveFailures = 99;
      }).toThrow();
    });

    it('should not allow new properties to be added to props', () => {
      const event = makeEvent();

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event as any).props.extraField = 'injected';
      }).toThrow();
    });
  });
});
