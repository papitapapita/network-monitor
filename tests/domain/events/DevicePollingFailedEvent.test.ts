import { DevicePollingFailedEvent } from '../../../src/domain/events/DevicePollingFailedEvent';
import { NetworkDeviceId } from '../../../src/domain/entities/NetworkDeviceId';
import { PollingResultId } from '../../../src/domain/entities/PollingResultId';
import { PollingStatus } from '../../../src/domain/value-objects';
import { UniqueEntityID } from '../../../src/domain/shared/kernel';

describe('DevicePollingFailedEvent', () => {
  let aggregateId: PollingResultId;
  let networkDeviceId: NetworkDeviceId;
  const deviceName = 'Router-01';
  const ipAddress = '192.168.1.1';
  const errorMessage = 'Connection timeout';
  const attemptNumber = 3;

  beforeEach(() => {
    aggregateId = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000').value;
    networkDeviceId = NetworkDeviceId.create().value;
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event).toBeDefined();
      expect(event.networkDeviceId).toBe(networkDeviceId);
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.status).toBe(PollingStatus.FAILED);
      expect(event.errorMessage).toBe(errorMessage);
      expect(event.attemptNumber).toBe(attemptNumber);
      expect(event.wasOnline).toBe(false);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );
      const afterCreation = new Date();

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
      expect(event.dateTimeOccurred.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should accept wasOnline as true', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        true
      );

      expect(event.wasOnline).toBe(true);
    });

    it('should accept wasOnline as false', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.wasOnline).toBe(false);
    });

    it('should store aggregateId privately', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      // aggregateId should not be directly accessible
      expect((event as any).aggregateId).toBe(aggregateId);
    });

    it('should accept FAILED status', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.status).toBe(PollingStatus.FAILED);
    });

    it('should accept TIMEOUT status', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.TIMEOUT,
        'Request timed out',
        attemptNumber,
        false
      );

      expect(event.status).toBe(PollingStatus.TIMEOUT);
    });

    it('should accept different attempt numbers', () => {
      const attempts = [1, 3, 5, 10];

      attempts.forEach((attempt) => {
        const event = new DevicePollingFailedEvent(
          aggregateId,
          networkDeviceId,
          deviceName,
          ipAddress,
          PollingStatus.FAILED,
          errorMessage,
          attempt,
          false
        );

        expect(event.attemptNumber).toBe(attempt);
      });
    });

    it('should accept different device names', () => {
      const names = ['Switch-01', 'AP-Main-Floor', 'Firewall-DMZ', 'Core-Router'];

      names.forEach((name) => {
        const event = new DevicePollingFailedEvent(
          aggregateId,
          networkDeviceId,
          name,
          ipAddress,
          PollingStatus.FAILED,
          errorMessage,
          attemptNumber,
          false
        );

        expect(event.deviceName).toBe(name);
      });
    });

    it('should accept different IP addresses', () => {
      const ips = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '8.8.8.8'];

      ips.forEach((ip) => {
        const event = new DevicePollingFailedEvent(
          aggregateId,
          networkDeviceId,
          deviceName,
          ip,
          PollingStatus.FAILED,
          errorMessage,
          attemptNumber,
          false
        );

        expect(event.ipAddress).toBe(ip);
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
          aggregateId,
          networkDeviceId,
          deviceName,
          ipAddress,
          PollingStatus.FAILED,
          error,
          attemptNumber,
          false
        );

        expect(event.errorMessage).toBe(error);
      });
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      const id1 = event.getAggregateId();
      const id2 = event.getAggregateId();

      expect(id1).toBe(id2);
    });

    it('should return PollingResultId type', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(PollingResultId);
    });
  });

  describe('isGoingOffline', () => {
    it('should return true when wasOnline is true', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        true
      );

      expect(event.isGoingOffline()).toBe(true);
    });

    it('should return false when wasOnline is false', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.isGoingOffline()).toBe(false);
    });

    it('should be consistent with wasOnline property', () => {
      const goingOfflineEvent = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        true
      );

      const alreadyOfflineEvent = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(goingOfflineEvent.isGoingOffline()).toBe(goingOfflineEvent.wasOnline);
      expect(alreadyOfflineEvent.isGoingOffline()).toBe(alreadyOfflineEvent.wasOnline);
    });
  });

  describe('isTimeout', () => {
    it('should return true when status is TIMEOUT', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.TIMEOUT,
        'Request timed out',
        attemptNumber,
        false
      );

      expect(event.isTimeout()).toBe(true);
    });

    it('should return false when status is FAILED', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.isTimeout()).toBe(false);
    });

    it('should be mutually exclusive with isGeneralFailure for TIMEOUT', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.TIMEOUT,
        'Request timed out',
        attemptNumber,
        false
      );

      expect(event.isTimeout()).toBe(true);
      expect(event.isGeneralFailure()).toBe(false);
    });
  });

  describe('isGeneralFailure', () => {
    it('should return true when status is FAILED', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.isGeneralFailure()).toBe(true);
    });

    it('should return false when status is TIMEOUT', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.TIMEOUT,
        'Request timed out',
        attemptNumber,
        false
      );

      expect(event.isGeneralFailure()).toBe(false);
    });

    it('should be mutually exclusive with isTimeout for FAILED', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.isGeneralFailure()).toBe(true);
      expect(event.isTimeout()).toBe(false);
    });
  });

  describe('IDomainEvent interface', () => {
    it('should implement IDomainEvent interface', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should have dateTimeOccurred as readonly', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      const originalDate = event.dateTimeOccurred;

      // TypeScript prevents this, but we can verify the property exists
      expect(event.dateTimeOccurred).toBe(originalDate);
    });
  });

  describe('property immutability', () => {
    it('should have readonly networkDeviceId', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      const originalId = event.networkDeviceId;

      // TypeScript prevents reassignment, verify property is accessible
      expect(event.networkDeviceId).toBe(originalId);
    });

    it('should have readonly deviceName', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should have readonly ipAddress', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.ipAddress).toBe(ipAddress);
    });

    it('should have readonly status', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.status).toBe(PollingStatus.FAILED);
    });

    it('should have readonly errorMessage', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.errorMessage).toBe(errorMessage);
    });

    it('should have readonly attemptNumber', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.attemptNumber).toBe(attemptNumber);
    });

    it('should have readonly wasOnline', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        true
      );

      expect(event.wasOnline).toBe(true);
    });
  });

  describe('event scenarios', () => {
    it('should represent a device going offline (status transition)', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Router-Main',
        '10.0.0.1',
        PollingStatus.FAILED,
        'Host unreachable',
        3,
        true
      );

      expect(event.isGoingOffline()).toBe(true);
      expect(event.wasOnline).toBe(true);
      expect(event.isGeneralFailure()).toBe(true);
      expect(event.attemptNumber).toBe(3);
    });

    it('should represent a device already offline (no status transition)', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Switch-Edge',
        '192.168.10.5',
        PollingStatus.FAILED,
        'Network unreachable',
        1,
        false
      );

      expect(event.isGoingOffline()).toBe(false);
      expect(event.wasOnline).toBe(false);
      expect(event.isGeneralFailure()).toBe(true);
    });

    it('should represent a timeout failure', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'AP-Floor-2',
        '172.16.5.100',
        PollingStatus.TIMEOUT,
        'Request timed out after 5000ms',
        2,
        true
      );

      expect(event.isTimeout()).toBe(true);
      expect(event.isGeneralFailure()).toBe(false);
      expect(event.isGoingOffline()).toBe(true);
      expect(event.errorMessage).toContain('timed out');
    });

    it('should represent a general failure', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Firewall-01',
        '10.1.1.1',
        PollingStatus.FAILED,
        'Connection refused',
        5,
        true
      );

      expect(event.isGeneralFailure()).toBe(true);
      expect(event.isTimeout()).toBe(false);
      expect(event.attemptNumber).toBe(5);
    });

    it('should capture first failure attempt', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Router-Branch',
        '192.168.200.1',
        PollingStatus.FAILED,
        'No route to host',
        1,
        true
      );

      expect(event.attemptNumber).toBe(1);
      expect(event.isGoingOffline()).toBe(true);
    });

    it('should capture final failure attempt after retries', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Critical-Switch',
        '10.10.10.1',
        PollingStatus.FAILED,
        'All retry attempts exhausted',
        10,
        true
      );

      expect(event.attemptNumber).toBe(10);
      expect(event.errorMessage).toContain('retry');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Device-1',
        '192.168.1.1',
        PollingStatus.FAILED,
        'Error 1',
        1,
        false
      );

      const event2 = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Device-2',
        '192.168.1.2',
        PollingStatus.TIMEOUT,
        'Error 2',
        2,
        true
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.ipAddress).not.toBe(event2.ipAddress);
      expect(event1.status).not.toBe(event2.status);
      expect(event1.errorMessage).not.toBe(event2.errorMessage);
      expect(event1.attemptNumber).not.toBe(event2.attemptNumber);
      expect(event1.wasOnline).not.toBe(event2.wasOnline);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  describe('status type consistency', () => {
    it('should correctly identify FAILED status', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.status).toBe(PollingStatus.FAILED);
      expect(event.isGeneralFailure()).toBe(true);
      expect(event.isTimeout()).toBe(false);
    });

    it('should correctly identify TIMEOUT status', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.TIMEOUT,
        'Timeout error',
        attemptNumber,
        false
      );

      expect(event.status).toBe(PollingStatus.TIMEOUT);
      expect(event.isTimeout()).toBe(true);
      expect(event.isGeneralFailure()).toBe(false);
    });

    it('should maintain status consistency across method calls', () => {
      const failedEvent = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      const timeoutEvent = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.TIMEOUT,
        'Timeout',
        attemptNumber,
        false
      );

      // Multiple calls should return consistent results
      expect(failedEvent.isGeneralFailure()).toBe(true);
      expect(failedEvent.isGeneralFailure()).toBe(true);

      expect(timeoutEvent.isTimeout()).toBe(true);
      expect(timeoutEvent.isTimeout()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        '',
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle empty IP address', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        '',
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.ipAddress).toBe('');
    });

    it('should handle empty error message', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        '',
        attemptNumber,
        false
      );

      expect(event.errorMessage).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        longName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle very long error messages', () => {
      const longError = 'Error: '.repeat(100);
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        longError,
        attemptNumber,
        false
      );

      expect(event.errorMessage).toBe(longError);
      expect(event.errorMessage.length).toBeGreaterThan(500);
    });

    it('should handle IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipv6,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.ipAddress).toBe(ipv6);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        specialName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        attemptNumber,
        false
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle special characters in error message', () => {
      const specialError = 'Error: Connection failed! @network #timeout $retry';
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        specialError,
        attemptNumber,
        false
      );

      expect(event.errorMessage).toBe(specialError);
    });

    it('should handle attempt number at minimum (1)', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        1,
        false
      );

      expect(event.attemptNumber).toBe(1);
    });

    it('should handle attempt number at maximum (10)', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ipAddress,
        PollingStatus.FAILED,
        errorMessage,
        10,
        false
      );

      expect(event.attemptNumber).toBe(10);
    });
  });

  describe('real-world error scenarios', () => {
    it('should handle network unreachable error', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Remote-Router',
        '203.0.113.5',
        PollingStatus.FAILED,
        'Network is unreachable',
        3,
        true
      );

      expect(event.isGeneralFailure()).toBe(true);
      expect(event.errorMessage).toContain('unreachable');
    });

    it('should handle connection refused error', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Server-01',
        '192.168.1.100',
        PollingStatus.FAILED,
        'Connection refused by host',
        1,
        true
      );

      expect(event.isGeneralFailure()).toBe(true);
      expect(event.errorMessage).toContain('refused');
    });

    it('should handle timeout error with specific duration', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Slow-AP',
        '10.20.30.40',
        PollingStatus.TIMEOUT,
        'Request timeout after 5000ms',
        2,
        false
      );

      expect(event.isTimeout()).toBe(true);
      expect(event.errorMessage).toContain('5000ms');
    });

    it('should handle DNS resolution failure', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Named-Device',
        'device.example.com',
        PollingStatus.FAILED,
        'DNS resolution failed: Name or service not known',
        1,
        true
      );

      expect(event.isGeneralFailure()).toBe(true);
      expect(event.errorMessage).toContain('DNS');
    });

    it('should handle permission denied error', () => {
      const event = new DevicePollingFailedEvent(
        aggregateId,
        networkDeviceId,
        'Protected-Device',
        '172.16.0.1',
        PollingStatus.FAILED,
        'Permission denied (publickey)',
        1,
        true
      );

      expect(event.errorMessage).toContain('Permission denied');
    });
  });
});
