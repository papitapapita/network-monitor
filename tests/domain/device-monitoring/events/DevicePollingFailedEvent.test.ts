import {
  DevicePollingFailedEvent,
  DevicePollingFailedEventProps,
  NetworkDeviceId,
  PollingResultId,
  PollingStatus,
  UniqueEntityID,
  IPAddress
} from '../../../../src/domain/device-inventory';

describe('DevicePollingFailedEvent', () => {
  let aggregateId: PollingResultId;
  let networkDeviceId: NetworkDeviceId;
  let status: PollingStatus;
  const deviceName = 'Router-01';
  let ipAddress: IPAddress;
  const errorMessage = 'Connection timeout';
  const attemptNumber = 3;
  const wasOnline = false;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = PollingResultId.create(
      '550e8400-e29b-41d4-a716-446655440000'
    ).value;
    networkDeviceId = NetworkDeviceId.create().value;
    ipAddress = IPAddress.create('192.168.1.1').value;
    status = PollingStatus.create('FAILED').value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<DevicePollingFailedEventProps>
  ): DevicePollingFailedEventProps => ({
    aggregateId,
    networkDeviceId,
    deviceName,
    ipAddress,
    status,
    errorMessage,
    attemptNumber,
    wasOnline,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event).toBeDefined();
      expect(event.networkDeviceId).toBe(networkDeviceId);
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.status).toBe(status);
      expect(event.errorMessage).toBe(errorMessage);
      expect(event.attemptNumber).toBe(attemptNumber);
      expect(event.wasOnline).toBe(false);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new DevicePollingFailedEvent(props);

      // Modify original props object
      (props as any).deviceName = 'Modified';

      // Event should not be affected
      expect(event.deviceName).toBe(deviceName);
    });

    it('should accept wasOnline as true', () => {
      const event = new DevicePollingFailedEvent(
        createEventProps({ wasOnline: true })
      );

      expect(event.wasOnline).toBe(true);
    });

    it('should accept wasOnline as false', () => {
      const event = new DevicePollingFailedEvent(
        createEventProps({ wasOnline: false })
      );

      expect(event.wasOnline).toBe(false);
    });

    it('should accept FAILED status', () => {
      const failedStatus = PollingStatus.create('FAILED').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({ status: failedStatus })
      );

      expect(event.status).toBe(failedStatus);
    });

    it('should accept TIMEOUT status', () => {
      const timeoutStatus = PollingStatus.create('TIMEOUT').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({
          status: timeoutStatus,
          errorMessage: 'Request timed out'
        })
      );

      expect(event.status).toBe(timeoutStatus);
    });

    it('should accept different attempt numbers', () => {
      const attempts = [1, 3, 5, 10];

      attempts.forEach((attempt) => {
        const event = new DevicePollingFailedEvent(
          createEventProps({ attemptNumber: attempt })
        );

        expect(event.attemptNumber).toBe(attempt);
      });
    });

    it('should accept different device names', () => {
      const names = [
        'Switch-01',
        'AP-Main-Floor',
        'Firewall-DMZ',
        'Core-Router'
      ];

      names.forEach((name) => {
        const event = new DevicePollingFailedEvent(
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
        const event = new DevicePollingFailedEvent(
          createEventProps({ ipAddress: ipVO })
        );

        expect(event.ipAddress).toBe(ipVO);
        expect(event.ipAddress.value).toBe(ip);
      });
    });

    it('should accept different error messages', () => {
      const errors = [
        'Connection timeout',
        'Network unreachable',
        'Host down',
        'No route to host'
      ];

      errors.forEach((error) => {
        const event = new DevicePollingFailedEvent(
          createEventProps({ errorMessage: error })
        );

        expect(event.errorMessage).toBe(error);
      });
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });

    it('should return PollingResultId type', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(PollingResultId);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same date on multiple calls', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      const date1 = event.dateTimeOccurred;
      const date2 = event.dateTimeOccurred;

      expect(date1).toBe(date2);
    });
  });

  describe('property getters', () => {
    it('should return networkDeviceId', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event.networkDeviceId).toBe(networkDeviceId);
    });

    it('should return deviceName', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event.deviceName).toBe(deviceName);
    });

    it('should return ipAddress value object', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.ipAddress.value).toBe('192.168.1.1');
    });

    it('should return status', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event.status).toBe(status);
    });

    it('should return errorMessage', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event.errorMessage).toBe(errorMessage);
    });

    it('should return attemptNumber', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      expect(event.attemptNumber).toBe(attemptNumber);
    });

    it('should return wasOnline', () => {
      const event = new DevicePollingFailedEvent(
        createEventProps({ wasOnline: true })
      );

      expect(event.wasOnline).toBe(true);
    });
  });

  describe('isGoingOffline', () => {
    it('should return true when wasOnline is true', () => {
      const event = new DevicePollingFailedEvent(
        createEventProps({ wasOnline: true })
      );

      expect(event.isGoingOffline()).toBe(true);
    });

    it('should return false when wasOnline is false', () => {
      const event = new DevicePollingFailedEvent(
        createEventProps({ wasOnline: false })
      );

      expect(event.isGoingOffline()).toBe(false);
    });

    it('should be consistent with wasOnline property', () => {
      const goingOfflineEvent = new DevicePollingFailedEvent(
        createEventProps({ wasOnline: true })
      );

      const alreadyOfflineEvent = new DevicePollingFailedEvent(
        createEventProps({ wasOnline: false })
      );

      expect(goingOfflineEvent.isGoingOffline()).toBe(
        goingOfflineEvent.wasOnline
      );
      expect(alreadyOfflineEvent.isGoingOffline()).toBe(
        alreadyOfflineEvent.wasOnline
      );
    });
  });

  describe('isTimeout', () => {
    it('should return true when status is TIMEOUT', () => {
      const timeoutStatus = PollingStatus.create('TIMEOUT').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({
          status: timeoutStatus,
          errorMessage: 'Request timed out'
        })
      );

      expect(event.isTimeout()).toBe(true);
    });

    it('should return false when status is FAILED', () => {
      const failedStatus = PollingStatus.create('FAILED').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({ status: failedStatus })
      );

      expect(event.isTimeout()).toBe(false);
    });

    it('should be mutually exclusive with isGeneralFailure for TIMEOUT', () => {
      const timeoutStatus = PollingStatus.create('TIMEOUT').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({
          status: timeoutStatus,
          errorMessage: 'Request timed out'
        })
      );

      expect(event.isTimeout()).toBe(true);
      expect(event.isGeneralFailure()).toBe(false);
    });
  });

  describe('isGeneralFailure', () => {
    it('should return true when status is FAILED', () => {
      const failedStatus = PollingStatus.create('FAILED').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({ status: failedStatus })
      );

      expect(event.isGeneralFailure()).toBe(true);
    });

    it('should return false when status is TIMEOUT', () => {
      const timeoutStatus = PollingStatus.create('TIMEOUT').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({ status: timeoutStatus })
      );

      expect(event.isGeneralFailure()).toBe(false);
    });

    it('should be mutually exclusive with isTimeout for FAILED', () => {
      const failedStatus = PollingStatus.create('FAILED').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({ status: failedStatus })
      );

      expect(event.isGeneralFailure()).toBe(true);
      expect(event.isTimeout()).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      const str = event.toString();

      expect(str).toContain('DevicePollingFailedEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should return consistent string on multiple calls', () => {
      const event = new DevicePollingFailedEvent(createEventProps());

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('value object integration', () => {
    it('should work with IPv4 addresses', () => {
      const ipv4 = IPAddress.create('10.0.0.1').value;
      const event = new DevicePollingFailedEvent(
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
      const event = new DevicePollingFailedEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
      expect(event.ipAddress.isIPv6()).toBe(true);
      expect(event.ipAddress.value).toBe(
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      );
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new DevicePollingFailedEvent(
        createEventProps({ deviceName: longName })
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle very long error messages', () => {
      const longError = 'Error: '.repeat(100);
      const event = new DevicePollingFailedEvent(
        createEventProps({ errorMessage: longError })
      );

      expect(event.errorMessage).toBe(longError);
      expect(event.errorMessage.length).toBeGreaterThan(500);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new DevicePollingFailedEvent(
        createEventProps({ deviceName: specialName })
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle special characters in error message', () => {
      const specialError =
        'Error: Connection failed! @network #timeout $retry';
      const event = new DevicePollingFailedEvent(
        createEventProps({ errorMessage: specialError })
      );

      expect(event.errorMessage).toBe(specialError);
    });

    it('should handle attempt number at minimum (1)', () => {
      const event = new DevicePollingFailedEvent(
        createEventProps({ attemptNumber: 1 })
      );

      expect(event.attemptNumber).toBe(1);
    });

    it('should handle attempt number at maximum (10)', () => {
      const event = new DevicePollingFailedEvent(
        createEventProps({ attemptNumber: 10 })
      );

      expect(event.attemptNumber).toBe(10);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent a device going offline (status transition)', () => {
      const routerIP = IPAddress.create('10.0.0.1').value;
      const failedStatus = PollingStatus.create('FAILED').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({
          deviceName: 'Router-Main',
          ipAddress: routerIP,
          status: failedStatus,
          errorMessage: 'Host unreachable',
          attemptNumber: 3,
          wasOnline: true
        })
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.wasOnline).toBe(true);
      expect(event.isGeneralFailure()).toBe(true);
      expect(event.attemptNumber).toBe(3);
      expect(event.ipAddress.value).toBe('10.0.0.1');
    });

    it('should represent a device already offline (no status transition)', () => {
      const switchIP = IPAddress.create('192.168.10.5').value;
      const failedStatus = PollingStatus.create('FAILED').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({
          deviceName: 'Switch-Edge',
          ipAddress: switchIP,
          status: failedStatus,
          errorMessage: 'Network unreachable',
          attemptNumber: 1,
          wasOnline: false
        })
      );

      expect(event.isGoingOffline()).toBe(false);
      expect(event.wasOnline).toBe(false);
      expect(event.isGeneralFailure()).toBe(true);
      expect(event.ipAddress.value).toBe('192.168.10.5');
    });

    it('should represent a timeout failure', () => {
      const apIP = IPAddress.create('172.16.5.100').value;
      const timeoutStatus = PollingStatus.create('TIMEOUT').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({
          deviceName: 'AP-Floor-2',
          ipAddress: apIP,
          status: timeoutStatus,
          errorMessage: 'Request timed out after 5000ms',
          attemptNumber: 2,
          wasOnline: true
        })
      );

      expect(event.isTimeout()).toBe(true);
      expect(event.isGeneralFailure()).toBe(false);
      expect(event.isGoingOffline()).toBe(true);
      expect(event.errorMessage).toContain('timed out');
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
    });

    it('should represent a general failure', () => {
      const firewallIP = IPAddress.create('10.1.1.1').value;
      const failedStatus = PollingStatus.create('FAILED').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({
          deviceName: 'Firewall-01',
          ipAddress: firewallIP,
          status: failedStatus,
          errorMessage: 'Connection refused',
          attemptNumber: 5,
          wasOnline: true
        })
      );

      expect(event.isGeneralFailure()).toBe(true);
      expect(event.isTimeout()).toBe(false);
      expect(event.attemptNumber).toBe(5);
    });

    it('should capture network unreachable error', () => {
      const remoteIP = IPAddress.create('203.0.113.5').value;
      const failedStatus = PollingStatus.create('FAILED').value;
      const event = new DevicePollingFailedEvent(
        createEventProps({
          deviceName: 'Remote-Router',
          ipAddress: remoteIP,
          status: failedStatus,
          errorMessage: 'Network is unreachable',
          attemptNumber: 3,
          wasOnline: true
        })
      );

      expect(event.isGeneralFailure()).toBe(true);
      expect(event.errorMessage).toContain('unreachable');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const ip1 = IPAddress.create('192.168.1.1').value;
      const ip2 = IPAddress.create('192.168.1.2').value;
      const failedStatus = PollingStatus.create('FAILED').value;
      const timeoutStatus = PollingStatus.create('TIMEOUT').value;

      const event1 = new DevicePollingFailedEvent(
        createEventProps({
          deviceName: 'Device-1',
          ipAddress: ip1,
          status: failedStatus,
          errorMessage: 'Error 1',
          attemptNumber: 1,
          wasOnline: false
        })
      );

      const event2 = new DevicePollingFailedEvent(
        createEventProps({
          deviceName: 'Device-2',
          ipAddress: ip2,
          status: timeoutStatus,
          errorMessage: 'Error 2',
          attemptNumber: 2,
          wasOnline: true
        })
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
      expect(event1.errorMessage).not.toBe(event2.errorMessage);
      expect(event1.attemptNumber).not.toBe(event2.attemptNumber);
      expect(event1.wasOnline).not.toBe(event2.wasOnline);
      expect(event1.ipAddress.value).toBe('192.168.1.1');
      expect(event2.ipAddress.value).toBe('192.168.1.2');
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:01Z');

      const event1 = new DevicePollingFailedEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new DevicePollingFailedEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
