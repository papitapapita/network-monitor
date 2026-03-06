// Source: src/domain/device-inventory/events/DeviceLocationAssignedEvent.ts

import {
  DeviceLocationAssignedEvent,
  DeviceLocationAssignedEventProps,
  DeviceName
} from '../../../../src/domain/device-inventory';
import { DeviceId, LocationId } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventProps(
  overrides?: Partial<DeviceLocationAssignedEventProps>
): DeviceLocationAssignedEventProps {
  return {
    aggregateId: DeviceId.create(),
    deviceName: DeviceName.create('Core-Router-01').value,
    previousLocationId: null,
    newLocationId: LocationId.create(),
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('DeviceLocationAssignedEvent', () => {
  let aggregateId: DeviceId;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = DeviceId.create();
    dateTimeOccurred = new Date('2024-06-01T10:00:00Z');
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const newLocation = LocationId.create();
      const props = makeEventProps({
        aggregateId,
        dateTimeOccurred,
        previousLocationId: null,
        newLocationId: newLocation
      });
      const event = new DeviceLocationAssignedEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceName.value).toBe('Core-Router-01');
      expect(event.previousLocationId).toBeNull();
      expect(event.newLocationId).toBe(newLocation);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should create an event when both locationIds are null (unassignment with no prior location)', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ previousLocationId: null, newLocationId: null })
      );

      expect(event.previousLocationId).toBeNull();
      expect(event.newLocationId).toBeNull();
    });

    it('should create an event when moving between two locations', () => {
      const prev = LocationId.create();
      const next = LocationId.create();
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ previousLocationId: prev, newLocationId: next })
      );

      expect(event.previousLocationId).toBe(prev);
      expect(event.newLocationId).toBe(next);
    });

    it('should create an event when unassigning a location (newLocationId null)', () => {
      const prev = LocationId.create();
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ previousLocationId: prev, newLocationId: null })
      );

      expect(event.previousLocationId).toBe(prev);
      expect(event.newLocationId).toBeNull();
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new DeviceLocationAssignedEvent(makeEventProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate from external mutation of the original props object', () => {
      const origLocation = LocationId.create();
      const props = makeEventProps({ newLocationId: origLocation });
      const event = new DeviceLocationAssignedEvent(props);

      (props as { newLocationId: LocationId | null }).newLocationId = null;

      expect(event.newLocationId).toBe(origLocation);
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of props after construction', () => {
      const event = new DeviceLocationAssignedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as {
            props: { newLocationId: LocationId | null };
          }
        ).props.newLocationId = null;
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the DeviceId provided at construction', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should be a Date instance', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceName getter', () => {
    it('should return the DeviceName provided at construction', () => {
      const name = DeviceName.create('Switch-Floor-3').value;
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ deviceName: name })
      );

      expect(event.deviceName).toBe(name);
      expect(event.deviceName.value).toBe('Switch-Floor-3');
    });
  });

  // -------------------------------------------------------------------------
  describe('previousLocationId getter', () => {
    it('should return null when no previous location was set', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ previousLocationId: null })
      );

      expect(event.previousLocationId).toBeNull();
    });

    it('should return the LocationId when a previous location existed', () => {
      const prev = LocationId.create();
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ previousLocationId: prev })
      );

      expect(event.previousLocationId).toBe(prev);
      expect(event.previousLocationId).toBeInstanceOf(LocationId);
    });

    it('should return the same reference on repeated reads', () => {
      const prev = LocationId.create();
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ previousLocationId: prev })
      );

      expect(event.previousLocationId).toBe(event.previousLocationId);
    });
  });

  // -------------------------------------------------------------------------
  describe('newLocationId getter', () => {
    it('should return null when the location is being unassigned', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ newLocationId: null })
      );

      expect(event.newLocationId).toBeNull();
    });

    it('should return the new LocationId when a location is assigned', () => {
      const newLoc = LocationId.create();
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ newLocationId: newLoc })
      );

      expect(event.newLocationId).toBe(newLoc);
      expect(event.newLocationId).toBeInstanceOf(LocationId);
    });

    it('should differ from previousLocationId when they are different', () => {
      const prev = LocationId.create();
      const next = LocationId.create();
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ previousLocationId: prev, newLocationId: next })
      );

      expect(
        event.previousLocationId!.equals(event.newLocationId!)
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('DeviceLocationAssignedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new DeviceLocationAssignedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(
        dateTimeOccurred.toISOString()
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events', () => {
      const id1 = DeviceId.create();
      const id2 = DeviceId.create();
      const loc1 = LocationId.create();
      const loc2 = LocationId.create();
      const event1 = new DeviceLocationAssignedEvent(
        makeEventProps({ aggregateId: id1, newLocationId: loc1 })
      );
      const event2 = new DeviceLocationAssignedEvent(
        makeEventProps({ aggregateId: id2, newLocationId: loc2 })
      );

      expect(event1.aggregateId.toString()).toBe(id1.toString());
      expect(event2.aggregateId.toString()).toBe(id2.toString());
      expect(event1.newLocationId!.toString()).not.toBe(
        event2.newLocationId!.toString()
      );
    });
  });
});
