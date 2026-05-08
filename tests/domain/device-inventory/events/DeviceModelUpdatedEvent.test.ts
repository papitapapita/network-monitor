// Source: src/domain/device-inventory/events/DeviceModelUpdatedEvent.ts

import {
  DeviceModelUpdatedEvent
} from '../../../../src/domain/device-inventory';
import { DeviceModelId, UniqueEntityID } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DeviceModelUpdatedEventProps {
  aggregateId: DeviceModelId;
  model: string;
  changedFields: string[];
  dateTimeOccurred: Date;
}

function makeEventProps(
  overrides?: Partial<DeviceModelUpdatedEventProps>
): DeviceModelUpdatedEventProps {
  return {
    aggregateId: DeviceModelId.create(),
    model: 'ISR-4321',
    changedFields: ['model'],
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('DeviceModelUpdatedEvent', () => {
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
      const event = new DeviceModelUpdatedEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.model).toBe('ISR-4321');
      expect(event.changedFields).toEqual(['model']);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new DeviceModelUpdatedEvent(makeEventProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate from external mutation of the original props object', () => {
      const changedFields = ['model'];
      const props = makeEventProps({ aggregateId, dateTimeOccurred, changedFields });
      const event = new DeviceModelUpdatedEvent(props);

      (props as { model: string }).model = 'Mutated-Model';

      expect(event.model).toBe('ISR-4321');
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of props after construction', () => {
      const event = new DeviceModelUpdatedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: { model: string } }
        ).props.model = 'Mutated-Model';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new DeviceModelUpdatedEvent(makeEventProps());

      expect(() => {
        (event as unknown as { props: Record<string, unknown> }).props.extra =
          'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new DeviceModelUpdatedEvent(makeEventProps());

      expect(() => {
        delete (event as unknown as { props: Record<string, unknown> }).props
          .model;
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the DeviceModelId provided at construction', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should be an instance of DeviceModelId', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(DeviceModelId);
    });

    it('should also be an instance of UniqueEntityID', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should be a Date instance', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(event.dateTimeOccurred);
    });
  });

  // -------------------------------------------------------------------------
  describe('model getter', () => {
    it('should return the model provided at construction', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ model: 'RB750Gr3' })
      );

      expect(event.model).toBe('RB750Gr3');
    });

    it('should return the correct model string', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ model: 'UniFi-AP-AC-Pro' })
      );

      expect(event.model).toBe('UniFi-AP-AC-Pro');
    });
  });

  // -------------------------------------------------------------------------
  describe('changedFields getter', () => {
    it('should return the changedFields array provided at construction', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ changedFields: ['model'] })
      );

      expect(event.changedFields).toEqual(['model']);
    });

    it('should return changedFields with a single "deviceType" entry', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ changedFields: ['deviceType'] })
      );

      expect(event.changedFields).toEqual(['deviceType']);
    });

    it('should return changedFields with a single "vendorId" entry', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ changedFields: ['vendorId'] })
      );

      expect(event.changedFields).toEqual(['vendorId']);
    });

    it('should reflect every changed field variant', () => {
      const fieldSets: string[][] = [
        ['model'],
        ['deviceType'],
        ['vendorId']
      ];

      for (const changedFields of fieldSets) {
        const event = new DeviceModelUpdatedEvent(
          makeEventProps({ changedFields })
        );

        expect(event.changedFields).toEqual(changedFields);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('DeviceModelUpdatedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new DeviceModelUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(dateTimeOccurred.toISOString());
    });

    it('should return a consistent string across multiple calls', () => {
      const event = new DeviceModelUpdatedEvent(
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
      const event1 = new DeviceModelUpdatedEvent(
        makeEventProps({
          aggregateId: id1,
          model: 'ISR-4321',
          changedFields: ['model']
        })
      );
      const event2 = new DeviceModelUpdatedEvent(
        makeEventProps({
          aggregateId: id2,
          model: 'RB750Gr3',
          changedFields: ['deviceType']
        })
      );

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.model).not.toBe(event2.model);
      expect(event1.changedFields).not.toEqual(event2.changedFields);
    });
  });
});
