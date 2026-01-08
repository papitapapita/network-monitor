import {
  NetworkDeviceRestoredEvent,
  NetworkDeviceRestoredEventProps,
  NetworkDeviceId,
  UniqueEntityID,
  IPAddress
} from '../../../src/domain';

describe('NetworkDeviceRestoredEvent', () => {
  let aggregateId: NetworkDeviceId;
  const deviceName = 'Core-Router-01';
  let ipAddress: IPAddress;
  const restoredBy = 'admin-user-123';
  let deletedAt: Date;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
    ipAddress = IPAddress.create('192.168.1.1').value;
    deletedAt = new Date('2024-01-01T10:00:00Z');
    dateTimeOccurred = new Date('2024-01-03T15:30:00Z'); // 2 days later
  });

  const createEventProps = (
    overrides?: Partial<NetworkDeviceRestoredEventProps>
  ): NetworkDeviceRestoredEventProps => ({
    aggregateId,
    deviceName,
    ipAddress,
    restoredBy,
    deletedAt,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.restoredBy).toBe(restoredBy);
      expect(event.deletedAt).toBe(deletedAt);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new NetworkDeviceRestoredEvent(props);

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
        const event = new NetworkDeviceRestoredEvent(
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
        const event = new NetworkDeviceRestoredEvent(
          createEventProps({ ipAddress: ipVO })
        );

        expect(event.ipAddress).toBe(ipVO);
        expect(event.ipAddress.value).toBe(ip);
      });
    });

    it('should accept different restoredBy user IDs', () => {
      const userIds = [
        'user-123',
        'admin-456',
        'system:auto-restore',
        'tech-network-789'
      ];

      userIds.forEach((userId) => {
        const event = new NetworkDeviceRestoredEvent(
          createEventProps({ restoredBy: userId })
        );

        expect(event.restoredBy).toBe(userId);
      });
    });

    it('should accept different deletion timestamps', () => {
      const deletionDates = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-05T12:00:00Z'),
        new Date('2024-01-10T23:59:59Z')
      ];

      deletionDates.forEach((delDate) => {
        const event = new NetworkDeviceRestoredEvent(
          createEventProps({ deletedAt: delDate })
        );

        expect(event.deletedAt).toBe(delDate);
      });
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('aggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(NetworkDeviceId);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same date on multiple calls', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const date1 = event.dateTimeOccurred;
      const date2 = event.dateTimeOccurred;

      expect(date1).toBe(date2);
    });
  });

  describe('property getters', () => {
    it('should return deviceName', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(event.deviceName).toBe(deviceName);
      expect(typeof event.deviceName).toBe('string');
    });

    it('should return ipAddress value object', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.ipAddress.value).toBe('192.168.1.1');
    });

    it('should return restoredBy string', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(event.restoredBy).toBe(restoredBy);
      expect(typeof event.restoredBy).toBe('string');
    });

    it('should return deletedAt Date', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      expect(event.deletedAt).toBe(deletedAt);
      expect(event.deletedAt).toBeInstanceOf(Date);
    });

    it('should return consistent values on multiple reads', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const name1 = event.deviceName;
      const name2 = event.deviceName;
      const ip1 = event.ipAddress;
      const ip2 = event.ipAddress;
      const user1 = event.restoredBy;
      const user2 = event.restoredBy;
      const del1 = event.deletedAt;
      const del2 = event.deletedAt;

      expect(name1).toBe(name2);
      expect(ip1).toBe(ip2);
      expect(user1).toBe(user2);
      expect(del1).toBe(del2);
    });
  });

  describe('getRestorationMessage', () => {
    it('should return formatted restoration message', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const message = event.getRestorationMessage();

      expect(message).toContain('Core-Router-01');
      expect(message).toContain('192.168.1.1');
      expect(message).toContain('admin-user-123');
      expect(message).toContain('restored');
      expect(message).toContain('days');
    });

    it('should include device name in single quotes', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const message = event.getRestorationMessage();

      expect(message).toMatch(/'Core-Router-01'/);
    });

    it('should include IP address in parentheses', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const message = event.getRestorationMessage();

      expect(message).toMatch(/\(192\.168\.1\.1\)/);
    });

    it('should include number of days deleted', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const message = event.getRestorationMessage();
      const days = event.getDaysDeleted();

      expect(message).toContain(`after ${days} days`);
    });

    it('should return consistent message on multiple calls', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const message1 = event.getRestorationMessage();
      const message2 = event.getRestorationMessage();

      expect(message1).toBe(message2);
    });

    it('should handle different device names in message', () => {
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({ deviceName: 'Switch-Main-Floor-3' })
      );

      const message = event.getRestorationMessage();

      expect(message).toContain('Switch-Main-Floor-3');
    });

    it('should handle different IP addresses in message', () => {
      const ip = IPAddress.create('10.0.0.1').value;
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({ ipAddress: ip })
      );

      const message = event.getRestorationMessage();

      expect(message).toContain('10.0.0.1');
    });

    it('should handle different user IDs in message', () => {
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({ restoredBy: 'system:auto-restore' })
      );

      const message = event.getRestorationMessage();

      expect(message).toContain('system:auto-restore');
    });
  });

  describe('getDaysDeleted', () => {
    it('should calculate days between deletedAt and dateTimeOccurred', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const days = event.getDaysDeleted();

      expect(days).toBe(2); // 2 days between Jan 1 and Jan 3
    });

    it('should return 0 for same-day restoration', () => {
      const sameDate = new Date('2024-01-01T10:00:00Z');
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({
          deletedAt: sameDate,
          dateTimeOccurred: new Date('2024-01-01T15:00:00Z')
        })
      );

      const days = event.getDaysDeleted();

      expect(days).toBe(0);
    });

    it('should floor fractional days', () => {
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({
          deletedAt: new Date('2024-01-01T10:00:00Z'),
          dateTimeOccurred: new Date('2024-01-03T09:00:00Z') // 1 day, 23 hours
        })
      );

      const days = event.getDaysDeleted();

      expect(days).toBe(1); // Should floor to 1 day
    });

    it('should handle week-long deletions', () => {
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({
          deletedAt: new Date('2024-01-01T00:00:00Z'),
          dateTimeOccurred: new Date('2024-01-08T00:00:00Z')
        })
      );

      const days = event.getDaysDeleted();

      expect(days).toBe(7);
    });

    it('should return consistent value on multiple calls', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const days1 = event.getDaysDeleted();
      const days2 = event.getDaysDeleted();

      expect(days1).toBe(days2);
    });
  });

  describe('isWithinGracePeriod', () => {
    it('should return true for restoration within 7 days', () => {
      const testCases = [
        { days: 0 },
        { days: 1 },
        { days: 3 },
        { days: 5 },
        { days: 7 }
      ];

      testCases.forEach((testCase) => {
        const deletionDate = new Date('2024-01-01T00:00:00Z');
        const restorationDate = new Date(deletionDate);
        restorationDate.setDate(restorationDate.getDate() + testCase.days);

        const event = new NetworkDeviceRestoredEvent(
          createEventProps({
            deletedAt: deletionDate,
            dateTimeOccurred: restorationDate
          })
        );

        expect(event.isWithinGracePeriod()).toBe(true);
      });
    });

    it('should return false for restoration after 7 days', () => {
      const testCases = [
        { days: 8 },
        { days: 10 },
        { days: 30 }
      ];

      testCases.forEach((testCase) => {
        const deletionDate = new Date('2024-01-01T00:00:00Z');
        const restorationDate = new Date(deletionDate);
        restorationDate.setDate(restorationDate.getDate() + testCase.days);

        const event = new NetworkDeviceRestoredEvent(
          createEventProps({
            deletedAt: deletionDate,
            dateTimeOccurred: restorationDate
          })
        );

        expect(event.isWithinGracePeriod()).toBe(false);
      });
    });

    it('should return true for restoration exactly on day 7', () => {
      const deletionDate = new Date('2024-01-01T10:00:00Z');
      const restorationDate = new Date('2024-01-08T10:00:00Z');

      const event = new NetworkDeviceRestoredEvent(
        createEventProps({
          deletedAt: deletionDate,
          dateTimeOccurred: restorationDate
        })
      );

      expect(event.isWithinGracePeriod()).toBe(true);
    });

    it('should return consistent value on multiple calls', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const result1 = event.isWithinGracePeriod();
      const result2 = event.isWithinGracePeriod();

      expect(result1).toBe(result2);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const str = event.toString();

      expect(str).toContain('NetworkDeviceRestoredEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should include event name in string', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const str = event.toString();

      expect(str).toMatch(/NetworkDeviceRestoredEvent/);
    });

    it('should return consistent string on multiple calls', () => {
      const event = new NetworkDeviceRestoredEvent(createEventProps());

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('value object integration', () => {
    it('should work with IPv4 addresses', () => {
      const ipv4 = IPAddress.create('10.0.0.1').value;
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({ ipAddress: ipv4 })
      );

      expect(event.ipAddress).toBe(ipv4);
      expect(event.ipAddress.isIPv4()).toBe(true);
      expect(event.ipAddress.value).toBe('10.0.0.1');
    });

    it('should work with IPv6 addresses', () => {
      const ipv6 = IPAddress.create('2001:0db8:85a3:0000:0000:8a2e:0370:7334').value;
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
      expect(event.ipAddress.isIPv6()).toBe(true);
      expect(event.ipAddress.value).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('should work with compressed IPv6 addresses', () => {
      const ipv6 = IPAddress.create('2001:db8::1').value;
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
      expect(event.ipAddress.isIPv6()).toBe(true);
      expect(event.ipAddress.value).toBe('2001:db8::1');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({ deviceName: longName })
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new NetworkDeviceRestoredEvent(
        createEventProps({ deviceName: specialName })
      );

      expect(event.deviceName).toBe(specialName);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent accidental deletion recovery within hours', () => {
      const deletionDate = new Date('2024-01-15T09:00:00Z');
      const restorationDate = new Date('2024-01-15T10:30:00Z'); // 1.5 hours later
      const routerIP = IPAddress.create('10.100.1.1').value;

      const event = new NetworkDeviceRestoredEvent(
        createEventProps({
          deviceName: 'Branch-Router-NYC',
          ipAddress: routerIP,
          deletedAt: deletionDate,
          dateTimeOccurred: restorationDate,
          restoredBy: 'admin-ops-team'
        })
      );

      expect(event.getDaysDeleted()).toBe(0);
      expect(event.isWithinGracePeriod()).toBe(true);
      const message = event.getRestorationMessage();
      expect(message).toContain('Branch-Router-NYC');
      expect(message).toContain('0 days');
    });

    it('should represent restoration near end of grace period', () => {
      const deletionDate = new Date('2024-01-01T00:00:00Z');
      const restorationDate = new Date('2024-01-07T23:00:00Z'); // Almost 7 days
      const switchIP = IPAddress.create('172.20.0.10').value;

      const event = new NetworkDeviceRestoredEvent(
        createEventProps({
          deviceName: 'DC1-Core-Switch-01',
          ipAddress: switchIP,
          deletedAt: deletionDate,
          dateTimeOccurred: restorationDate,
          restoredBy: 'admin-datacenter'
        })
      );

      expect(event.getDaysDeleted()).toBe(6);
      expect(event.isWithinGracePeriod()).toBe(true);
      const message = event.getRestorationMessage();
      expect(message).toContain('6 days');
    });

    it('should represent bulk operation undo', () => {
      const deletionDate = new Date('2024-01-10T14:00:00Z');
      const restorationDate = new Date('2024-01-12T09:00:00Z');
      const apIP = IPAddress.create('192.168.50.100').value;

      const event = new NetworkDeviceRestoredEvent(
        createEventProps({
          deviceName: 'AP-Floor5-East',
          ipAddress: apIP,
          deletedAt: deletionDate,
          dateTimeOccurred: restorationDate,
          restoredBy: 'system:bulk-restore'
        })
      );

      expect(event.getDaysDeleted()).toBe(1);
      expect(event.isWithinGracePeriod()).toBe(true);
      expect(event.restoredBy).toBe('system:bulk-restore');
    });

    it('should represent change of plans scenario', () => {
      const deletionDate = new Date('2024-01-01T08:00:00Z');
      const restorationDate = new Date('2024-01-04T16:00:00Z'); // 3 days later

      const event = new NetworkDeviceRestoredEvent(
        createEventProps({
          deviceName: 'Firewall-DMZ-01',
          deletedAt: deletionDate,
          dateTimeOccurred: restorationDate,
          restoredBy: 'admin-security-team'
        })
      );

      expect(event.getDaysDeleted()).toBe(3);
      expect(event.isWithinGracePeriod()).toBe(true);
      const message = event.getRestorationMessage();
      expect(message).toContain('Firewall-DMZ-01');
      expect(message).toContain('3 days');
      expect(message).toContain('admin-security-team');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const event1 = new NetworkDeviceRestoredEvent(
        createEventProps({
          deviceName: 'Device-1',
          ipAddress: ip1,
          restoredBy: 'user-1'
        })
      );

      const ip2 = IPAddress.create('192.168.1.2').value;
      const event2 = new NetworkDeviceRestoredEvent(
        createEventProps({
          deviceName: 'Device-2',
          ipAddress: ip2,
          restoredBy: 'user-2'
        })
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
      expect(event1.restoredBy).not.toBe(event2.restoredBy);
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:01Z');

      const event1 = new NetworkDeviceRestoredEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new NetworkDeviceRestoredEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
