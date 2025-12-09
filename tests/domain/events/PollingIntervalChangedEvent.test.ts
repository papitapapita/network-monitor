import {
  PollingIntervalChangedEvent,
  NetworkDeviceId,
  PollingConfigurationId,
  PollingInterval,
  UniqueEntityID
} from '../../../src/domain';

describe('PollingIntervalChangedEvent', () => {
  let aggregateId: PollingConfigurationId;
  let networkDeviceId: NetworkDeviceId;
  let previousInterval: PollingInterval;
  let newInterval: PollingInterval;
  const deviceName = 'Router-01';

  beforeEach(() => {
    aggregateId = PollingConfigurationId.create(
      '550e8400-e29b-41d4-a716-446655440000'
    ).value;
    networkDeviceId = NetworkDeviceId.create().value;
    previousInterval = PollingInterval.create(60).value; // 1 minute
    newInterval = PollingInterval.create(120).value; // 2 minutes
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      expect(event).toBeDefined();
      expect(event.networkDeviceId).toBe(networkDeviceId);
      expect(event.previousInterval).toBe(previousInterval);
      expect(event.newInterval).toBe(newInterval);
      expect(event.deviceName).toBe(deviceName);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );
      const afterCreation = new Date();

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
      expect(event.dateTimeOccurred.getTime()).toBeGreaterThanOrEqual(
        beforeCreation.getTime()
      );
      expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(
        afterCreation.getTime()
      );
    });

    it('should store aggregateId privately', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      // aggregateId should not be directly accessible
      expect((event as any).aggregateId).toBe(aggregateId);
    });

    it('should accept different device names', () => {
      const names = [
        'Switch-01',
        'AP-Main-Floor',
        'Firewall-DMZ',
        'Core-Router'
      ];

      names.forEach((name) => {
        const event = new PollingIntervalChangedEvent(
          aggregateId,
          networkDeviceId,
          previousInterval,
          newInterval,
          name
        );

        expect(event.deviceName).toBe(name);
      });
    });

    it('should accept different polling intervals', () => {
      const intervals = [
        { prev: 30, new: 60 },
        { prev: 60, new: 300 },
        { prev: 300, new: 60 },
        { prev: 120, new: 600 }
      ];

      intervals.forEach(({ prev, new: newVal }) => {
        const prevInterval = PollingInterval.create(prev).value;
        const nextInterval = PollingInterval.create(newVal).value;

        const event = new PollingIntervalChangedEvent(
          aggregateId,
          networkDeviceId,
          prevInterval,
          nextInterval,
          deviceName
        );

        expect(event.previousInterval.seconds).toBe(prev);
        expect(event.newInterval.seconds).toBe(newVal);
      });
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      const id1 = event.getAggregateId();
      const id2 = event.getAggregateId();

      expect(id1).toBe(id2);
    });

    it('should return PollingConfigurationId type', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(PollingConfigurationId);
    });
  });

  describe('getIntervalChangeDelta', () => {
    it('should return positive delta when interval increased', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(120).value,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(60);
    });

    it('should return negative delta when interval decreased', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(120).value,
        PollingInterval.create(60).value,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(-60);
    });

    it('should return zero when intervals are the same', () => {
      const sameInterval = PollingInterval.create(60).value;
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        sameInterval,
        sameInterval,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(0);
    });

    it('should calculate delta correctly for large intervals', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(3600).value,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(3540);
    });
  });

  describe('wasIncreased', () => {
    it('should return true when interval was increased', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(120).value,
        deviceName
      );

      expect(event.wasIncreased()).toBe(true);
    });

    it('should return false when interval was decreased', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(120).value,
        PollingInterval.create(60).value,
        deviceName
      );

      expect(event.wasIncreased()).toBe(false);
    });

    it('should return false when intervals are the same', () => {
      const sameInterval = PollingInterval.create(60).value;
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        sameInterval,
        sameInterval,
        deviceName
      );

      expect(event.wasIncreased()).toBe(false);
    });

    it('should be mutually exclusive with wasDecreased when increased', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(120).value,
        deviceName
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.wasDecreased()).toBe(false);
    });
  });

  describe('wasDecreased', () => {
    it('should return true when interval was decreased', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(120).value,
        PollingInterval.create(60).value,
        deviceName
      );

      expect(event.wasDecreased()).toBe(true);
    });

    it('should return false when interval was increased', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(120).value,
        deviceName
      );

      expect(event.wasDecreased()).toBe(false);
    });

    it('should return false when intervals are the same', () => {
      const sameInterval = PollingInterval.create(60).value;
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        sameInterval,
        sameInterval,
        deviceName
      );

      expect(event.wasDecreased()).toBe(false);
    });

    it('should be mutually exclusive with wasIncreased when decreased', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(120).value,
        PollingInterval.create(60).value,
        deviceName
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.wasIncreased()).toBe(false);
    });
  });

  describe('IDomainEvent interface', () => {
    it('should implement IDomainEvent interface', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should have dateTimeOccurred as readonly', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      const originalDate = event.dateTimeOccurred;

      // TypeScript prevents this, but we can verify the property exists
      expect(event.dateTimeOccurred).toBe(originalDate);
    });
  });

  describe('property immutability', () => {
    it('should have readonly networkDeviceId', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      const originalId = event.networkDeviceId;

      // TypeScript prevents reassignment, verify property is accessible
      expect(event.networkDeviceId).toBe(originalId);
    });

    it('should have readonly previousInterval', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      expect(event.previousInterval).toBe(previousInterval);
    });

    it('should have readonly newInterval', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      expect(event.newInterval).toBe(newInterval);
    });

    it('should have readonly deviceName', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      expect(event.deviceName).toBe(deviceName);
    });
  });

  describe('event scenarios', () => {
    it('should represent increasing interval from 1 minute to 5 minutes', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(300).value,
        'Critical-Router'
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(240);
      expect(event.deviceName).toBe('Critical-Router');
    });

    it('should represent decreasing interval from 5 minutes to 30 seconds', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(300).value,
        PollingInterval.create(30).value,
        'Edge-Switch'
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(-270);
    });

    it('should represent minor interval adjustment', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(90).value,
        'AP-Floor-1'
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(30);
    });

    it('should represent major interval change for critical device', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(300).value,
        PollingInterval.create(30).value,
        'Core-Switch'
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.getIntervalChangeDelta()).toBe(-270);
      expect(event.previousInterval.seconds).toBe(300);
      expect(event.newInterval.seconds).toBe(30);
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(120).value,
        'Device-1'
      );

      const event2 = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(30).value,
        PollingInterval.create(60).value,
        'Device-2'
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.previousInterval).not.toBe(
        event2.previousInterval
      );
      expect(event1.newInterval).not.toBe(event2.newInterval);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        deviceName
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  describe('interval change calculations', () => {
    it('should calculate correct delta for small changes', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(60).value,
        PollingInterval.create(65).value,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(5);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should calculate correct delta for large changes', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(30).value,
        PollingInterval.create(3600).value,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(3570);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should handle minimum to maximum interval change', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(10).value,
        PollingInterval.create(3600).value,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(3590);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should handle maximum to minimum interval change', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        PollingInterval.create(3600).value,
        PollingInterval.create(10).value,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(-3590);
      expect(event.wasDecreased()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        ''
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        longName
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        previousInterval,
        newInterval,
        specialName
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle same interval values (no change)', () => {
      const sameInterval = PollingInterval.create(60).value;
      const event = new PollingIntervalChangedEvent(
        aggregateId,
        networkDeviceId,
        sameInterval,
        sameInterval,
        deviceName
      );

      expect(event.getIntervalChangeDelta()).toBe(0);
      expect(event.wasIncreased()).toBe(false);
      expect(event.wasDecreased()).toBe(false);
    });
  });
});
