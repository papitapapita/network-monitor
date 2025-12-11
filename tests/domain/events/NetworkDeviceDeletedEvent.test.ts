import {
  NetworkDeviceDeletedEvent,
  NetworkDeviceId,
  UniqueEntityID
} from '../../../src/domain';

describe('NetworkDeviceDeletedEvent', () => {
  let aggregateId: NetworkDeviceId;
  const deviceName = 'Router-01';
  const ipAddress = '192.168.1.1';
  const macAddress = '00:1A:2B:3C:4D:5E';
  const deletedBy = 'admin@example.com';

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event).toBeDefined();
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.macAddress).toBe(macAddress);
      expect(event.deletedBy).toBeUndefined();
    });

    it('should create an event with deletedBy optional parameter', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        deletedBy
      );

      expect(event).toBeDefined();
      expect(event.deviceName).toBe(deviceName);
      expect(event.deletedBy).toBe(deletedBy);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new NetworkDeviceDeletedEvent(
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

    it('should store aggregateId', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect((event as any).aggregateId).toBe(aggregateId);
    });
  });

  describe('deletedBy property', () => {
    it('should accept deletedBy as string', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        'user@example.com'
      );

      expect(event.deletedBy).toBe('user@example.com');
    });

    it('should accept deletedBy as undefined', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        undefined
      );

      expect(event.deletedBy).toBeUndefined();
    });

    it('should accept deletedBy as user ID', () => {
      const userId = 'user-123-abc';
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        userId
      );

      expect(event.deletedBy).toBe(userId);
    });

    it('should accept deletedBy as system identifier', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        'system:auto-cleanup'
      );

      expect(event.deletedBy).toBe('system:auto-cleanup');
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new NetworkDeviceDeletedEvent(
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
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  describe('property immutability', () => {
    it('should have readonly deviceName', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should have readonly ipAddress', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.ipAddress).toBe(ipAddress);
    });

    it('should have readonly macAddress', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      expect(event.macAddress).toBe(macAddress);
    });

    it('should have readonly deletedBy', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        deletedBy
      );

      expect(event.deletedBy).toBe(deletedBy);
    });
  });

  describe('deletion scenarios', () => {
    it('should represent manual deletion by administrator', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        'Old-Router-01',
        '192.168.1.254',
        'AA:BB:CC:DD:EE:FF',
        'admin@company.com'
      );

      expect(event.deviceName).toContain('Old-Router');
      expect(event.deletedBy).toContain('admin');
    });

    it('should represent automatic cleanup by system', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        'Decommissioned-Switch',
        '10.0.0.99',
        '00:11:22:33:44:55',
        'system:auto-cleanup'
      );

      expect(event.deletedBy).toContain('system');
    });

    it('should represent deletion without tracking who deleted', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        'Legacy-Device',
        '172.16.0.1',
        'FF:EE:DD:CC:BB:AA'
      );

      expect(event.deviceName).toBe('Legacy-Device');
      expect(event.deletedBy).toBeUndefined();
    });

    it('should capture device context for audit trail', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        'Core-Switch-DC1',
        '10.100.1.10',
        'AA:BB:CC:11:22:33',
        'operations@company.com'
      );

      expect(event.deviceName).toBeDefined();
      expect(event.ipAddress).toBeDefined();
      expect(event.macAddress).toBeDefined();
      expect(event.deletedBy).toBeDefined();
      expect(event.dateTimeOccurred).toBeDefined();
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new NetworkDeviceDeletedEvent(
        aggregateId,
        'Device-1',
        '192.168.1.1',
        '00:11:22:33:44:55',
        'user1@example.com'
      );

      const event2 = new NetworkDeviceDeletedEvent(
        aggregateId,
        'Device-2',
        '192.168.1.2',
        '00:11:22:33:44:56',
        'user2@example.com'
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.deletedBy).not.toBe(event2.deletedBy);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new NetworkDeviceDeletedEvent(
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

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        '',
        ipAddress,
        macAddress
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle very long deletedBy identifier', () => {
      const longIdentifier = 'user@' + 'x'.repeat(250) + '.com';
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        longIdentifier
      );

      expect(event.deletedBy).toBe(longIdentifier);
    });

    it('should handle special characters in deletedBy', () => {
      const specialIdentifier = 'user+tag@domain.co.uk';
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        specialIdentifier
      );

      expect(event.deletedBy).toBe(specialIdentifier);
    });
  });

  describe('timestamp accuracy', () => {
    it('should capture deletion time accurately', () => {
      const now = Date.now();
      const event = new NetworkDeviceDeletedEvent(
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
      const event = new NetworkDeviceDeletedEvent(
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

  describe('audit trail information', () => {
    it('should provide complete audit context', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        'Production-Router',
        '10.0.0.1',
        'AA:BB:CC:DD:EE:FF',
        'admin@company.com'
      );

      // Verify all audit information is present
      expect(event.getAggregateId()).toBeDefined();
      expect(event.deviceName).toBeDefined();
      expect(event.ipAddress).toBeDefined();
      expect(event.macAddress).toBeDefined();
      expect(event.deletedBy).toBeDefined();
      expect(event.dateTimeOccurred).toBeDefined();
    });

    it('should support audit queries by timestamp', () => {
      const event = new NetworkDeviceDeletedEvent(
        aggregateId,
        deviceName,
        ipAddress,
        macAddress,
        deletedBy
      );

      const timestamp = event.dateTimeOccurred;
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });
});
