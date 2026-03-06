// Source: src/domain/device-inventory/events/DeviceStatusChangedEvent.ts

import {
  DeviceStatusChangedEvent,
  DeviceStatusChangedEventProps,
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory';
import { DeviceId } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventProps(
  overrides?: Partial<DeviceStatusChangedEventProps>
): DeviceStatusChangedEventProps {
  return {
    aggregateId: DeviceId.create(),
    deviceName: DeviceName.create('Core-Router-01').value,
    previousStatus: DeviceStatus.createInventory(),
    newStatus: DeviceStatus.createActive(),
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('DeviceStatusChangedEvent', () => {
  let aggregateId: DeviceId;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = DeviceId.create();
    dateTimeOccurred = new Date('2024-06-01T10:00:00Z');
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const props = makeEventProps({ aggregateId, dateTimeOccurred });
      const event = new DeviceStatusChangedEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceName.value).toBe('Core-Router-01');
      expect(event.previousStatus.isInInventory()).toBe(true);
      expect(event.newStatus.isActive()).toBe(true);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new DeviceStatusChangedEvent(makeEventProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate from external mutation of the original props object', () => {
      const prevStatus = DeviceStatus.createInventory();
      const props = makeEventProps({ previousStatus: prevStatus });
      const event = new DeviceStatusChangedEvent(props);

      (props as { previousStatus: DeviceStatus }).previousStatus =
        DeviceStatus.createDamaged();

      expect(event.previousStatus.isInInventory()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of props after construction', () => {
      const event = new DeviceStatusChangedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: { newStatus: DeviceStatus } }
        ).props.newStatus = DeviceStatus.createDamaged();
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the DeviceId provided at construction', () => {
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should be a Date instance', () => {
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceName getter', () => {
    it('should return the DeviceName provided at construction', () => {
      const name = DeviceName.create('AP-Building-1').value;
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ deviceName: name })
      );

      expect(event.deviceName).toBe(name);
    });
  });

  // -------------------------------------------------------------------------
  describe('previousStatus getter', () => {
    it('should return the previous DeviceStatus provided', () => {
      const previous = DeviceStatus.createMaintenance();
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ previousStatus: previous })
      );

      expect(event.previousStatus).toBe(previous);
      expect(event.previousStatus.isInMaintenance()).toBe(true);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceStatusChangedEvent(makeEventProps());

      expect(event.previousStatus).toBe(event.previousStatus);
    });
  });

  // -------------------------------------------------------------------------
  describe('newStatus getter', () => {
    it('should return the new DeviceStatus provided', () => {
      const next = DeviceStatus.createDamaged();
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ newStatus: next })
      );

      expect(event.newStatus).toBe(next);
      expect(event.newStatus.isDamaged()).toBe(true);
    });

    it('should differ from previousStatus when they are different', () => {
      const event = new DeviceStatusChangedEvent(
        makeEventProps({
          previousStatus: DeviceStatus.createInventory(),
          newStatus: DeviceStatus.createActive()
        })
      );

      expect(event.previousStatus.equals(event.newStatus)).toBe(false);
    });

    it('should reflect all valid status transitions', () => {
      const transitions: Array<
        [DeviceStatus, DeviceStatus]
      > = [
        [DeviceStatus.createInventory(), DeviceStatus.createActive()],
        [DeviceStatus.createActive(), DeviceStatus.createMaintenance()],
        [DeviceStatus.createMaintenance(), DeviceStatus.createActive()],
        [DeviceStatus.createActive(), DeviceStatus.createDamaged()],
        [DeviceStatus.createDamaged(), DeviceStatus.createDecommissioned()]
      ];

      for (const [prev, next] of transitions) {
        const event = new DeviceStatusChangedEvent(
          makeEventProps({ previousStatus: prev, newStatus: next })
        );

        expect(event.previousStatus.value).toBe(prev.value);
        expect(event.newStatus.value).toBe(next.value);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('DeviceStatusChangedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new DeviceStatusChangedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new DeviceStatusChangedEvent(
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
      const event1 = new DeviceStatusChangedEvent(
        makeEventProps({
          aggregateId: id1,
          newStatus: DeviceStatus.createActive()
        })
      );
      const event2 = new DeviceStatusChangedEvent(
        makeEventProps({
          aggregateId: id2,
          newStatus: DeviceStatus.createDamaged()
        })
      );

      expect(event1.aggregateId.toString()).toBe(id1.toString());
      expect(event2.aggregateId.toString()).toBe(id2.toString());
      expect(event1.newStatus.value).not.toBe(event2.newStatus.value);
    });
  });
});
