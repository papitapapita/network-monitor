import {
  PollingIntervalChangedEvent,
  PollingIntervalChangedEventProps,
  NetworkDeviceId,
  PollingConfigurationId,
  PollingInterval
} from '../../../../src/domain/device-inventory';

describe('PollingIntervalChangedEvent', () => {
  let aggregateId: NetworkDeviceId;
  let pollingConfigurationId: PollingConfigurationId;
  let previousInterval: PollingInterval;
  let newInterval: PollingInterval;
  const deviceName = 'Router-01';
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = PollingConfigurationId.create().value;
    pollingConfigurationId = NetworkDeviceId.create().value;
    previousInterval = PollingInterval.create(60).value; // 1 minute
    newInterval = PollingInterval.create(120).value; // 2 minutes
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<PollingIntervalChangedEventProps>
  ): PollingIntervalChangedEventProps => ({
    aggregateId,
    pollingConfigurationId,
    previousInterval,
    newInterval,
    deviceName,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event).toBeDefined();
      expect(event.pollingConfigurationId).toBe(
        pollingConfigurationId
      );
      expect(event.previousInterval).toBe(previousInterval);
      expect(event.newInterval).toBe(newInterval);
      expect(event.deviceName).toBe(deviceName);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new PollingIntervalChangedEvent(props);

      // Modify original props object
      (props as any).deviceName = 'Modified';

      // Event should not be affected
      expect(event.deviceName).toBe(deviceName);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should return PollingConfigurationId type', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event.aggregateId).toBeInstanceOf(
        PollingConfigurationId
      );
    });

    it('should return the same ID on multiple calls', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  describe('property getters', () => {
    it('should return pollingConfigurationId', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event.pollingConfigurationId).toBe(
        pollingConfigurationId
      );
      expect(event.pollingConfigurationId).toBeInstanceOf(
        NetworkDeviceId
      );
    });

    it('should return previousInterval', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event.previousInterval).toBe(previousInterval);
      expect(event.previousInterval).toBeInstanceOf(PollingInterval);
    });

    it('should return newInterval', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event.newInterval).toBe(newInterval);
      expect(event.newInterval).toBeInstanceOf(PollingInterval);
    });

    it('should return deviceName', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      expect(event.deviceName).toBe(deviceName);
    });
  });

  describe('getIntervalChangeDelta', () => {
    it('should return positive delta when interval increased', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(120).value
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(60);
    });

    it('should return negative delta when interval decreased', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(120).value,
          newInterval: PollingInterval.create(60).value
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(-60);
    });

    it('should return zero when intervals are the same', () => {
      const sameInterval = PollingInterval.create(60).value;
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: sameInterval,
          newInterval: sameInterval
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(0);
    });

    it('should calculate delta correctly for large intervals', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(3600).value
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(3540);
    });

    it('should calculate correct delta for small changes', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(65).value
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(5);
    });
  });

  describe('wasIncreased', () => {
    it('should return true when interval was increased', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(120).value
        })
      );

      expect(event.wasIncreased()).toBe(true);
    });

    it('should return false when interval was decreased', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(120).value,
          newInterval: PollingInterval.create(60).value
        })
      );

      expect(event.wasIncreased()).toBe(false);
    });

    it('should return false when intervals are the same', () => {
      const sameInterval = PollingInterval.create(60).value;
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: sameInterval,
          newInterval: sameInterval
        })
      );

      expect(event.wasIncreased()).toBe(false);
    });

    it('should be mutually exclusive with wasDecreased when increased', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(120).value
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.wasDecreased()).toBe(false);
    });
  });

  describe('wasDecreased', () => {
    it('should return true when interval was decreased', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(120).value,
          newInterval: PollingInterval.create(60).value
        })
      );

      expect(event.wasDecreased()).toBe(true);
    });

    it('should return false when interval was increased', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(120).value
        })
      );

      expect(event.wasDecreased()).toBe(false);
    });

    it('should return false when intervals are the same', () => {
      const sameInterval = PollingInterval.create(60).value;
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: sameInterval,
          newInterval: sameInterval
        })
      );

      expect(event.wasDecreased()).toBe(false);
    });

    it('should be mutually exclusive with wasIncreased when decreased', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(120).value,
          newInterval: PollingInterval.create(60).value
        })
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.wasIncreased()).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      const str = event.toString();

      expect(str).toContain('PollingIntervalChangedEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should return consistent string on multiple calls', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps()
      );

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('edge cases', () => {
    it('should handle same interval values (no change)', () => {
      const sameInterval = PollingInterval.create(60).value;
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: sameInterval,
          newInterval: sameInterval
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(0);
      expect(event.wasIncreased()).toBe(false);
      expect(event.wasDecreased()).toBe(false);
    });

    it('should handle empty device name', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          deviceName: ''
        })
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          deviceName: longName
        })
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          deviceName: specialName
        })
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle minimum to maximum interval change', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(10).value,
          newInterval: PollingInterval.create(3600).value
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(3590);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should handle maximum to minimum interval change', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(3600).value,
          newInterval: PollingInterval.create(10).value
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(-3590);
      expect(event.wasDecreased()).toBe(true);
    });

    it('should handle large interval changes', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(30).value,
          newInterval: PollingInterval.create(3600).value
        })
      );

      expect(event.getIntervalChangeDelta()).toBe(3570);
      expect(event.wasIncreased()).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent increasing interval from 1 minute to 5 minutes', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(300).value,
          deviceName: 'Critical-Router'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(240);
      expect(event.deviceName).toBe('Critical-Router');
    });

    it('should represent decreasing interval from 5 minutes to 30 seconds', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(300).value,
          newInterval: PollingInterval.create(30).value,
          deviceName: 'Edge-Switch'
        })
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(-270);
    });

    it('should represent minor interval adjustment', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(90).value,
          deviceName: 'AP-Floor-1'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(30);
    });

    it('should represent major interval change for critical device', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(300).value,
          newInterval: PollingInterval.create(30).value,
          deviceName: 'Core-Switch'
        })
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(-270);
      expect(event.previousInterval.seconds).toBe(300);
      expect(event.newInterval.seconds).toBe(30);
    });

    it('should represent standard configuration for new device', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(300).value,
          newInterval: PollingInterval.create(60).value,
          deviceName: 'New-Access-Point'
        })
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.newInterval.seconds).toBe(60);
    });

    it('should represent increasing interval for stable device', () => {
      const event = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(300).value,
          deviceName: 'Stable-Device'
        })
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(240);
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(60).value,
          newInterval: PollingInterval.create(120).value,
          deviceName: 'Device-1'
        })
      );

      const event2 = new PollingIntervalChangedEvent(
        createEventProps({
          previousInterval: PollingInterval.create(30).value,
          newInterval: PollingInterval.create(60).value,
          deviceName: 'Device-2'
        })
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.previousInterval).not.toBe(
        event2.previousInterval
      );
      expect(event1.newInterval).not.toBe(event2.newInterval);
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:01Z');

      const event1 = new PollingIntervalChangedEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new PollingIntervalChangedEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
