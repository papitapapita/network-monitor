// Source: src/domain/device-monitoring/events/DeviceCameOnlineEvent.ts

import { DeviceCameOnlineEvent } from '../../../../src/domain/device-monitoring/events/DeviceCameOnlineEvent';
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
    latencyMs?: number | null;
    dateTimeOccurred?: Date;
  } = {}
): DeviceCameOnlineEvent {
  return new DeviceCameOnlineEvent({
    aggregateId: overrides.aggregateId ?? makeDeviceId(),
    latencyMs:
      overrides.latencyMs !== undefined ? overrides.latencyMs : 15,
    dateTimeOccurred: overrides.dateTimeOccurred ?? FIXED_DATE
  });
}

// ---------------------------------------------------------------------------

describe('DeviceCameOnlineEvent', () => {
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

    it('should return the latencyMs supplied in props', () => {
      const event = makeEvent({ latencyMs: 42 });

      expect(event.latencyMs).toBe(42);
    });

    it('should return null latencyMs when none is provided', () => {
      const event = makeEvent({ latencyMs: null });

      expect(event.latencyMs).toBeNull();
    });

    it('should return zero latencyMs when 0 is provided', () => {
      const event = makeEvent({ latencyMs: 0 });

      expect(event.latencyMs).toBe(0);
    });

    it('should return the dateTimeOccurred supplied in props', () => {
      const event = makeEvent({ dateTimeOccurred: FIXED_DATE });

      expect(event.dateTimeOccurred).toEqual(FIXED_DATE);
    });

    it('should return the exact timestamp set in props', () => {
      const event = makeEvent({ dateTimeOccurred: FIXED_DATE });

      expect(event.dateTimeOccurred.getTime()).toBe(
        FIXED_DATE.getTime()
      );
    });
  });

  // ===========================================================================
  describe('toString()', () => {
    it('should include the class name in the string representation', () => {
      const event = makeEvent();

      expect(event.toString()).toContain('DeviceCameOnlineEvent');
    });

    it('should include the aggregateId in the string representation', () => {
      const event = makeEvent();

      expect(event.toString()).toContain(VALID_DEVICE_UUID);
    });
  });

  // ===========================================================================
  describe('immutability', () => {
    it('should freeze the props so they cannot be mutated', () => {
      const event = makeEvent({ latencyMs: 15 });

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event as any).props.latencyMs = 999;
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
