// Source: src/domain/wireless-monitoring/events/WirelessSnapshotCreated.ts

import { WirelessSnapshotCreatedEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessSnapshotCreated';
import { WirelessSnapshotCreatedEventProps } from '../../../../src/domain/wireless-monitoring/props/WirelessSnapshotCreatedEventProps';
import {
  SnapshotId,
  DeviceId
} from '../../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2026-03-10T08:00:00.000Z');
const FIXED_COLLECTED = new Date('2026-03-10T07:59:30.000Z');

function makeEvent(
  overrides: Partial<WirelessSnapshotCreatedEventProps> = {}
): WirelessSnapshotCreatedEvent {
  return new WirelessSnapshotCreatedEvent({
    aggregateId: SnapshotId.create(),
    deviceId: DeviceId.create(),
    deviceType: 'STATION',
    collectedAt: FIXED_COLLECTED,
    dateTimeOccurred: FIXED_DATE,
    ...overrides
  });
}

// ---------------------------------------------------------------------------

describe('[WLS-122] WirelessSnapshotCreatedEvent', () => {
  let aggregateId: SnapshotId;
  let deviceId: DeviceId;

  beforeEach(() => {
    aggregateId = SnapshotId.create();
    deviceId = DeviceId.create();
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all props accessible via getters', () => {
      const event = makeEvent({ aggregateId, deviceId });

      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceId).toBe(deviceId);
      expect(event.deviceType).toBe('STATION');
      expect(event.collectedAt).toBe(FIXED_COLLECTED);
      expect(event.dateTimeOccurred).toBe(FIXED_DATE);
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should freeze props to prevent external mutation', () => {
      const event = makeEvent();

      expect(
        Object.isFrozen(
          (event as unknown as { props: unknown }).props
        )
      ).toBe(true);
    });

    it('should not allow mutation of props after construction', () => {
      const event = makeEvent();

      expect(() => {
        (
          event as unknown as { props: { deviceType: string } }
        ).props.deviceType = 'ACCESS_POINT';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = makeEvent();

      expect(() => {
        (
          event as unknown as { props: Record<string, unknown> }
        ).props.extra = 'value';
      }).toThrow();
    });

    it('should isolate event state from external mutation of the original props object', () => {
      const props: WirelessSnapshotCreatedEventProps = {
        aggregateId: SnapshotId.create(),
        deviceId: DeviceId.create(),
        deviceType: 'STATION',
        collectedAt: FIXED_COLLECTED,
        dateTimeOccurred: FIXED_DATE
      };
      const event = new WirelessSnapshotCreatedEvent(props);

      (props as { deviceType: string }).deviceType = 'ACCESS_POINT';

      expect(event.deviceType).toBe('STATION');
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the SnapshotId provided at construction', () => {
      const event = makeEvent({ aggregateId });

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should return the same reference on repeated reads', () => {
      const event = makeEvent({ aggregateId });

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceId getter', () => {
    it('should return the DeviceId provided at construction', () => {
      const event = makeEvent({ deviceId });

      expect(event.deviceId).toBe(deviceId);
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceType getter', () => {
    it('should return STATION when constructed with STATION', () => {
      const event = makeEvent({ deviceType: 'STATION' });

      expect(event.deviceType).toBe('STATION');
    });

    it('should return ACCESS_POINT when constructed with ACCESS_POINT', () => {
      const event = makeEvent({ deviceType: 'ACCESS_POINT' });

      expect(event.deviceType).toBe('ACCESS_POINT');
    });

    it('should return the same value on repeated reads', () => {
      const event = makeEvent({ deviceType: 'STATION' });

      expect(event.deviceType).toBe(event.deviceType);
    });
  });

  // -------------------------------------------------------------------------
  describe('collectedAt getter', () => {
    it('should return the Date provided at construction', () => {
      const event = makeEvent({ collectedAt: FIXED_COLLECTED });

      expect(event.collectedAt).toBe(FIXED_COLLECTED);
    });

    it('should be a Date instance', () => {
      const event = makeEvent();

      expect(event.collectedAt).toBeInstanceOf(Date);
    });

    it('should be independent from dateTimeOccurred', () => {
      const event = makeEvent({
        collectedAt: FIXED_COLLECTED,
        dateTimeOccurred: FIXED_DATE
      });

      expect(event.collectedAt).not.toBe(event.dateTimeOccurred);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = makeEvent({ dateTimeOccurred: FIXED_DATE });

      expect(event.dateTimeOccurred).toBe(FIXED_DATE);
    });

    it('should be a Date instance', () => {
      const event = makeEvent();

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = makeEvent();

      expect(event.toString()).toContain(
        'WirelessSnapshotCreatedEvent'
      );
    });

    it('should contain the aggregate ID string value', () => {
      const event = makeEvent({ aggregateId });

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp of dateTimeOccurred', () => {
      const event = makeEvent({ dateTimeOccurred: FIXED_DATE });

      expect(event.toString()).toContain(FIXED_DATE.toISOString());
    });

    it('should return a consistent string across multiple calls', () => {
      const event = makeEvent();

      expect(event.toString()).toBe(event.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events', () => {
      const id1 = SnapshotId.create();
      const id2 = SnapshotId.create();
      const event1 = makeEvent({
        aggregateId: id1,
        deviceType: 'STATION'
      });
      const event2 = makeEvent({
        aggregateId: id2,
        deviceType: 'ACCESS_POINT'
      });

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.deviceType).not.toBe(event2.deviceType);
    });

    it('should reflect different collectedAt timestamps when created with different values', () => {
      const earlier = new Date('2026-01-01T00:00:00Z');
      const later = new Date('2026-12-31T23:59:59Z');
      const event1 = makeEvent({ collectedAt: earlier });
      const event2 = makeEvent({ collectedAt: later });

      expect(event2.collectedAt.getTime()).toBeGreaterThan(
        event1.collectedAt.getTime()
      );
    });
  });
});
