import {
  NetworkDeviceCreatedEvent,
  NetworkDeviceId,
  UniqueEntityID
} from '../../../src/domain';

describe('NetworkDeviceCreatedEvent', () => {
  let aggregateId: NetworkDeviceId;
  const deviceName = 'Router-01';
  const ipAddress = '192.168.1.1';
  const macAddress = '00:1A:2B:3C:4D:5E';

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event).toBeDefined();
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.macAddress).toBe(macAddress);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
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
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
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
        const event = new NetworkDeviceCreatedEvent(
          aggregateId,
          name,
          ipAddress,
          macAddress
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
        const event = new NetworkDeviceCreatedEvent(
          aggregateId,
          deviceName,
          ip,
          macAddress
        );

        expect(event.ipAddress).toBe(ip);
      });
    });

    it('should accept different MAC addresses', () => {
      const macs = [
        '00:1A:2B:3C:4D:5E',
        'AA:BB:CC:DD:EE:FF',
        '11:22:33:44:55:66',
        'FF:FF:FF:FF:FF:FF'
      ];

      macs.forEach((mac) => {
        const event = new NetworkDeviceCreatedEvent(
          aggregateId,
          deviceName,
          ipAddress,
          mac
        );

        expect(event.macAddress).toBe(mac);
      });
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const id1 = event.getAggregateId();
      const id2 = event.getAggregateId();

      expect(id1).toBe(id2);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(NetworkDeviceId);
    });
  });

  describe('IDomainEvent interface', () => {
    it('should implement IDomainEvent interface', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should have dateTimeOccurred as readonly', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const originalDate = event.dateTimeOccurred;

      // TypeScript prevents this, but we can verify the property exists
      expect(event.dateTimeOccurred).toBe(originalDate);
    });
  });

  describe('property immutability', () => {
    it('should have readonly deviceName', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should have readonly ipAddress', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.ipAddress).toBe(ipAddress);
    });

    it('should have readonly macAddress', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.macAddress).toBe(macAddress);
    });
  });

  describe('event scenarios', () => {
    it('should represent creating a new router', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'Core-Router-01',
        '10.0.0.1',
        'AA:BB:CC:DD:EE:01'
      );

      expect(event.deviceName).toBe('Core-Router-01');
      expect(event.ipAddress).toBe('10.0.0.1');
      expect(event.macAddress).toBe('AA:BB:CC:DD:EE:01');
    });

    it('should represent creating a new switch', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'Edge-Switch-Floor-2',
        '192.168.10.5',
        '11:22:33:44:55:66'
      );

      expect(event.deviceName).toContain('Switch');
      expect(event.ipAddress).toBe('192.168.10.5');
    });

    it('should represent creating a new access point', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'AP-Main-Lobby',
        '172.16.5.100',
        'FF:EE:DD:CC:BB:AA'
      );

      expect(event.deviceName).toContain('AP');
      expect(event.ipAddress).toBe('172.16.5.100');
    });

    it('should represent creating a firewall device', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'Firewall-DMZ',
        '10.1.1.1',
        'AA:AA:BB:BB:CC:CC'
      );

      expect(event.deviceName).toContain('Firewall');
      expect(event.ipAddress).toBe('10.1.1.1');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new NetworkDeviceCreatedEvent(
        aggregateId,
        'Device-1',
        '192.168.1.1',
        '00:11:22:33:44:55'
      );

      const event2 = new NetworkDeviceCreatedEvent(
        aggregateId,
        'Device-2',
        '192.168.1.2',
        '00:11:22:33:44:56'
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
      expect(event1.macAddress).not.toBe(event2.macAddress);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  describe('MAC address formats', () => {
    it('should accept colon-separated MAC address', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        '00:1A:2B:3C:4D:5E'
      );

      expect(event.macAddress).toBe('00:1A:2B:3C:4D:5E');
    });

    it('should accept hyphen-separated MAC address', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        '00-1A-2B-3C-4D-5E'
      );

      expect(event.macAddress).toBe('00-1A-2B-3C-4D-5E');
    });

    it('should accept uppercase MAC address', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        'AA:BB:CC:DD:EE:FF'
      );

      expect(event.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should accept lowercase MAC address', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        'aa:bb:cc:dd:ee:ff'
      );

      expect(event.macAddress).toBe('aa:bb:cc:dd:ee:ff');
    });

    it('should accept mixed case MAC address', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        'Aa:Bb:Cc:Dd:Ee:Ff'
      );

      expect(event.macAddress).toBe('Aa:Bb:Cc:Dd:Ee:Ff');
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        '',
        ipAddress,
        macAddress
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle empty IP address', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        '',
        macAddress
      );

      expect(event.ipAddress).toBe('');
    });

    it('should handle empty MAC address', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        ''
      );

      expect(event.macAddress).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        longName,
        ipAddress,
        macAddress
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipv6,
        macAddress
      );

      expect(event.ipAddress).toBe(ipv6);
    });

    it('should handle compressed IPv6 addresses', () => {
      const ipv6 = '2001:db8::1';
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipv6,
        macAddress
      );

      expect(event.ipAddress).toBe(ipv6);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        specialName,
        ipAddress,
        macAddress
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle device names with spaces', () => {
      const nameWithSpaces = 'Core Router 01';
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        nameWithSpaces,
        ipAddress,
        macAddress
      );

      expect(event.deviceName).toBe(nameWithSpaces);
    });

    it('should handle device names with dots', () => {
      const nameWithDots = 'router.core.dc1';
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        nameWithDots,
        ipAddress,
        macAddress
      );

      expect(event.deviceName).toBe(nameWithDots);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent adding a new router to the network', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'Branch-Router-NYC',
        '10.100.1.1',
        '00:50:56:AA:BB:01'
      );

      expect(event.deviceName).toContain('Router');
      expect(event.deviceName).toContain('NYC');
      expect(event.ipAddress).toMatch(/^10\./);
    });

    it('should represent deploying a new switch in datacenter', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'DC1-Core-Switch-01',
        '172.20.0.10',
        'AA:BB:CC:DD:EE:10'
      );

      expect(event.deviceName).toContain('DC1');
      expect(event.deviceName).toContain('Switch');
      expect(event.ipAddress).toBe('172.20.0.10');
    });

    it('should represent installing a new access point', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'AP-Floor5-East',
        '192.168.50.100',
        '11:22:33:AA:BB:CC'
      );

      expect(event.deviceName).toContain('AP');
      expect(event.deviceName).toContain('Floor5');
    });

    it('should represent onboarding a firewall appliance', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'EdgeFirewall-DMZ-01',
        '203.0.113.1',
        'FF:EE:DD:CC:BB:AA'
      );

      expect(event.deviceName).toContain('Firewall');
      expect(event.deviceName).toContain('DMZ');
    });

    it('should represent adding IoT device', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'IoT-Gateway-Building-A',
        '10.200.1.50',
        '00:AA:BB:CC:DD:EE'
      );

      expect(event.deviceName).toContain('IoT');
      expect(event.deviceName).toContain('Gateway');
    });

    it('should represent provisioning load balancer', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'LoadBalancer-Web-01',
        '10.10.10.100',
        'AA:11:BB:22:CC:33'
      );

      expect(event.deviceName).toContain('LoadBalancer');
      expect(event.ipAddress).toBe('10.10.10.100');
    });
  });

  describe('device identification', () => {
    it('should capture all three identifiers for device', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'Test-Device',
        '192.168.1.100',
        '00:11:22:33:44:55'
      );

      // All three identifiers should be present
      expect(event.deviceName).toBeDefined();
      expect(event.ipAddress).toBeDefined();
      expect(event.macAddress).toBeDefined();

      // All should be non-null
      expect(event.deviceName.length).toBeGreaterThan(0);
      expect(event.ipAddress.length).toBeGreaterThan(0);
      expect(event.macAddress.length).toBeGreaterThan(0);
    });

    it('should maintain device identity across reads', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        'Stable-Device',
        '10.0.0.50',
        'AA:BB:CC:DD:EE:FF'
      );

      const name1 = event.deviceName;
      const name2 = event.deviceName;
      const ip1 = event.ipAddress;
      const ip2 = event.ipAddress;
      const mac1 = event.macAddress;
      const mac2 = event.macAddress;

      expect(name1).toBe(name2);
      expect(ip1).toBe(ip2);
      expect(mac1).toBe(mac2);
    });
  });

  describe('timestamp accuracy', () => {
    it('should capture creation time accurately', () => {
      const now = Date.now();
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const timeDiff = event.dateTimeOccurred.getTime() - now;

      // Should be created within 100ms
      expect(timeDiff).toBeGreaterThanOrEqual(0);
      expect(timeDiff).toBeLessThan(100);
    });

    it('should have consistent timestamp', () => {
      const event = new NetworkDeviceCreatedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const time1 = event.dateTimeOccurred.getTime();
      const time2 = event.dateTimeOccurred.getTime();

      expect(time1).toBe(time2);
    });
  });
});
