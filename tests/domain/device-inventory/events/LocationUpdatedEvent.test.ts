// Source: src/domain/device-inventory/events/LocationUpdatedEvent.ts

import {
  LocationUpdatedEvent,
  LocationUpdatedEventProps
} from '../../../../src/domain/device-inventory';
import { LocationId, UniqueEntityID } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventProps(
  overrides?: Partial<LocationUpdatedEventProps>
): LocationUpdatedEventProps {
  return {
    aggregateId: LocationId.create(),
    locationName: 'Main Tower',
    changedFields: ['name'],
    previousValues: { name: 'Old Tower' },
    newValues: { name: 'Main Tower' },
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('LocationUpdatedEvent', () => {
  let aggregateId: LocationId;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = LocationId.create();
    dateTimeOccurred = new Date('2024-06-01T10:00:00Z');
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const changedFields = ['name', 'type'];
      const previousValues = { name: 'Old', type: 'TOWER' };
      const newValues = { name: 'New', type: 'NODE' };

      const event = new LocationUpdatedEvent(
        makeEventProps({
          aggregateId,
          locationName: 'New',
          changedFields,
          previousValues,
          newValues,
          dateTimeOccurred
        })
      );

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.locationName).toBe('New');
      expect(event.changedFields).toEqual(changedFields);
      expect(event.previousValues).toEqual(previousValues);
      expect(event.newValues).toEqual(newValues);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new LocationUpdatedEvent(makeEventProps());

      expect(
        Object.isFrozen(
          (event as unknown as { props: unknown }).props
        )
      ).toBe(true);
    });

    it('should create an independent copy of props at construction time', () => {
      const props = makeEventProps({ aggregateId, dateTimeOccurred });
      const event = new LocationUpdatedEvent(props);

      (props as { locationName: string }).locationName = 'Mutated';

      expect(event.locationName).toBe('Main Tower');
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of locationName through props', () => {
      const event = new LocationUpdatedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: { locationName: string } }
        ).props.locationName = 'Hacked';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new LocationUpdatedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: Record<string, unknown> }
        ).props.extra = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new LocationUpdatedEvent(makeEventProps());

      expect(() => {
        delete (
          event as unknown as { props: Record<string, unknown> }
        ).props.locationName;
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the LocationId provided at construction', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should be an instance of LocationId', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(LocationId);
    });

    it('should be an instance of UniqueEntityID', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(event.dateTimeOccurred);
    });
  });

  // -------------------------------------------------------------------------
  describe('locationName getter', () => {
    it('should return the location name provided at construction', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ locationName: 'Updated Tower Site' })
      );

      expect(event.locationName).toBe('Updated Tower Site');
    });

    it('should return consistent value on multiple reads', () => {
      const event = new LocationUpdatedEvent(makeEventProps());

      expect(event.locationName).toBe(event.locationName);
    });
  });

  // -------------------------------------------------------------------------
  describe('changedFields getter', () => {
    it('should return the changedFields array provided at construction', () => {
      const changedFields = ['name', 'municipality'];
      const event = new LocationUpdatedEvent(
        makeEventProps({ changedFields })
      );

      expect(event.changedFields).toEqual(changedFields);
    });

    it('should handle a single changed field', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ changedFields: ['type'] })
      );

      expect(event.changedFields).toEqual(['type']);
    });

    it('should handle multiple changed fields', () => {
      const fields = ['name', 'type', 'municipality', 'neighborhood', 'address', 'coordinates'];
      const event = new LocationUpdatedEvent(
        makeEventProps({ changedFields: fields })
      );

      expect(event.changedFields).toEqual(fields);
      expect(event.changedFields.length).toBe(6);
    });

    it('should handle an empty changedFields array', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({
          changedFields: [],
          previousValues: {},
          newValues: {}
        })
      );

      expect(event.changedFields).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('previousValues getter', () => {
    it('should return the previousValues map provided at construction', () => {
      const previousValues = { name: 'Old Name', type: 'TOWER' };
      const event = new LocationUpdatedEvent(
        makeEventProps({ previousValues })
      );

      expect(event.previousValues).toEqual(previousValues);
    });

    it('should handle null values inside the map', () => {
      const previousValues = { municipality: null, coordinates: null };
      const event = new LocationUpdatedEvent(
        makeEventProps({
          changedFields: ['municipality', 'coordinates'],
          previousValues,
          newValues: {
            municipality: 'New City',
            coordinates: '6.24, -75.58'
          }
        })
      );

      expect(event.previousValues.municipality).toBeNull();
      expect(event.previousValues.coordinates).toBeNull();
    });

    it('should handle string coordinate values inside the map', () => {
      const previousValues = { coordinates: '6.2442, -75.5812, 1495m' };
      const event = new LocationUpdatedEvent(
        makeEventProps({
          changedFields: ['coordinates'],
          previousValues,
          newValues: { coordinates: '6.25, -75.60' }
        })
      );

      expect(event.previousValues.coordinates).toBe(
        '6.2442, -75.5812, 1495m'
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('newValues getter', () => {
    it('should return the newValues map provided at construction', () => {
      const newValues = { name: 'New Name', type: 'NODE' };
      const event = new LocationUpdatedEvent(
        makeEventProps({ newValues })
      );

      expect(event.newValues).toEqual(newValues);
    });

    it('should handle null values inside the map', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({
          changedFields: ['municipality'],
          previousValues: { municipality: 'Old City' },
          newValues: { municipality: null }
        })
      );

      expect(event.newValues.municipality).toBeNull();
    });

    it('should handle complex nested values inside the map', () => {
      const newValues = {
        config: { enabled: true, retries: 3 }
      };
      const event = new LocationUpdatedEvent(
        makeEventProps({
          changedFields: ['config'],
          previousValues: { config: { enabled: false, retries: 1 } },
          newValues
        })
      );

      expect(event.newValues.config).toEqual({
        enabled: true,
        retries: 3
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('LocationUpdatedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(
        dateTimeOccurred.toISOString()
      );
    });

    it('should return a consistent string across multiple calls', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toBe(event.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle a name-only change correctly', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({
          changedFields: ['name'],
          previousValues: { name: 'Old Tower' },
          newValues: { name: 'New Tower' }
        })
      );

      expect(event.changedFields).toEqual(['name']);
      expect(event.previousValues).toEqual({ name: 'Old Tower' });
      expect(event.newValues).toEqual({ name: 'New Tower' });
    });

    it('should handle a coordinates cleared-to-null change', () => {
      const event = new LocationUpdatedEvent(
        makeEventProps({
          changedFields: ['coordinates'],
          previousValues: { coordinates: '6.2442, -75.5812' },
          newValues: { coordinates: null }
        })
      );

      expect(event.changedFields).toEqual(['coordinates']);
      expect(event.previousValues.coordinates).toBe(
        '6.2442, -75.5812'
      );
      expect(event.newValues.coordinates).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events', () => {
      const id1 = LocationId.create();
      const id2 = LocationId.create();

      const event1 = new LocationUpdatedEvent(
        makeEventProps({
          aggregateId: id1,
          changedFields: ['name'],
          previousValues: { name: 'Site A' },
          newValues: { name: 'Site A Updated' }
        })
      );
      const event2 = new LocationUpdatedEvent(
        makeEventProps({
          aggregateId: id2,
          changedFields: ['type'],
          previousValues: { type: 'TOWER' },
          newValues: { type: 'NODE' }
        })
      );

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.changedFields).not.toEqual(event2.changedFields);
    });
  });
});
