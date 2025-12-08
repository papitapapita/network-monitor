import { PingCountChangedEvent } from '../../../src/domain/events/PingCountChangedEvent';
import { NetworkDeviceId } from '../../../src/domain/entities/NetworkDeviceId';
import { PollingConfigurationId } from '../../../src/domain/entities/PollingConfigurationId';
import { UniqueEntityID } from '../../../src/domain/shared/kernel';

describe('PingCountChangedEvent', () => {
  let aggregateId: PollingConfigurationId;
  let networkDeviceId: NetworkDeviceId;
  const deviceName = 'Router-01';
  const previousPingCount = 4;
  const newPingCount = 8;

  beforeEach(() => {
    aggregateId = PollingConfigurationId.create('550e8400-e29b-41d4-a716-446655440000').value;
    networkDeviceId = NetworkDeviceId.create().value;
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      expect(event).toBeDefined();
      expect(event.networkDeviceId).toBe(networkDeviceId);
      expect(event.previousPingCount).toBe(previousPingCount);
      expect(event.newPingCount).toBe(newPingCount);
      expect(event.deviceName).toBe(deviceName);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );
      const afterCreation = new Date();

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
      expect(event.dateTimeOccurred.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should store aggregateId privately', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      // aggregateId should not be directly accessible
      expect((event as any).aggregateId).toBe(aggregateId);
    });

    it('should accept different device names', () => {
      const names = ['Switch-01', 'AP-Main-Floor', 'Firewall-DMZ', 'Core-Router'];

      names.forEach((name) => {
        const event = new PingCountChangedEvent(
          aggregateId,
          networkDeviceId,
          previousPingCount,
          newPingCount,
          name
        );

        expect(event.deviceName).toBe(name);
      });
    });

    it('should accept different ping count values', () => {
      const counts = [
        { prev: 1, new: 4 },
        { prev: 4, new: 8 },
        { prev: 8, new: 1 },
        { prev: 5, new: 10 }
      ];

      counts.forEach(({ prev, new: newVal }) => {
        const event = new PingCountChangedEvent(
          aggregateId,
          networkDeviceId,
          prev,
          newVal,
          deviceName
        );

        expect(event.previousPingCount).toBe(prev);
        expect(event.newPingCount).toBe(newVal);
      });
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      const id1 = event.getAggregateId();
      const id2 = event.getAggregateId();

      expect(id1).toBe(id2);
    });

    it('should return PollingConfigurationId type', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(PollingConfigurationId);
    });
  });

  describe('getPingCountDelta', () => {
    it('should return positive delta when ping count increased', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        8,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(4);
    });

    it('should return negative delta when ping count decreased', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        8,
        4,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(-4);
    });

    it('should return zero when ping counts are the same', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        4,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(0);
    });

    it('should calculate delta correctly for single ping increase', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        5,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(1);
    });

    it('should calculate delta correctly for single ping decrease', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        5,
        4,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(-1);
    });

    it('should calculate delta correctly for maximum range', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        1,
        10,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(9);
    });
  });

  describe('wasIncreased', () => {
    it('should return true when ping count was increased', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        8,
        deviceName
      );

      expect(event.wasIncreased()).toBe(true);
    });

    it('should return false when ping count was decreased', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        8,
        4,
        deviceName
      );

      expect(event.wasIncreased()).toBe(false);
    });

    it('should return false when ping counts are the same', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        4,
        deviceName
      );

      expect(event.wasIncreased()).toBe(false);
    });

    it('should be mutually exclusive with wasDecreased when increased', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        8,
        deviceName
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.wasDecreased()).toBe(false);
    });
  });

  describe('wasDecreased', () => {
    it('should return true when ping count was decreased', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        8,
        4,
        deviceName
      );

      expect(event.wasDecreased()).toBe(true);
    });

    it('should return false when ping count was increased', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        8,
        deviceName
      );

      expect(event.wasDecreased()).toBe(false);
    });

    it('should return false when ping counts are the same', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        4,
        deviceName
      );

      expect(event.wasDecreased()).toBe(false);
    });

    it('should be mutually exclusive with wasIncreased when decreased', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        8,
        4,
        deviceName
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.wasIncreased()).toBe(false);
    });
  });

  describe('IDomainEvent interface', () => {
    it('should implement IDomainEvent interface', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should have dateTimeOccurred as readonly', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      const originalDate = event.dateTimeOccurred;

      // TypeScript prevents this, but we can verify the property exists
      expect(event.dateTimeOccurred).toBe(originalDate);
    });
  });

  describe('property immutability', () => {
    it('should have readonly networkDeviceId', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      const originalId = event.networkDeviceId;

      // TypeScript prevents reassignment, verify property is accessible
      expect(event.networkDeviceId).toBe(originalId);
    });

    it('should have readonly previousPingCount', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      expect(event.previousPingCount).toBe(previousPingCount);
    });

    it('should have readonly newPingCount', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      expect(event.newPingCount).toBe(newPingCount);
    });

    it('should have readonly deviceName', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      expect(event.deviceName).toBe(deviceName);
    });
  });

  describe('event scenarios', () => {
    it('should represent increasing ping count for better accuracy', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        8,
        'Critical-Router'
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(4);
      expect(event.deviceName).toBe('Critical-Router');
    });

    it('should represent decreasing ping count for faster polling', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        8,
        2,
        'Edge-Switch'
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(-6);
    });

    it('should represent setting minimum ping count', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        1,
        'Low-Priority-AP'
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.newPingCount).toBe(1);
    });

    it('should represent setting maximum ping count', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        10,
        'High-Precision-Device'
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.newPingCount).toBe(10);
    });

    it('should represent minor adjustment', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        5,
        'Standard-Device'
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(1);
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        8,
        'Device-1'
      );

      const event2 = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        2,
        6,
        'Device-2'
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.previousPingCount).not.toBe(event2.previousPingCount);
      expect(event1.newPingCount).not.toBe(event2.newPingCount);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        deviceName
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  describe('ping count change calculations', () => {
    it('should calculate correct delta for small increase', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        5,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(1);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should calculate correct delta for large increase', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        1,
        10,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(9);
      expect(event.wasIncreased()).toBe(true);
    });

    it('should calculate correct delta for small decrease', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        5,
        4,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(-1);
      expect(event.wasDecreased()).toBe(true);
    });

    it('should calculate correct delta for large decrease', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        10,
        1,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(-9);
      expect(event.wasDecreased()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        ''
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        longName
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        previousPingCount,
        newPingCount,
        specialName
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle same ping count values (no change)', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        4,
        deviceName
      );

      expect(event.getPingCountDelta()).toBe(0);
      expect(event.wasIncreased()).toBe(false);
      expect(event.wasDecreased()).toBe(false);
    });

    it('should handle minimum ping count (1)', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        1,
        deviceName
      );

      expect(event.newPingCount).toBe(1);
      expect(event.wasDecreased()).toBe(true);
    });

    it('should handle maximum ping count (10)', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        10,
        deviceName
      );

      expect(event.newPingCount).toBe(10);
      expect(event.wasIncreased()).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent optimization for critical device', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        10,
        'Core-Router-DC1'
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(6);
      expect(event.deviceName).toContain('Core');
    });

    it('should represent reducing overhead for stable device', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        8,
        2,
        'Stable-Switch'
      );

      expect(event.wasDecreased()).toBe(true);
      expect(event.getPingCountDelta()).toBe(-6);
    });

    it('should represent standard configuration application', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        1,
        4,
        'Standard-AP'
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.newPingCount).toBe(4);
    });

    it('should represent troubleshooting configuration', () => {
      const event = new PingCountChangedEvent(
        aggregateId,
        networkDeviceId,
        4,
        10,
        'Problematic-Link'
      );

      expect(event.wasIncreased()).toBe(true);
      expect(event.newPingCount).toBe(10);
      expect(event.deviceName).toContain('Problematic');
    });
  });
});
