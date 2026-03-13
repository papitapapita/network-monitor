import {
  NetworkDeviceStatusChangedEvent,
  NetworkDeviceStatusChangedEventProps,
  NetworkDeviceId,
  NetworkDeviceStatus,
  UniqueEntityID,
  IPAddress
} from '../../../src/domain/device-inventory';

describe('NetworkDeviceStatusChangedEvent', () => {
  let aggregateId: NetworkDeviceId;
  let previousStatus: NetworkDeviceStatus;
  let newStatus: NetworkDeviceStatus;
  const deviceName = 'Router-01';
  let ipAddress: IPAddress;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
    previousStatus = NetworkDeviceStatus.create('ONLINE').value;
    newStatus = NetworkDeviceStatus.create('OFFLINE').value;
    ipAddress = IPAddress.create('192.168.1.1').value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<NetworkDeviceStatusChangedEventProps>
  ): NetworkDeviceStatusChangedEventProps => ({
    aggregateId,
    deviceName,
    previousStatus,
    newStatus,
    ipAddress,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(event).toBeDefined();
      expect(event.deviceName).toBe(deviceName);
      expect(event.previousStatus).toBe(previousStatus);
      expect(event.newStatus).toBe(newStatus);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new NetworkDeviceStatusChangedEvent(props);

      // Modify original props object
      (props as any).deviceName = 'Modified';

      // Event should not be affected
      expect(event.deviceName).toBe(deviceName);
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
        const newIp = IPAddress.create(ip).value;
        const event = new NetworkDeviceStatusChangedEvent(
          createEventProps({ ipAddress: newIp })
        );

        expect(event.ipAddress.value).toBe(ip);
      });
    });

    it('should accept all status combinations', () => {
      const statuses = [
        NetworkDeviceStatus.create('ONLINE').value,
        NetworkDeviceStatus.create('OFFLINE').value,
        NetworkDeviceStatus.create('MAINTENANCE').value,
        NetworkDeviceStatus.create('UNKNOWN').value
      ];

      statuses.forEach((prevStatus) => {
        statuses.forEach((newStat) => {
          const event = new NetworkDeviceStatusChangedEvent(
            createEventProps({
              previousStatus: prevStatus,
              newStatus: newStat
            })
          );

          expect(event.previousStatus).toBe(prevStatus);
          expect(event.newStatus).toBe(newStat);
        });
      });
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(NetworkDeviceId);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same date on multiple calls', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      const date1 = event.dateTimeOccurred;
      const date2 = event.dateTimeOccurred;

      expect(date1).toBe(date2);
    });
  });

  describe('property getters', () => {
    it('should return deviceName', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should return previousStatus', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(event.previousStatus).toBe(previousStatus);
    });

    it('should return newStatus', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(event.newStatus).toBe(newStatus);
    });

    it('should return ipAddress', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      expect(event.ipAddress).toBe(ipAddress);
    });

    it('should return consistent values on multiple reads', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      const name1 = event.deviceName;
      const name2 = event.deviceName;
      const prev1 = event.previousStatus;
      const prev2 = event.previousStatus;
      const new1 = event.newStatus;
      const new2 = event.newStatus;
      const ip1 = event.ipAddress;
      const ip2 = event.ipAddress;

      expect(name1).toBe(name2);
      expect(prev1).toBe(prev2);
      expect(new1).toBe(new2);
      expect(ip1).toBe(ip2);
    });
  });

  describe('isGoingOffline', () => {
    it('should return true when transitioning from ONLINE to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isGoingOffline()).toBe(true);
    });

    it('should return true when transitioning from UNKNOWN to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('UNKNOWN').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isGoingOffline()).toBe(true);
    });

    it('should return true when transitioning from MAINTENANCE to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isGoingOffline()).toBe(true);
    });

    it('should return false when transitioning from OFFLINE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('OFFLINE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isGoingOffline()).toBe(false);
    });

    it('should return false when remaining OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('OFFLINE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isGoingOffline()).toBe(false);
    });

    it('should return false when transitioning to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isGoingOffline()).toBe(false);
    });
  });

  describe('isComingOnline', () => {
    it('should return true when transitioning from OFFLINE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('OFFLINE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isComingOnline()).toBe(true);
    });

    it('should return true when transitioning from UNKNOWN to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('UNKNOWN').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isComingOnline()).toBe(true);
    });

    it('should return true when transitioning from MAINTENANCE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isComingOnline()).toBe(true);
    });

    it('should return false when transitioning from ONLINE to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isComingOnline()).toBe(false);
    });

    it('should return false when remaining ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isComingOnline()).toBe(false);
    });

    it('should return false when transitioning to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('OFFLINE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isComingOnline()).toBe(false);
    });
  });

  describe('isEnteringMaintenance', () => {
    it('should return true when transitioning from ONLINE to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isEnteringMaintenance()).toBe(true);
    });

    it('should return true when transitioning from OFFLINE to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('OFFLINE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isEnteringMaintenance()).toBe(true);
    });

    it('should return true when transitioning from UNKNOWN to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('UNKNOWN').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isEnteringMaintenance()).toBe(true);
    });

    it('should return false when transitioning from MAINTENANCE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isEnteringMaintenance()).toBe(false);
    });

    it('should return false when remaining in MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isEnteringMaintenance()).toBe(false);
    });

    it('should return false when not transitioning to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isEnteringMaintenance()).toBe(false);
    });
  });

  describe('isLeavingMaintenance', () => {
    it('should return true when transitioning from MAINTENANCE to ONLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(true);
    });

    it('should return true when transitioning from MAINTENANCE to OFFLINE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(true);
    });

    it('should return true when transitioning from MAINTENANCE to UNKNOWN', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('UNKNOWN').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(true);
    });

    it('should return false when transitioning to MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should return false when remaining in MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should return false when not from MAINTENANCE', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      const str = event.toString();

      expect(str).toContain('NetworkDeviceStatusChangedEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should return consistent string on multiple calls', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps()
      );

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({ deviceName: '' })
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({ deviceName: longName })
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle IPv6 addresses', () => {
      const ipv6 = IPAddress.create(
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      ).value;
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
    });

    it('should handle compressed IPv6 addresses', () => {
      const ipv6 = IPAddress.create('2001:db8::1').value;
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({ deviceName: specialName })
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle same status transition (no actual change)', () => {
      const onlineStatus = NetworkDeviceStatus.create('ONLINE').value;
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: onlineStatus,
          newStatus: onlineStatus
        })
      );

      expect(event.isGoingOffline()).toBe(false);
      expect(event.isComingOnline()).toBe(false);
    });
  });

  describe('status transition combinations', () => {
    it('should handle ONLINE -> OFFLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.isComingOnline()).toBe(false);
      expect(event.isEnteringMaintenance()).toBe(false);
      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should handle OFFLINE -> ONLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('OFFLINE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isComingOnline()).toBe(true);
      expect(event.isGoingOffline()).toBe(false);
      expect(event.isEnteringMaintenance()).toBe(false);
      expect(event.isLeavingMaintenance()).toBe(false);
    });

    it('should handle ONLINE -> MAINTENANCE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value
        })
      );

      expect(event.isEnteringMaintenance()).toBe(true);
      expect(event.isLeavingMaintenance()).toBe(false);
      expect(event.isGoingOffline()).toBe(false);
      expect(event.isComingOnline()).toBe(false);
    });

    it('should handle MAINTENANCE -> ONLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(true);
      expect(event.isComingOnline()).toBe(true);
      expect(event.isEnteringMaintenance()).toBe(false);
      expect(event.isGoingOffline()).toBe(false);
    });

    it('should handle UNKNOWN -> ONLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('UNKNOWN').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value
        })
      );

      expect(event.isComingOnline()).toBe(true);
      expect(event.isGoingOffline()).toBe(false);
    });

    it('should handle UNKNOWN -> OFFLINE transition', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          previousStatus: NetworkDeviceStatus.create('UNKNOWN').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value
        })
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.isComingOnline()).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent network outage', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          deviceName: 'Core-Router-DC1',
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value,
          ipAddress: IPAddress.create('10.10.10.1').value
        })
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.deviceName).toContain('Core');
    });

    it('should represent recovery after outage', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          deviceName: 'Critical-Switch',
          previousStatus: NetworkDeviceStatus.create('OFFLINE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value,
          ipAddress: IPAddress.create('10.10.10.1').value
        })
      );

      expect(event.isComingOnline()).toBe(true);
    });

    it('should represent scheduled maintenance start', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          deviceName: 'Upgrade-Router',
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('MAINTENANCE').value,
          ipAddress: IPAddress.create('192.168.100.1').value
        })
      );

      expect(event.isEnteringMaintenance()).toBe(true);
    });

    it('should represent maintenance completion', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          deviceName: 'Upgraded-Router',
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value,
          ipAddress: IPAddress.create('192.168.100.1').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(true);
      expect(event.isComingOnline()).toBe(true);
    });

    it('should represent device failure during maintenance', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          deviceName: 'Failed-Device',
          previousStatus:
            NetworkDeviceStatus.create('MAINTENANCE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value,
          ipAddress: IPAddress.create('10.20.30.40').value
        })
      );

      expect(event.isLeavingMaintenance()).toBe(true);
      expect(event.isGoingOffline()).toBe(true);
    });

    it('should represent initial device discovery', () => {
      const event = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          deviceName: 'New-Device',
          previousStatus: NetworkDeviceStatus.create('UNKNOWN').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value,
          ipAddress: IPAddress.create('192.168.1.100').value
        })
      );

      expect(event.isComingOnline()).toBe(true);
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          deviceName: 'Device-1',
          previousStatus: NetworkDeviceStatus.create('ONLINE').value,
          newStatus: NetworkDeviceStatus.create('OFFLINE').value,
          ipAddress: IPAddress.create('192.168.1.1').value
        })
      );

      const event2 = new NetworkDeviceStatusChangedEvent(
        createEventProps({
          deviceName: 'Device-2',
          previousStatus: NetworkDeviceStatus.create('OFFLINE').value,
          newStatus: NetworkDeviceStatus.create('ONLINE').value,
          ipAddress: IPAddress.create('192.168.1.2').value
        })
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:01Z');

      const event1 = new NetworkDeviceStatusChangedEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new NetworkDeviceStatusChangedEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
