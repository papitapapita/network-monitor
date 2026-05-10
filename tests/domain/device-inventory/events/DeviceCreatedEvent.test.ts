// Source: src/domain/device-inventory/events/DeviceCreatedEvent.ts

import {
  DeviceCreatedEvent,
  DeviceCreatedEventProps,
  DeviceName,
  DeviceStatus,
  DeviceOwnerType
} from '../../../../src/domain/device-inventory';
import { DeviceId, UniqueEntityID } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventProps(
  overrides?: Partial<DeviceCreatedEventProps>
): DeviceCreatedEventProps {
  return {
    aggregateId: DeviceId.create(),
    deviceName: DeviceName.create('Core-Router-01').value,
    status: DeviceStatus.createInventory(),
    ownerType: DeviceOwnerType.COMPANY,
    monitoringEnabled: false,
    ipAddress: null,
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('DeviceCreatedEvent', () => {
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
      const event = new DeviceCreatedEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceName.value).toBe('Core-Router-01');
      expect(event.status.isInInventory()).toBe(true);
      expect(event.ownerType).toBe(DeviceOwnerType.COMPANY);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new DeviceCreatedEvent(makeEventProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate from external mutation of the original props object', () => {
      const props = makeEventProps({ aggregateId, dateTimeOccurred });
      const event = new DeviceCreatedEvent(props);

      (props as { ownerType: DeviceOwnerType }).ownerType =
        DeviceOwnerType.CLIENT;

      expect(event.ownerType).toBe(DeviceOwnerType.COMPANY);
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of props after construction', () => {
      const event = new DeviceCreatedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: { ownerType: DeviceOwnerType } }
        ).props.ownerType = DeviceOwnerType.CLIENT;
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new DeviceCreatedEvent(makeEventProps());

      expect(() => {
        (event as unknown as { props: Record<string, unknown> }).props.extra =
          'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new DeviceCreatedEvent(makeEventProps());

      expect(() => {
        delete (event as unknown as { props: Record<string, unknown> }).props
          .ownerType;
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the DeviceId provided at construction', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should be an instance of DeviceId', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(DeviceId);
    });

    it('should also be an instance of UniqueEntityID', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should be a Date instance', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(event.dateTimeOccurred);
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceName getter', () => {
    it('should return the DeviceName provided at construction', () => {
      const name = DeviceName.create('Edge-Switch-01').value;
      const event = new DeviceCreatedEvent(
        makeEventProps({ deviceName: name })
      );

      expect(event.deviceName).toBe(name);
    });

    it('should return the correct name value', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({
          deviceName: DeviceName.create('AP-Floor-2').value
        })
      );

      expect(event.deviceName.value).toBe('AP-Floor-2');
    });
  });

  // -------------------------------------------------------------------------
  describe('status getter', () => {
    it('should return the DeviceStatus provided at construction', () => {
      const status = DeviceStatus.createActive();
      const event = new DeviceCreatedEvent(
        makeEventProps({ status })
      );

      expect(event.status).toBe(status);
    });

    it('should reflect every valid status', () => {
      const statuses = [
        DeviceStatus.createActive(),
        DeviceStatus.createInventory(),
        DeviceStatus.createDamaged()
      ];

      for (const status of statuses) {
        const event = new DeviceCreatedEvent(makeEventProps({ status }));

        expect(event.status.value).toBe(status.value);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('ownerType getter', () => {
    it('should return COMPANY when set to COMPANY', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ ownerType: DeviceOwnerType.COMPANY })
      );

      expect(event.ownerType).toBe(DeviceOwnerType.COMPANY);
    });

    it('should return CLIENT when set to CLIENT', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ ownerType: DeviceOwnerType.CLIENT })
      );

      expect(event.ownerType).toBe(DeviceOwnerType.CLIENT);
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('DeviceCreatedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(
        dateTimeOccurred.toISOString()
      );
    });

    it('should return a consistent string across multiple calls', () => {
      const event = new DeviceCreatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toBe(event.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events', () => {
      const id1 = DeviceId.create();
      const id2 = DeviceId.create();
      const event1 = new DeviceCreatedEvent(
        makeEventProps({ aggregateId: id1, ownerType: DeviceOwnerType.COMPANY })
      );
      const event2 = new DeviceCreatedEvent(
        makeEventProps({ aggregateId: id2, ownerType: DeviceOwnerType.CLIENT })
      );

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.ownerType).not.toBe(event2.ownerType);
    });
  });
});
