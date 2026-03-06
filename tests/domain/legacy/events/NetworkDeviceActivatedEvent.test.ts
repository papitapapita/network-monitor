import {
  NetworkDeviceActivatedEvent,
  NetworkDeviceActivatedEventProps,
  NetworkDeviceId,
  UniqueEntityID,
  IPAddress,
  MACAddress
} from '../../../src/domain/device-inventory';

describe('NetworkDeviceActivatedEvent', () => {
  let aggregateId: NetworkDeviceId;
  const deviceName = 'Core-Router-01';
  let ipAddress: IPAddress;
  let macAddress: MACAddress;
  const activatedBy = 'admin-user-123';
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
    ipAddress = IPAddress.create('192.168.1.1').value;
    macAddress = MACAddress.create('00:1A:2B:3C:4D:5E').value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<NetworkDeviceActivatedEventProps>
  ): NetworkDeviceActivatedEventProps => ({
    aggregateId,
    deviceName,
    ipAddress,
    macAddress,
    activatedBy,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.macAddress).toBe(macAddress);
      expect(event.macAddress).toBeInstanceOf(MACAddress);
      expect(event.activatedBy).toBe(activatedBy);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new NetworkDeviceActivatedEvent(props);

      // Modify original props object
      (props as any).deviceName = 'Modified';

      // Event should not be affected
      expect(event.deviceName).toBe(deviceName);
    });

    it('should accept different device names', () => {
      const names = [
        'Router-Main',
        'Switch-Floor-3',
        'AP-Conference-Room',
        'Firewall-DMZ-01'
      ];

      names.forEach((name) => {
        const event = new NetworkDeviceActivatedEvent(
          createEventProps({ deviceName: name })
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
        const ipVO = IPAddress.create(ip).value;
        const event = new NetworkDeviceActivatedEvent(
          createEventProps({ ipAddress: ipVO })
        );

        expect(event.ipAddress).toBe(ipVO);
        expect(event.ipAddress.value).toBe(ip);
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
        const macVO = MACAddress.create(mac).value;
        const event = new NetworkDeviceActivatedEvent(
          createEventProps({ macAddress: macVO })
        );

        expect(event.macAddress).toBe(macVO);
        expect(event.macAddress.value).toBe(mac);
      });
    });

    it('should accept different activatedBy user IDs', () => {
      const userIds = [
        'user-123',
        'admin-456',
        'system:auto-activate',
        'tech-network-789'
      ];

      userIds.forEach((userId) => {
        const event = new NetworkDeviceActivatedEvent(
          createEventProps({ activatedBy: userId })
        );

        expect(event.activatedBy).toBe(userId);
      });
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('aggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(NetworkDeviceId);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same date on multiple calls', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const date1 = event.dateTimeOccurred;
      const date2 = event.dateTimeOccurred;

      expect(date1).toBe(date2);
    });
  });

  describe('property getters', () => {
    it('should return deviceName', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(event.deviceName).toBe(deviceName);
      expect(typeof event.deviceName).toBe('string');
    });

    it('should return ipAddress value object', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.ipAddress.value).toBe('192.168.1.1');
    });

    it('should return macAddress value object', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(event.macAddress).toBe(macAddress);
      expect(event.macAddress).toBeInstanceOf(MACAddress);
      expect(event.macAddress.value).toBe('00:1A:2B:3C:4D:5E');
    });

    it('should return activatedBy string', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      expect(event.activatedBy).toBe(activatedBy);
      expect(typeof event.activatedBy).toBe('string');
    });

    it('should return consistent values on multiple reads', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const name1 = event.deviceName;
      const name2 = event.deviceName;
      const ip1 = event.ipAddress;
      const ip2 = event.ipAddress;
      const mac1 = event.macAddress;
      const mac2 = event.macAddress;
      const user1 = event.activatedBy;
      const user2 = event.activatedBy;

      expect(name1).toBe(name2);
      expect(ip1).toBe(ip2);
      expect(mac1).toBe(mac2);
      expect(user1).toBe(user2);
    });
  });

  describe('getActivationMessage', () => {
    it('should return formatted activation message', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const message = event.getActivationMessage();

      expect(message).toContain('Core-Router-01');
      expect(message).toContain('192.168.1.1');
      expect(message).toContain('admin-user-123');
      expect(message).toContain('activated');
    });

    it('should include device name in single quotes', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const message = event.getActivationMessage();

      expect(message).toMatch(/'Core-Router-01'/);
    });

    it('should include IP address in parentheses', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const message = event.getActivationMessage();

      expect(message).toMatch(/\(192\.168\.1\.1\)/);
    });

    it('should include activatedBy user at the end', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const message = event.getActivationMessage();

      expect(message).toMatch(/by admin-user-123$/);
    });

    it('should return consistent message on multiple calls', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const message1 = event.getActivationMessage();
      const message2 = event.getActivationMessage();

      expect(message1).toBe(message2);
    });

    it('should handle different device names in message', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ deviceName: 'Switch-Main-Floor-3' })
      );

      const message = event.getActivationMessage();

      expect(message).toContain('Switch-Main-Floor-3');
    });

    it('should handle different IP addresses in message', () => {
      const ip = IPAddress.create('10.0.0.1').value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ ipAddress: ip })
      );

      const message = event.getActivationMessage();

      expect(message).toContain('10.0.0.1');
    });

    it('should handle different user IDs in message', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ activatedBy: 'system:auto-activate' })
      );

      const message = event.getActivationMessage();

      expect(message).toContain('system:auto-activate');
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const str = event.toString();

      expect(str).toContain('NetworkDeviceActivatedEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should include event name in string', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const str = event.toString();

      expect(str).toMatch(/NetworkDeviceActivatedEvent/);
    });

    it('should return consistent string on multiple calls', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps()
      );

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('value object integration', () => {
    it('should work with IPv4 addresses', () => {
      const ipv4 = IPAddress.create('10.0.0.1').value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ ipAddress: ipv4 })
      );

      expect(event.ipAddress).toBe(ipv4);
      expect(event.ipAddress.isIPv4()).toBe(true);
      expect(event.ipAddress.value).toBe('10.0.0.1');
    });

    it('should work with IPv6 addresses', () => {
      const ipv6 = IPAddress.create(
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      ).value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
      expect(event.ipAddress.isIPv6()).toBe(true);
      expect(event.ipAddress.value).toBe(
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      );
    });

    it('should work with compressed IPv6 addresses', () => {
      const ipv6 = IPAddress.create('2001:db8::1').value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
      expect(event.ipAddress.isIPv6()).toBe(true);
      expect(event.ipAddress.value).toBe('2001:db8::1');
    });

    it('should normalize MAC address format', () => {
      const macWithHyphens = MACAddress.create(
        'aa-bb-cc-dd-ee-ff'
      ).value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ macAddress: macWithHyphens })
      );

      expect(event.macAddress).toBe(macWithHyphens);
      expect(event.macAddress.value).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should normalize lowercase MAC to uppercase', () => {
      const macLowercase = MACAddress.create(
        'aa:bb:cc:dd:ee:ff'
      ).value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ macAddress: macLowercase })
      );

      expect(event.macAddress).toBe(macLowercase);
      expect(event.macAddress.value).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ deviceName: longName })
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({ deviceName: specialName })
      );

      expect(event.deviceName).toBe(specialName);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent activating a discovered router', () => {
      const routerIP = IPAddress.create('10.100.1.1').value;
      const routerMAC = MACAddress.create('00:50:56:AA:BB:01').value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({
          deviceName: 'Branch-Router-NYC',
          ipAddress: routerIP,
          macAddress: routerMAC,
          activatedBy: 'admin-network-team'
        })
      );

      expect(event.deviceName).toContain('Router');
      expect(event.deviceName).toContain('NYC');
      const message = event.getActivationMessage();
      expect(message).toContain('Branch-Router-NYC');
      expect(message).toContain('10.100.1.1');
      expect(message).toContain('admin-network-team');
    });

    it('should represent activating a switch in datacenter', () => {
      const switchIP = IPAddress.create('172.20.0.10').value;
      const switchMAC = MACAddress.create('AA:BB:CC:DD:EE:10').value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({
          deviceName: 'DC1-Core-Switch-01',
          ipAddress: switchIP,
          macAddress: switchMAC,
          activatedBy: 'system:bulk-import'
        })
      );

      expect(event.deviceName).toContain('DC1');
      expect(event.deviceName).toContain('Switch');
      expect(event.activatedBy).toBe('system:bulk-import');
      expect(event.ipAddress.value).toBe('172.20.0.10');
    });

    it('should represent activating an access point', () => {
      const apIP = IPAddress.create('192.168.50.100').value;
      const apMAC = MACAddress.create('11:22:33:AA:BB:CC').value;
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({
          deviceName: 'AP-Floor5-East',
          ipAddress: apIP,
          macAddress: apMAC,
          activatedBy: 'tech-wireless-123'
        })
      );

      expect(event.deviceName).toContain('AP');
      expect(event.deviceName).toContain('Floor5');
      const message = event.getActivationMessage();
      expect(message).toContain('AP-Floor5-East');
      expect(message).toContain('192.168.50.100');
      expect(message).toContain('tech-wireless-123');
    });

    it('should represent auto-activation by system', () => {
      const event = new NetworkDeviceActivatedEvent(
        createEventProps({
          deviceName: 'Auto-Discovered-Device-01',
          activatedBy: 'system:auto-discovery'
        })
      );

      expect(event.activatedBy).toContain('system');
      const message = event.getActivationMessage();
      expect(message).toContain('system:auto-discovery');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const mac1 = MACAddress.create('00:11:22:33:44:55').value;
      const event1 = new NetworkDeviceActivatedEvent(
        createEventProps({
          deviceName: 'Device-1',
          ipAddress: ip1,
          macAddress: mac1,
          activatedBy: 'user-1'
        })
      );

      const ip2 = IPAddress.create('192.168.1.2').value;
      const mac2 = MACAddress.create('00:11:22:33:44:56').value;
      const event2 = new NetworkDeviceActivatedEvent(
        createEventProps({
          deviceName: 'Device-2',
          ipAddress: ip2,
          macAddress: mac2,
          activatedBy: 'user-2'
        })
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
      expect(event1.macAddress).not.toBe(event2.macAddress);
      expect(event1.activatedBy).not.toBe(event2.activatedBy);
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:01Z');

      const event1 = new NetworkDeviceActivatedEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new NetworkDeviceActivatedEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
