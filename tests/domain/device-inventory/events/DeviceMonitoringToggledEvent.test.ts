// Source: src/domain/device-inventory/events/DeviceMonitoringToggledEvent.ts

import {
  DeviceMonitoringToggledEvent,
  DeviceMonitoringToggledEventProps,
  DeviceName
} from '../../../../src/domain/device-inventory';
import { DeviceId } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventProps(
  overrides?: Partial<DeviceMonitoringToggledEventProps>
): DeviceMonitoringToggledEventProps {
  return {
    aggregateId: DeviceId.create(),
    deviceName: DeviceName.create('Core-Router-01').value,
    monitoringEnabled: true,
    ipAddress: null,
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('DeviceMonitoringToggledEvent', () => {
  let aggregateId: DeviceId;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = DeviceId.create();
    dateTimeOccurred = new Date('2024-06-01T10:00:00Z');
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event when monitoring is enabled', () => {
      const props = makeEventProps({
        aggregateId,
        dateTimeOccurred,
        monitoringEnabled: true
      });
      const event = new DeviceMonitoringToggledEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceName.value).toBe('Core-Router-01');
      expect(event.monitoringEnabled).toBe(true);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should create an event when monitoring is disabled', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ monitoringEnabled: false })
      );

      expect(event.monitoringEnabled).toBe(false);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new DeviceMonitoringToggledEvent(makeEventProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate from external mutation of the original props object', () => {
      const props = makeEventProps({ monitoringEnabled: true });
      const event = new DeviceMonitoringToggledEvent(props);

      (props as { monitoringEnabled: boolean }).monitoringEnabled = false;

      expect(event.monitoringEnabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of props after construction', () => {
      const event = new DeviceMonitoringToggledEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: { monitoringEnabled: boolean } }
        ).props.monitoringEnabled = false;
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new DeviceMonitoringToggledEvent(makeEventProps());

      expect(() => {
        (event as unknown as { props: Record<string, unknown> }).props.extra =
          'value';
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the DeviceId provided at construction', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should be a Date instance', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceName getter', () => {
    it('should return the DeviceName provided at construction', () => {
      const name = DeviceName.create('AP-Rooftop-5').value;
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ deviceName: name })
      );

      expect(event.deviceName).toBe(name);
      expect(event.deviceName.value).toBe('AP-Rooftop-5');
    });
  });

  // -------------------------------------------------------------------------
  describe('monitoringEnabled getter', () => {
    it('should return true when monitoring was enabled', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ monitoringEnabled: true })
      );

      expect(event.monitoringEnabled).toBe(true);
    });

    it('should return false when monitoring was disabled', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ monitoringEnabled: false })
      );

      expect(event.monitoringEnabled).toBe(false);
    });

    it('should return the same value on repeated reads', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ monitoringEnabled: true })
      );

      expect(event.monitoringEnabled).toBe(event.monitoringEnabled);
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(
        'DeviceMonitoringToggledEvent'
      );
    });

    it('should contain the aggregate ID string value', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new DeviceMonitoringToggledEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(
        dateTimeOccurred.toISOString()
      );
    });

    it('should return a consistent string across multiple calls', () => {
      const event = new DeviceMonitoringToggledEvent(
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
      const event1 = new DeviceMonitoringToggledEvent(
        makeEventProps({ aggregateId: id1, monitoringEnabled: true })
      );
      const event2 = new DeviceMonitoringToggledEvent(
        makeEventProps({ aggregateId: id2, monitoringEnabled: false })
      );

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.monitoringEnabled).not.toBe(
        event2.monitoringEnabled
      );
    });

    it('should reflect different timestamps when created at different moments', () => {
      const earlier = new Date('2024-01-01T00:00:00Z');
      const later = new Date('2024-12-31T23:59:59Z');
      const event1 = new DeviceMonitoringToggledEvent(
        makeEventProps({ dateTimeOccurred: earlier })
      );
      const event2 = new DeviceMonitoringToggledEvent(
        makeEventProps({ dateTimeOccurred: later })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
