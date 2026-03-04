// Source: src/domain/device-inventory/events/LocationCreatedEvent.ts

import {
  LocationCreatedEvent,
  LocationCreatedEventProps,
  LocationType
} from '../../../../src/domain/device-inventory';
import { LocationId, UniqueEntityID } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventProps(
  overrides?: Partial<LocationCreatedEventProps>
): LocationCreatedEventProps {
  return {
    aggregateId: LocationId.create(),
    locationName: 'Main Tower',
    locationType: LocationType.TOWER,
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('LocationCreatedEvent', () => {
  let aggregateId: LocationId;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = LocationId.create();
    dateTimeOccurred = new Date('2024-06-01T10:00:00Z');
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const props = makeEventProps({
        aggregateId,
        dateTimeOccurred
      });
      const event = new LocationCreatedEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.locationName).toBe('Main Tower');
      expect(event.locationType).toBe(LocationType.TOWER);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props to prevent external mutation after construction', () => {
      const event = new LocationCreatedEvent(makeEventProps());

      expect(Object.isFrozen((event as unknown as { props: unknown }).props)).toBe(true);
    });

    it('should create an independent copy of props to isolate from external mutation', () => {
      const props = makeEventProps({ aggregateId, dateTimeOccurred });
      const event = new LocationCreatedEvent(props);

      (props as { locationName: string }).locationName = 'Modified';

      expect(event.locationName).toBe('Main Tower');
    });

    it('should accept every valid LocationType value', () => {
      const types: LocationType[] = [
        LocationType.TOWER,
        LocationType.NODE,
        LocationType.DATACENTER,
        LocationType.POP,
        LocationType.WAREHOUSE,
        LocationType.OFFICE
      ];

      for (const type of types) {
        const event = new LocationCreatedEvent(
          makeEventProps({ locationType: type })
        );
        expect(event.locationType).toBe(type);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of locationName through props', () => {
      const event = new LocationCreatedEvent(makeEventProps());

      expect(() => {
        (event as unknown as { props: { locationName: string } }).props.locationName = 'Hacked';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new LocationCreatedEvent(makeEventProps());

      expect(() => {
        (event as unknown as { props: Record<string, unknown> }).props.extra = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new LocationCreatedEvent(makeEventProps());

      expect(() => {
        delete (event as unknown as { props: Record<string, unknown> }).props.locationName;
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the LocationId provided at construction', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should be an instance of LocationId', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(LocationId);
    });

    it('should also be an instance of UniqueEntityID', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(event.dateTimeOccurred);
    });
  });

  // -------------------------------------------------------------------------
  describe('locationName getter', () => {
    it('should return the location name provided at construction', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ locationName: 'DataCenter-Alpha' })
      );

      expect(event.locationName).toBe('DataCenter-Alpha');
    });

    it('should return consistent value on multiple reads', () => {
      const event = new LocationCreatedEvent(makeEventProps());

      expect(event.locationName).toBe(event.locationName);
    });

    it('should handle location names with special characters', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ locationName: 'Tower #1 - Zone A (North)' })
      );

      expect(event.locationName).toBe('Tower #1 - Zone A (North)');
    });
  });

  // -------------------------------------------------------------------------
  describe('locationType getter', () => {
    it('should return TOWER when created with TOWER type', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ locationType: LocationType.TOWER })
      );

      expect(event.locationType).toBe(LocationType.TOWER);
    });

    it('should return NODE when created with NODE type', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ locationType: LocationType.NODE })
      );

      expect(event.locationType).toBe(LocationType.NODE);
    });

    it('should return DATACENTER when created with DATACENTER type', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ locationType: LocationType.DATACENTER })
      );

      expect(event.locationType).toBe(LocationType.DATACENTER);
    });

    it('should return POP when created with POP type', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ locationType: LocationType.POP })
      );

      expect(event.locationType).toBe(LocationType.POP);
    });

    it('should return WAREHOUSE when created with WAREHOUSE type', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ locationType: LocationType.WAREHOUSE })
      );

      expect(event.locationType).toBe(LocationType.WAREHOUSE);
    });

    it('should return OFFICE when created with OFFICE type', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ locationType: LocationType.OFFICE })
      );

      expect(event.locationType).toBe(LocationType.OFFICE);
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('LocationCreatedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(
        dateTimeOccurred.toISOString()
      );
    });

    it('should return a consistent string across multiple calls', () => {
      const event = new LocationCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toBe(event.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events', () => {
      const id1 = LocationId.create();
      const id2 = LocationId.create();

      const event1 = new LocationCreatedEvent(
        makeEventProps({ aggregateId: id1, locationName: 'Site A' })
      );
      const event2 = new LocationCreatedEvent(
        makeEventProps({ aggregateId: id2, locationName: 'Site B' })
      );

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.locationName).not.toBe(event2.locationName);
      expect(event1.aggregateId.toString()).toBe(id1.toString());
      expect(event2.aggregateId.toString()).toBe(id2.toString());
    });

    it('should reflect different timestamps when created at different moments', () => {
      const earlier = new Date('2024-01-01T00:00:00Z');
      const later = new Date('2024-12-31T23:59:59Z');

      const event1 = new LocationCreatedEvent(
        makeEventProps({ dateTimeOccurred: earlier })
      );
      const event2 = new LocationCreatedEvent(
        makeEventProps({ dateTimeOccurred: later })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
