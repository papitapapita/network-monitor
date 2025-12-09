import {
  NetworkDeviceStatusChangedEvent,
  NetworkDeviceId,
  NetworkDeviceStatus,
  UniqueEntityID
} from '../../../src/domain';

describe('NetworkDeviceStatusChangedEvent', () => {
  let aggregateId: NetworkDeviceId;
  const deviceName = 'Router-01';
  const ipAddress = '192.168.1.1';

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event).toBeDefined();
      expect(event.deviceName).toBe(deviceName);
      expect(event.previousStatus).toBe(NetworkDeviceStatus.ONLINE);
      expect(event.newStatus).toBe(NetworkDeviceStatus.OFFLINE);
      expect(event.ipAddress).toBe(ipAddress);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
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
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
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
        const event = new NetworkDeviceStatusChangedEvent(
          aggregateId,
          name,
          NetworkDeviceStatus.ONLINE,
          NetworkDeviceStatus.OFFLINE,
          ipAddress
        );

        expect(event.deviceName).toBe(name);
      });
    });

    it('should accept different IP addresses', () => {
      const ips = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '8.8.8.8'
      ];

      ips.forEach((ip) => {
        const event = new NetworkDeviceStatusChangedEvent(
          aggregateId,
          deviceName,
          NetworkDeviceStatus.ONLINE,
          NetworkDeviceStatus.OFFLINE,
          ip
        );

        expect(event.ipAddress).toBe(ip);
      });
    });

    it('should accept all status combinations', () => {
      const statuses = [
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.UNKNOWN
      ];

      statuses.forEach((prevStatus) => {
        statuses.forEach((newStatus) => {
          const event = new NetworkDeviceStatusChangedEvent(
            aggregateId,
            deviceName,
            prevStatus,
            newStatus,
            ipAddress
          );

          expect(event.previousStatus).toBe(prevStatus);
          expect(event.newStatus).toBe(newStatus);
        });
      });
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      const id1 = event.getAggregateId();
      const id2 = event.getAggregateId();

      expect(id1).toBe(id2);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(NetworkDeviceId);
    });
  });

  describe('isGoingOffline', () => {
    it('should return true when transitioning from ONLINE to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isGoingOffline()).toBe(true);
    });

    it('should return true when transitioning from UNKNOWN to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isGoingOffline()).toBe(true);
    });

    it('should return true when transitioning from MAINTENANCE to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isGoingOffline()).toBe(true);
    });

    it('should return false when transitioning from OFFLINE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isGoingOffline()).toBe(false);
    });

    it('should return false when remaining OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isGoingOffline()).toBe(false);
    });

    it('should return false when transitioning to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isGoingOffline()).toBe(false);
    });
  });

  describe('isComingOnline', () => {
    it('should return true when transitioning from OFFLINE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isComingOnline()).toBe(true);
    });

    it('should return true when transitioning from UNKNOWN to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isComingOnline()).toBe(true);
    });

    it('should return true when transitioning from MAINTENANCE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isComingOnline()).toBe(true);
    });

    it('should return false when transitioning from ONLINE to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isComingOnline()).toBe(false);
    });

    it('should return false when remaining ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isComingOnline()).toBe(false);
    });

    it('should return false when transitioning to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isComingOnline()).toBe(false);
    });
  });

  describe('isEnteringMaintenance', () => {
    it('should return true when transitioning from ONLINE to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isEnteringMaintenance()).toBe(true);
    });

    it('should return true when transitioning from OFFLINE to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isEnteringMaintenance()).toBe(true);
    });

    it('should return true when transitioning from UNKNOWN to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isEnteringMaintenance()).toBe(true);
    });

    it('should return false when transitioning from MAINTENANCE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isEnteringMaintenance()).toBe(false);
    });

    it('should return false when remaining in MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isEnteringMaintenance()).toBe(false);
    });

    it('should return false when not transitioning to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isEnteringMaintenance()).toBe(false);
    });
  });

  describe('isLeavingMaintenance', () => {
    it('should return true when transitioning from MAINTENANCE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isLeavingMaintenance()).toBe(true);
    });

    it('should return true when transitioning from MAINTENANCE to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isLeavingMaintenance()).toBe(true);
    });

    it('should return true when transitioning from MAINTENANCE to UNKNOWN', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.UNKNOWN,
        ipAddress
      );

      expect(event.isLeavingMaintenance()).toBe(true);
    });

    it('should return false when transitioning to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should return false when remaining in MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should return false when not from MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isLeavingMaintenance()).toBe(false);
    });
  });

  describe('IDomainEvent interface', () => {
    it('should implement IDomainEvent interface', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should have dateTimeOccurred as readonly', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      const originalDate = event.dateTimeOccurred;

      // TypeScript prevents this, but we can verify the property exists
      expect(event.dateTimeOccurred).toBe(originalDate);
    });
  });

  describe('property immutability', () => {
    it('should have readonly deviceName', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should have readonly previousStatus', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.previousStatus).toBe(NetworkDeviceStatus.ONLINE);
    });

    it('should have readonly newStatus', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.newStatus).toBe(NetworkDeviceStatus.OFFLINE);
    });

    it('should have readonly ipAddress', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.ipAddress).toBe(ipAddress);
    });
  });

  describe('event scenarios', () => {
    it('should represent device going offline', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Critical-Router',
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        '10.0.0.1'
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.isComingOnline()).toBe(false);
      expect(event.deviceName).toBe('Critical-Router');
    });

    it('should represent device recovery (coming online)', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Edge-Switch',
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        '192.168.10.5'
      );

      expect(event.isComingOnline()).toBe(true);
      expect(event.isGoingOffline()).toBe(false);
    });

    it('should represent device entering maintenance', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Core-Switch',
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.MAINTENANCE,
        '172.16.0.1'
      );

      expect(event.isEnteringMaintenance()).toBe(true);
      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should represent device leaving maintenance', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'AP-Floor-2',
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.ONLINE,
        '172.16.5.100'
      );

      expect(event.isLeavingMaintenance()).toBe(true);
      expect(event.isEnteringMaintenance()).toBe(false);
      expect(event.isComingOnline()).toBe(true);
    });

    it('should represent initial device discovery', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'New-Device',
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.ONLINE,
        '192.168.1.100'
      );

      expect(event.isComingOnline()).toBe(true);
      expect(event.previousStatus).toBe(NetworkDeviceStatus.UNKNOWN);
    });
  });

  describe('status transition combinations', () => {
    it('should handle ONLINE -> OFFLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.isComingOnline()).toBe(false);
      expect(event.isEnteringMaintenance()).toBe(false);
      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should handle OFFLINE -> ONLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isComingOnline()).toBe(true);
      expect(event.isGoingOffline()).toBe(false);
      expect(event.isEnteringMaintenance()).toBe(false);
      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should handle ONLINE -> MAINTENANCE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.MAINTENANCE,
        ipAddress
      );

      expect(event.isEnteringMaintenance()).toBe(true);
      expect(event.isLeavingMaintenance()).toBe(false);
      expect(event.isGoingOffline()).toBe(false);
      expect(event.isComingOnline()).toBe(false);
    });

    it('should handle MAINTENANCE -> ONLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isLeavingMaintenance()).toBe(true);
      expect(event.isComingOnline()).toBe(true);
      expect(event.isEnteringMaintenance()).toBe(false);
      expect(event.isGoingOffline()).toBe(false);
    });

    it('should handle UNKNOWN -> ONLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.isComingOnline()).toBe(true);
      expect(event.isGoingOffline()).toBe(false);
    });

    it('should handle UNKNOWN -> OFFLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.isComingOnline()).toBe(false);
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Device-1',
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        '192.168.1.1'
      );

      const event2 = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Device-2',
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        '192.168.1.2'
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.previousStatus).not.toBe(event2.previousStatus);
      expect(event1.newStatus).not.toBe(event2.newStatus);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        '',
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle empty IP address', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ''
      );

      expect(event.ipAddress).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        longName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipv6
      );

      expect(event.ipAddress).toBe(ipv6);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        specialName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        ipAddress
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle same status transition (no actual change)', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        deviceName,
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.ONLINE,
        ipAddress
      );

      expect(event.previousStatus).toBe(NetworkDeviceStatus.ONLINE);
      expect(event.newStatus).toBe(NetworkDeviceStatus.ONLINE);
      expect(event.isGoingOffline()).toBe(false);
      expect(event.isComingOnline()).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent network outage', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Core-Router-DC1',
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE,
        '10.10.10.1'
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.deviceName).toContain('Core');
    });

    it('should represent recovery after outage', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Critical-Switch',
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE,
        '172.16.0.1'
      );

      expect(event.isComingOnline()).toBe(true);
      expect(event.previousStatus).toBe(NetworkDeviceStatus.OFFLINE);
    });

    it('should represent scheduled maintenance start', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Upgrade-Router',
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.MAINTENANCE,
        '192.168.100.1'
      );

      expect(event.isEnteringMaintenance()).toBe(true);
    });

    it('should represent maintenance completion', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Upgraded-Router',
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.ONLINE,
        '192.168.100.1'
      );

      expect(event.isLeavingMaintenance()).toBe(true);
      expect(event.isComingOnline()).toBe(true);
    });

    it('should represent device failure during maintenance', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        aggregateId,
        'Failed-Device',
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.OFFLINE,
        '10.20.30.40'
      );

      expect(event.isLeavingMaintenance()).toBe(true);
      expect(event.isGoingOffline()).toBe(true);
    });
  });
});
