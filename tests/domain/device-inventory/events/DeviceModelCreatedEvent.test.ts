// Source: src/domain/device-inventory/events/DeviceModelCreatedEvent.ts

import {
  DeviceModelCreatedEvent
} from '../../../../src/domain/device-inventory';
import { DeviceModelId, UniqueEntityID } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DeviceModelCreatedEventProps {
  aggregateId: DeviceModelId;
  vendorName: string;
  model: string;
  dateTimeOccurred: Date;
}

function makeEventProps(
  overrides?: Partial<DeviceModelCreatedEventProps>
): DeviceModelCreatedEventProps {
  return {
    aggregateId: DeviceModelId.create(),
    vendorName: 'Cisco',
    model: 'ISR-4321',
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('DeviceModelCreatedEvent', () => {
  let aggregateId: DeviceModelId;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = DeviceModelId.create();
    dateTimeOccurred = new Date('2024-06-01T10:00:00Z');
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const props = makeEventProps({ aggregateId, dateTimeOccurred });
      const event = new DeviceModelCreatedEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.vendorName).toBe('Cisco');
      expect(event.model).toBe('ISR-4321');
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new DeviceModelCreatedEvent(makeEventProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate from external mutation of the original props object', () => {
      const props = makeEventProps({ aggregateId, dateTimeOccurred });
      const event = new DeviceModelCreatedEvent(props);

      (props as { model: string }).model = 'Changed-Model';

      expect(event.model).toBe('ISR-4321');
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of props after construction', () => {
      const event = new DeviceModelCreatedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: { model: string } }
        ).props.model = 'Mutated-Model';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new DeviceModelCreatedEvent(makeEventProps());

      expect(() => {
        (event as unknown as { props: Record<string, unknown> }).props.extra =
          'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new DeviceModelCreatedEvent(makeEventProps());

      expect(() => {
        delete (event as unknown as { props: Record<string, unknown> }).props
          .model;
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the DeviceModelId provided at construction', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should be an instance of DeviceModelId', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(DeviceModelId);
    });

    it('should also be an instance of UniqueEntityID', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should be a Date instance', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(event.dateTimeOccurred);
    });
  });

  // -------------------------------------------------------------------------
  describe('vendorName getter', () => {
    it('should return the vendorName provided at construction', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ vendorName: 'Ubiquiti' })
      );

      expect(event.vendorName).toBe('Ubiquiti');
    });

    it('should reflect different vendor names', () => {
      const vendors = ['Cisco', 'MikroTik', 'Ubiquiti', 'HP', 'Juniper'];

      for (const vendorName of vendors) {
        const event = new DeviceModelCreatedEvent(
          makeEventProps({ vendorName })
        );

        expect(event.vendorName).toBe(vendorName);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('model getter', () => {
    it('should return the model provided at construction', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ model: 'RB750Gr3' })
      );

      expect(event.model).toBe('RB750Gr3');
    });

    it('should return the correct model string', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ model: 'UniFi-AP-AC-Pro' })
      );

      expect(event.model).toBe('UniFi-AP-AC-Pro');
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('DeviceModelCreatedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(dateTimeOccurred.toISOString());
    });

    it('should return a consistent string across multiple calls', () => {
      const event = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toBe(event.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events', () => {
      const id1 = DeviceModelId.create();
      const id2 = DeviceModelId.create();
      const event1 = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId: id1, vendorName: 'Cisco', model: 'ISR-4321' })
      );
      const event2 = new DeviceModelCreatedEvent(
        makeEventProps({ aggregateId: id2, vendorName: 'MikroTik', model: 'RB750Gr3' })
      );

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.vendorName).not.toBe(event2.vendorName);
      expect(event1.model).not.toBe(event2.model);
    });
  });
});
