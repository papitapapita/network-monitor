import {
  PingCountChangedEvent,
  PingCountChangedEventProps,
  NetworkDeviceId,
  PollingConfigurationId
} from '../../../../src/domain/device-inventory';

describe('PingCountChangedEvent', () => {
  let aggregateId: NetworkDeviceId;
  let pollingConfigurationId: PollingConfigurationId;
  const deviceName = 'Router-01';
  const previousPingCount = 4;
  const newPingCount = 8;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
    pollingConfigurationId = PollingConfigurationId.create().value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<PingCountChangedEventProps>
  ): PingCountChangedEventProps => ({
    aggregateId,
    pollingConfigurationId,
    previousPingCount,
    newPingCount,
    deviceName,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event).toBeDefined();
      expect(event.pollingConfigurationId).toBe(
        pollingConfigurationId
      );
      expect(event.previousPingCount).toBe(previousPingCount);
      expect(event.newPingCount).toBe(newPingCount);
      expect(event.deviceName).toBe(deviceName);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new PingCountChangedEvent(props);

      // Modify original props object
      (props as any).deviceName = 'Modified';

      // Event should not be affected
      expect(event.deviceName).toBe(deviceName);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event.aggregateId).toBeInstanceOf(NetworkDeviceId);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new PingCountChangedEvent(createEventProps());

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  describe('property getters', () => {
    it('should return pollingConfigurationId', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event.pollingConfigurationId).toBe(
        pollingConfigurationId
      );
      expect(event.pollingConfigurationId).toBeInstanceOf(
        PollingConfigurationId
      );
    });

    it('should return previousPingCount', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event.previousPingCount).toBe(previousPingCount);
    });

    it('should return newPingCount', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event.newPingCount).toBe(newPingCount);
    });

    it('should return deviceName', () => {
      const event = new PingCountChangedEvent(createEventProps());

      expect(event.deviceName).toBe(deviceName);
    });
  });

  describe('getPingCountDelta', () => {
    it('should return positive delta when ping count increased', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 8
        })
      );

      expect(event.getPingCountDelta()).toBe(4);
    });

    it('should return negative delta when ping count decreased', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 8,
          newPingCount: 4
        })
      );

      expect(event.getPingCountDelta()).toBe(-4);
    });

    it('should return zero when ping counts are the same', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 4
        })
      );

      expect(event.getPingCountDelta()).toBe(0);
    });

    it('should calculate delta correctly for single ping increase', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 5
        })
      );

      expect(event.getPingCountDelta()).toBe(1);
    });

    it('should calculate delta correctly for single ping decrease', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 5,
          newPingCount: 4
        })
      );

      expect(event.getPingCountDelta()).toBe(-1);
    });

    it('should calculate delta correctly for maximum range', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 1,
          newPingCount: 10
        })
      );

      expect(event.getPingCountDelta()).toBe(9);
    });
  });

  describe('wasIncreased', () => {
    it('should return true when ping count was increased', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 8
        })
      );

      expect(event.wasIncreased()).toBe(true);
    });

    it('should return false when ping count was decreased', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 8,
          newPingCount: 4
        })
      );

      expect(event.wasIncreased()).toBe(false);
    });

    it('should return false when ping counts are the same', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 4
        })
      );

      expect(event.wasIncreased()).toBe(false);
    });

    it('should be mutually exclusive with wasDecreased when increased', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 8
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.wasDecreased()).toBe(false);
    });
  });

  describe('wasDecreased', () => {
    it('should return true when ping count was decreased', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 8,
          newPingCount: 4
        })
      );

      expect(event.wasDecreased()).toBe(true);
    });

    it('should return false when ping count was increased', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 8
        })
      );

      expect(event.wasDecreased()).toBe(false);
    });

    it('should return false when ping counts are the same', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 4
        })
      );

      expect(event.wasDecreased()).toBe(false);
    });

    it('should be mutually exclusive with wasIncreased when decreased', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 8,
          newPingCount: 4
        })
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.wasIncreased()).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new PingCountChangedEvent(createEventProps());

      const str = event.toString();

      expect(str).toContain('PingCountChangedEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should return consistent string on multiple calls', () => {
      const event = new PingCountChangedEvent(createEventProps());

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('edge cases', () => {
    it('should handle same ping count values (no change)', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 4
        })
      );

      expect(event.getPingCountDelta()).toBe(0);
      expect(event.wasIncreased()).toBe(false);
      expect(event.wasDecreased()).toBe(false);
    });

    it('should handle minimum ping count (1)', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 1
        })
      );

      expect(event.newPingCount).toBe(1);
      expect(event.wasDecreased()).toBe(true);
    });

    it('should handle maximum ping count (10)', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 10
        })
      );

      expect(event.newPingCount).toBe(10);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should handle empty device name', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          deviceName: ''
        })
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new PingCountChangedEvent(
        createEventProps({
          deviceName: longName
        })
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new PingCountChangedEvent(
        createEventProps({
          deviceName: specialName
        })
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle small increase', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 5
        })
      );

      expect(event.getPingCountDelta()).toBe(1);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should handle large increase', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 1,
          newPingCount: 10
        })
      );

      expect(event.getPingCountDelta()).toBe(9);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should handle small decrease', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 5,
          newPingCount: 4
        })
      );

      expect(event.getPingCountDelta()).toBe(-1);
      expect(event.wasDecreased()).toBe(true);
    });

    it('should handle large decrease', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 10,
          newPingCount: 1
        })
      );

      expect(event.getPingCountDelta()).toBe(-9);
      expect(event.wasDecreased()).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent increasing ping count for better accuracy', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 8,
          deviceName: 'Critical-Router'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(4);
      expect(event.deviceName).toBe('Critical-Router');
    });

    it('should represent decreasing ping count for faster polling', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 8,
          newPingCount: 2,
          deviceName: 'Edge-Switch'
        })
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(-6);
    });

    it('should represent setting minimum ping count', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 1,
          deviceName: 'Low-Priority-AP'
        })
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.newPingCount).toBe(1);
    });

    it('should represent setting maximum ping count', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 10,
          deviceName: 'High-Precision-Device'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.newPingCount).toBe(10);
    });

    it('should represent minor adjustment', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 5,
          deviceName: 'Standard-Device'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(1);
    });

    it('should represent optimization for critical device', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 10,
          deviceName: 'Core-Router-DC1'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(6);
      expect(event.deviceName).toContain('Core');
    });

    it('should represent reducing overhead for stable device', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 8,
          newPingCount: 2,
          deviceName: 'Stable-Switch'
        })
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(-6);
    });

    it('should represent standard configuration application', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 1,
          newPingCount: 4,
          deviceName: 'Standard-AP'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.newPingCount).toBe(4);
    });

    it('should represent troubleshooting configuration', () => {
      const event = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 10,
          deviceName: 'Problematic-Link'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.newPingCount).toBe(10);
      expect(event.deviceName).toContain('Problematic');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 4,
          newPingCount: 8,
          deviceName: 'Device-1'
        })
      );

      const event2 = new PingCountChangedEvent(
        createEventProps({
          previousPingCount: 2,
          newPingCount: 6,
          deviceName: 'Device-2'
        })
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.previousPingCount).not.toBe(
        event2.previousPingCount
      );
      expect(event1.newPingCount).not.toBe(event2.newPingCount);
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:01Z');

      const event1 = new PingCountChangedEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new PingCountChangedEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
