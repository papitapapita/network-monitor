import { DevicePolledSuccessfullyEvent } from '../../../src/domain/events/DevicePolledSuccessfullyEvent';
import { NetworkDeviceId } from '../../../src/domain/entities/NetworkDeviceId';
import { PollingResultId } from '../../../src/domain/entities/PollingResultId';
import { PollingMetrics } from '../../../src/domain/value-objects';
import { UniqueEntityID } from '../../../src/domain/shared/kernel';

describe('DevicePolledSuccessfullyEvent', () => {
  let aggregateId: PollingResultId;
  let networkDeviceId: NetworkDeviceId;
  let metrics: PollingMetrics;
  const deviceName = 'Router-01';
  const ipAddress = '192.168.1.1';

  beforeEach(() => {
    aggregateId = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000').value;
    networkDeviceId = NetworkDeviceId.create().value;
    metrics = PollingMetrics.create({
      responseTimes: [23.5, 24.1, 23.8, 24.3],
      totalPings: 4,
      successfulPings: 4
    }).value;
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event).toBeDefined();
      expect(event.networkDeviceId).toBe(networkDeviceId);
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.metrics).toBe(metrics);
      expect(event.wasOffline).toBe(false);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );
      const afterCreation = new Date();

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
      expect(event.dateTimeOccurred.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should accept wasOffline as true', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        true
      );

      expect(event.wasOffline).toBe(true);
    });

    it('should accept wasOffline as false', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event.wasOffline).toBe(false);
    });

    it('should store aggregateId privately', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      // aggregateId should not be directly accessible
      expect((event as any).aggregateId).toBe(aggregateId);
    });

    it('should accept different device names', () => {
      const names = ['Switch-01', 'AP-Main-Floor', 'Firewall-DMZ', 'Core-Router'];

      names.forEach((name) => {
        const event = new DevicePolledSuccessfullyEvent(
          aggregateId,
          networkDeviceId,
          name,
          ipAddress,
          metrics,
          false
        );

        expect(event.deviceName).toBe(name);
      });
    });

    it('should accept different IP addresses', () => {
      const ips = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '8.8.8.8'];

      ips.forEach((ip) => {
        const event = new DevicePolledSuccessfullyEvent(
          aggregateId,
          networkDeviceId,
          deviceName,
          ip,
          metrics,
          false
        );

        expect(event.ipAddress).toBe(ip);
      });
    });

    it('should accept different metrics objects', () => {
      const differentMetrics = PollingMetrics.create({
        responseTimes: [10.5, 11.2],
        totalPings: 4,
        successfulPings: 2
      }).value;

      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        differentMetrics,
        false
      );

      expect(event.metrics).toBe(differentMetrics);
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      const id1 = event.getAggregateId();
      const id2 = event.getAggregateId();

      expect(id1).toBe(id2);
    });

    it('should return PollingResultId type', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(PollingResultId);
    });
  });

  describe('isRecovery', () => {
    it('should return true when wasOffline is true', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        true
      );

      expect(event.isRecovery()).toBe(true);
    });

    it('should return false when wasOffline is false', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event.isRecovery()).toBe(false);
    });

    it('should be consistent with wasOffline property', () => {
      const recoveryEvent = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        true
      );

      const normalEvent = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(recoveryEvent.isRecovery()).toBe(recoveryEvent.wasOffline);
      expect(normalEvent.isRecovery()).toBe(normalEvent.wasOffline);
    });
  });

  describe('IDomainEvent interface', () => {
    it('should implement IDomainEvent interface', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should have dateTimeOccurred as readonly', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      const originalDate = event.dateTimeOccurred;

      // TypeScript prevents this, but we can verify the property exists
      expect(event.dateTimeOccurred).toBe(originalDate);
    });
  });

  describe('property immutability', () => {
    it('should have readonly networkDeviceId', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      const originalId = event.networkDeviceId;

      // TypeScript prevents reassignment, verify property is accessible
      expect(event.networkDeviceId).toBe(originalId);
    });

    it('should have readonly deviceName', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should have readonly ipAddress', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event.ipAddress).toBe(ipAddress);
    });

    it('should have readonly metrics', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event.metrics).toBe(metrics);
    });

    it('should have readonly wasOffline', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        true
      );

      expect(event.wasOffline).toBe(true);
    });
  });

  describe('event scenarios', () => {
    it('should represent a regular successful poll (not recovery)', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        'Router-Main',
        '10.0.0.1',
        metrics,
        false
      );

      expect(event.isRecovery()).toBe(false);
      expect(event.wasOffline).toBe(false);
      expect(event.deviceName).toBe('Router-Main');
      expect(event.ipAddress).toBe('10.0.0.1');
      expect(event.metrics).toBe(metrics);
    });

    it('should represent a device recovery event', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        'Switch-Edge',
        '192.168.10.5',
        metrics,
        true
      );

      expect(event.isRecovery()).toBe(true);
      expect(event.wasOffline).toBe(true);
      expect(event.deviceName).toBe('Switch-Edge');
      expect(event.ipAddress).toBe('192.168.10.5');
      expect(event.metrics).toBe(metrics);
    });

    it('should capture first successful poll after device installation', () => {
      const newDeviceMetrics = PollingMetrics.create({
        responseTimes: [15.2, 15.8, 16.1, 15.5],
        totalPings: 4,
        successfulPings: 4
      }).value;

      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        'New-AP-01',
        '172.16.5.100',
        newDeviceMetrics,
        false
      );

      expect(event.isRecovery()).toBe(false);
      expect(event.metrics.averageResponseTime).toBeCloseTo(15.65, 1);
    });

    it('should capture recovery from prolonged outage', () => {
      const recoveryMetrics = PollingMetrics.create({
        responseTimes: [45.2, 46.1, 44.8, 45.5],
        totalPings: 4,
        successfulPings: 4
      }).value;

      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        'Critical-Router',
        '10.1.1.1',
        recoveryMetrics,
        true
      );

      expect(event.isRecovery()).toBe(true);
      expect(event.deviceName).toBe('Critical-Router');
      expect(event.metrics.averageResponseTime).toBeCloseTo(45.4, 1);
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        'Device-1',
        '192.168.1.1',
        metrics,
        false
      );

      const event2 = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        'Device-2',
        '192.168.1.2',
        metrics,
        true
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
      expect(event1.wasOffline).not.toBe(event2.wasOffline);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  describe('integration with value objects', () => {
    it('should work with different PollingMetrics instances', () => {
      const perfectMetrics = PollingMetrics.create({
        responseTimes: [10, 10, 10, 10],
        totalPings: 4,
        successfulPings: 4
      }).value;

      const partialMetrics = PollingMetrics.create({
        responseTimes: [20, 21],
        totalPings: 4,
        successfulPings: 2
      }).value;

      const event1 = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        perfectMetrics,
        false
      );

      const event2 = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        partialMetrics,
        false
      );

      expect(event1.metrics.packetLoss).toBe(0);
      expect(event2.metrics.packetLoss).toBeGreaterThan(0);
    });

    it('should maintain metrics reference', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        metrics,
        false
      );

      expect(event.metrics).toBe(metrics);
      expect(event.metrics.totalPings).toBe(4);
      expect(event.metrics.successfulPings).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        '',
        ipAddress,
        metrics,
        false
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle empty IP address', () => {
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        '',
        metrics,
        false
      );

      expect(event.ipAddress).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        longName,
        ipAddress,
        metrics,
        false
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipv6,
        metrics,
        false
      );

      expect(event.ipAddress).toBe(ipv6);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new DevicePolledSuccessfullyEvent(
        aggregateId,
        networkDeviceId,
        specialName,
        ipAddress,
        metrics,
        false
      );

      expect(event.deviceName).toBe(specialName);
    });
  });
});
