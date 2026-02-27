import {
  DevicePolledSuccessfullyEvent,
  DevicePolledSuccessfullyEventProps,
  NetworkDeviceId,
  PollingResultId,
  PollingMetrics,
  UniqueEntityID,
  IPAddress
} from '../../../../src/domain/device-inventory';

describe('DevicePolledSuccessfullyEvent', () => {
  let aggregateId: PollingResultId;
  let networkDeviceId: NetworkDeviceId;
  let metrics: PollingMetrics;
  const deviceName = 'Router-01';
  let ipAddress: IPAddress;
  const wasOffline = false;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = PollingResultId.create(
      '550e8400-e29b-41d4-a716-446655440000'
    ).value;
    networkDeviceId = NetworkDeviceId.create().value;
    ipAddress = IPAddress.create('192.168.1.1').value;
    metrics = PollingMetrics.create({
      responseTimes: [23.5, 24.1, 23.8, 24.3],
      totalPings: 4,
      successfulPings: 4
    }).value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<DevicePolledSuccessfullyEventProps>
  ): DevicePolledSuccessfullyEventProps => ({
    aggregateId,
    networkDeviceId,
    deviceName,
    ipAddress,
    metrics,
    wasOffline,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(event).toBeDefined();
      expect(event.networkDeviceId).toBe(networkDeviceId);
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.metrics).toBe(metrics);
      expect(event.wasOffline).toBe(false);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new DevicePolledSuccessfullyEvent(props);

      // Modify original props object
      (props as any).deviceName = 'Modified';

      // Event should not be affected
      expect(event.deviceName).toBe(deviceName);
    });

    it('should accept wasOffline as true', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ wasOffline: true })
      );

      expect(event.wasOffline).toBe(true);
    });

    it('should accept wasOffline as false', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ wasOffline: false })
      );

      expect(event.wasOffline).toBe(false);
    });

    it('should accept different device names', () => {
      const names = [
        'Switch-01',
        'AP-Main-Floor',
        'Firewall-DMZ',
        'Core-Router'
      ];

      names.forEach((name) => {
        const event = new DevicePolledSuccessfullyEvent(
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
        const event = new DevicePolledSuccessfullyEvent(
          createEventProps({ ipAddress: ipVO })
        );

        expect(event.ipAddress).toBe(ipVO);
        expect(event.ipAddress.value).toBe(ip);
      });
    });

    it('should accept different metrics objects', () => {
      const differentMetrics = PollingMetrics.create({
        responseTimes: [10.5, 11.2],
        totalPings: 4,
        successfulPings: 2
      }).value;

      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ metrics: differentMetrics })
      );

      expect(event.metrics).toBe(differentMetrics);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });

    it('should return PollingResultId type', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(PollingResultId);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same date on multiple calls', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      const date1 = event.dateTimeOccurred;
      const date2 = event.dateTimeOccurred;

      expect(date1).toBe(date2);
    });
  });

  describe('property getters', () => {
    it('should return networkDeviceId', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(event.networkDeviceId).toBe(networkDeviceId);
    });

    it('should return deviceName', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should return ipAddress value object', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.ipAddress.value).toBe('192.168.1.1');
    });

    it('should return metrics', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(event.metrics).toBe(metrics);
    });

    it('should return wasOffline', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ wasOffline: true })
      );

      expect(event.wasOffline).toBe(true);
    });

    it('should return consistent values on multiple reads', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      const id1 = event.networkDeviceId;
      const id2 = event.networkDeviceId;
      const name1 = event.deviceName;
      const name2 = event.deviceName;
      const ip1 = event.ipAddress;
      const ip2 = event.ipAddress;
      const metrics1 = event.metrics;
      const metrics2 = event.metrics;

      expect(id1).toBe(id2);
      expect(name1).toBe(name2);
      expect(ip1).toBe(ip2);
      expect(metrics1).toBe(metrics2);
    });
  });

  describe('isRecovery', () => {
    it('should return true when wasOffline is true', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ wasOffline: true })
      );

      expect(event.isRecovery()).toBe(true);
    });

    it('should return false when wasOffline is false', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ wasOffline: false })
      );

      expect(event.isRecovery()).toBe(false);
    });

    it('should be consistent with wasOffline property', () => {
      const recoveryEvent = new DevicePolledSuccessfullyEvent(
        createEventProps({ wasOffline: true })
      );

      const normalEvent = new DevicePolledSuccessfullyEvent(
        createEventProps({ wasOffline: false })
      );

      expect(recoveryEvent.isRecovery()).toBe(
        recoveryEvent.wasOffline
      );
      expect(normalEvent.isRecovery()).toBe(normalEvent.wasOffline);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      const str = event.toString();

      expect(str).toContain('DevicePolledSuccessfullyEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should return consistent string on multiple calls', () => {
      const event = new DevicePolledSuccessfullyEvent(
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
      const event = new DevicePolledSuccessfullyEvent(
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
      const event = new DevicePolledSuccessfullyEvent(
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
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
      expect(event.ipAddress.isIPv6()).toBe(true);
      expect(event.ipAddress.value).toBe('2001:db8::1');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ deviceName: longName })
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({ deviceName: specialName })
      );

      expect(event.deviceName).toBe(specialName);
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
        createEventProps({ metrics: perfectMetrics })
      );

      const event2 = new DevicePolledSuccessfullyEvent(
        createEventProps({ metrics: partialMetrics })
      );

      expect(event1.metrics.packetLoss).toBe(0);
      expect(event2.metrics.packetLoss).toBeGreaterThan(0);
    });

    it('should maintain metrics reference', () => {
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps()
      );

      expect(event.metrics).toBe(metrics);
      expect(event.metrics.totalPings).toBe(4);
      expect(event.metrics.successfulPings).toBe(4);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent a regular successful poll (not recovery)', () => {
      const routerIP = IPAddress.create('10.0.0.1').value;
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({
          deviceName: 'Router-Main',
          ipAddress: routerIP,
          wasOffline: false
        })
      );

      expect(event.isRecovery()).toBe(false);
      expect(event.wasOffline).toBe(false);
      expect(event.deviceName).toBe('Router-Main');
      expect(event.ipAddress.value).toBe('10.0.0.1');
    });

    it('should represent a device recovery event', () => {
      const switchIP = IPAddress.create('192.168.10.5').value;
      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({
          deviceName: 'Switch-Edge',
          ipAddress: switchIP,
          wasOffline: true
        })
      );

      expect(event.isRecovery()).toBe(true);
      expect(event.wasOffline).toBe(true);
      expect(event.deviceName).toBe('Switch-Edge');
      expect(event.ipAddress.value).toBe('192.168.10.5');
    });

    it('should capture first successful poll after device installation', () => {
      const apIP = IPAddress.create('172.16.5.100').value;
      const newDeviceMetrics = PollingMetrics.create({
        responseTimes: [15.2, 15.8, 16.1, 15.5],
        totalPings: 4,
        successfulPings: 4
      }).value;

      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({
          deviceName: 'New-AP-01',
          ipAddress: apIP,
          metrics: newDeviceMetrics,
          wasOffline: false
        })
      );

      expect(event.isRecovery()).toBe(false);
      expect(event.metrics.averageResponseTime).toBeCloseTo(15.65, 1);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
    });

    it('should capture recovery from prolonged outage', () => {
      const routerIP = IPAddress.create('10.1.1.1').value;
      const recoveryMetrics = PollingMetrics.create({
        responseTimes: [45.2, 46.1, 44.8, 45.5],
        totalPings: 4,
        successfulPings: 4
      }).value;

      const event = new DevicePolledSuccessfullyEvent(
        createEventProps({
          deviceName: 'Critical-Router',
          ipAddress: routerIP,
          metrics: recoveryMetrics,
          wasOffline: true
        })
      );

      expect(event.isRecovery()).toBe(true);
      expect(event.deviceName).toBe('Critical-Router');
      expect(event.metrics.averageResponseTime).toBeCloseTo(45.4, 1);
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const event1 = new DevicePolledSuccessfullyEvent(
        createEventProps({
          deviceName: 'Device-1',
          ipAddress: ip1,
          wasOffline: false
        })
      );

      const ip2 = IPAddress.create('192.168.1.2').value;
      const event2 = new DevicePolledSuccessfullyEvent(
        createEventProps({
          deviceName: 'Device-2',
          ipAddress: ip2,
          wasOffline: true
        })
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
      expect(event1.wasOffline).not.toBe(event2.wasOffline);
      expect(event1.ipAddress.value).toBe('192.168.1.1');
      expect(event2.ipAddress.value).toBe('192.168.1.2');
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:01Z');

      const event1 = new DevicePolledSuccessfullyEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new DevicePolledSuccessfullyEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
