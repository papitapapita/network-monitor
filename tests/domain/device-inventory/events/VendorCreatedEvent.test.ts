// Source: src/domain/device-inventory/events/VendorCreatedEvent.ts

import {
  VendorCreatedEvent
} from '../../../../src/domain/device-inventory';
import { VendorId, UniqueEntityID } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface VendorCreatedEventProps {
  aggregateId: VendorId;
  vendorName: string;
  vendorSlug: string;
  dateTimeOccurred: Date;
}

function makeEventProps(
  overrides?: Partial<VendorCreatedEventProps>
): VendorCreatedEventProps {
  return {
    aggregateId: VendorId.create(),
    vendorName: 'Cisco',
    vendorSlug: 'cisco',
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('VendorCreatedEvent', () => {
  let aggregateId: VendorId;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = VendorId.create();
    dateTimeOccurred = new Date('2024-06-01T10:00:00Z');
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const props = makeEventProps({ aggregateId, dateTimeOccurred });
      const event = new VendorCreatedEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.vendorName).toBe('Cisco');
      expect(event.vendorSlug).toBe('cisco');
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new VendorCreatedEvent(makeEventProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate from external mutation of the original props object', () => {
      const props = makeEventProps({ aggregateId, dateTimeOccurred });
      const event = new VendorCreatedEvent(props);

      (props as { vendorName: string }).vendorName = 'Changed';

      expect(event.vendorName).toBe('Cisco');
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of props after construction', () => {
      const event = new VendorCreatedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: { vendorName: string } }
        ).props.vendorName = 'Mutated';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new VendorCreatedEvent(makeEventProps());

      expect(() => {
        (event as unknown as { props: Record<string, unknown> }).props.extra =
          'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new VendorCreatedEvent(makeEventProps());

      expect(() => {
        delete (event as unknown as { props: Record<string, unknown> }).props
          .vendorName;
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the VendorId provided at construction', () => {
      const event = new VendorCreatedEvent(makeEventProps({ aggregateId }));

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should be an instance of VendorId', () => {
      const event = new VendorCreatedEvent(makeEventProps({ aggregateId }));

      expect(event.aggregateId).toBeInstanceOf(VendorId);
    });

    it('should also be an instance of UniqueEntityID', () => {
      const event = new VendorCreatedEvent(makeEventProps({ aggregateId }));

      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new VendorCreatedEvent(makeEventProps({ aggregateId }));

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should be a Date instance', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(event.dateTimeOccurred);
    });
  });

  // -------------------------------------------------------------------------
  describe('vendorName getter', () => {
    it('should return the vendorName provided at construction', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ vendorName: 'MikroTik' })
      );

      expect(event.vendorName).toBe('MikroTik');
    });

    it('should reflect different vendor names', () => {
      const vendors = ['Cisco', 'MikroTik', 'Ubiquiti', 'HP'];

      for (const vendorName of vendors) {
        const event = new VendorCreatedEvent(makeEventProps({ vendorName }));

        expect(event.vendorName).toBe(vendorName);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('vendorSlug getter', () => {
    it('should return the vendorSlug provided at construction', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ vendorSlug: 'mikrotik' })
      );

      expect(event.vendorSlug).toBe('mikrotik');
    });

    it('should reflect different vendor slugs', () => {
      const slugs = ['cisco', 'mikrotik', 'ubiquiti', 'tp-link'];

      for (const vendorSlug of slugs) {
        const event = new VendorCreatedEvent(makeEventProps({ vendorSlug }));

        expect(event.vendorSlug).toBe(vendorSlug);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('VendorCreatedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(dateTimeOccurred.toISOString());
    });

    it('should return a consistent string across multiple calls', () => {
      const event = new VendorCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toBe(event.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events', () => {
      const id1 = VendorId.create();
      const id2 = VendorId.create();
      const event1 = new VendorCreatedEvent(
        makeEventProps({
          aggregateId: id1,
          vendorName: 'Cisco',
          vendorSlug: 'cisco'
        })
      );
      const event2 = new VendorCreatedEvent(
        makeEventProps({
          aggregateId: id2,
          vendorName: 'MikroTik',
          vendorSlug: 'mikrotik'
        })
      );

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.vendorName).not.toBe(event2.vendorName);
      expect(event1.vendorSlug).not.toBe(event2.vendorSlug);
    });
  });
});
