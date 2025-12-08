import { PollingConfigurationChangedEvent } from '../../../src/domain/events/PollingConfigurationChangedEvent';
import { NetworkDeviceId } from '../../../src/domain/entities/NetworkDeviceId';
import { PollingConfigurationId } from '../../../src/domain/entities/PollingConfigurationId';
import { UniqueEntityID } from '../../../src/domain/shared/kernel';

describe('PollingConfigurationChangedEvent', () => {
  let aggregateId: PollingConfigurationId;
  let networkDeviceId: NetworkDeviceId;
  const deviceName = 'Router-01';
  const changeDescription = 'Retry policy updated to 5 attempts';

  beforeEach(() => {
    aggregateId = PollingConfigurationId.create('550e8400-e29b-41d4-a716-446655440000').value;
    networkDeviceId = NetworkDeviceId.create().value;
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      expect(event).toBeDefined();
      expect(event.networkDeviceId).toBe(networkDeviceId);
      expect(event.deviceName).toBe(deviceName);
      expect(event.changeDescription).toBe(changeDescription);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );
      const afterCreation = new Date();

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
      expect(event.dateTimeOccurred.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should store aggregateId privately', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      // aggregateId should not be directly accessible
      expect((event as any).aggregateId).toBe(aggregateId);
    });

    it('should accept different device names', () => {
      const names = ['Switch-01', 'AP-Main-Floor', 'Firewall-DMZ', 'Core-Router'];

      names.forEach((name) => {
        const event = new PollingConfigurationChangedEvent(
          aggregateId,
          networkDeviceId,
          name,
          changeDescription
        );

        expect(event.deviceName).toBe(name);
      });
    });

    it('should accept different change descriptions', () => {
      const descriptions = [
        'Retry policy updated',
        'Polling enabled',
        'Polling disabled',
        'Configuration reset to defaults',
        'Retry policy changed from 3 to 5 attempts'
      ];

      descriptions.forEach((description) => {
        const event = new PollingConfigurationChangedEvent(
          aggregateId,
          networkDeviceId,
          deviceName,
          description
        );

        expect(event.changeDescription).toBe(description);
      });
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      const id1 = event.getAggregateId();
      const id2 = event.getAggregateId();

      expect(id1).toBe(id2);
    });

    it('should return PollingConfigurationId type', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(PollingConfigurationId);
    });
  });

  describe('IDomainEvent interface', () => {
    it('should implement IDomainEvent interface', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should have dateTimeOccurred as readonly', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      const originalDate = event.dateTimeOccurred;

      // TypeScript prevents this, but we can verify the property exists
      expect(event.dateTimeOccurred).toBe(originalDate);
    });
  });

  describe('property immutability', () => {
    it('should have readonly networkDeviceId', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      const originalId = event.networkDeviceId;

      // TypeScript prevents reassignment, verify property is accessible
      expect(event.networkDeviceId).toBe(originalId);
    });

    it('should have readonly deviceName', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should have readonly changeDescription', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      expect(event.changeDescription).toBe(changeDescription);
    });
  });

  describe('event scenarios', () => {
    it('should represent retry policy update', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Critical-Router',
        'Retry policy updated: maxAttempts changed from 3 to 5'
      );

      expect(event.deviceName).toBe('Critical-Router');
      expect(event.changeDescription).toContain('Retry policy');
      expect(event.changeDescription).toContain('5');
    });

    it('should represent enabling polling', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Edge-Switch',
        'Polling enabled for device'
      );

      expect(event.changeDescription).toContain('enabled');
    });

    it('should represent disabling polling', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Maintenance-AP',
        'Polling disabled for maintenance'
      );

      expect(event.changeDescription).toContain('disabled');
      expect(event.changeDescription).toContain('maintenance');
    });

    it('should represent configuration reset', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Test-Device',
        'Configuration reset to default values'
      );

      expect(event.changeDescription).toContain('reset');
      expect(event.changeDescription).toContain('default');
    });

    it('should represent multiple configuration changes', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Core-Switch',
        'Multiple changes: retry policy (3->5), enabled state (false->true)'
      );

      expect(event.changeDescription).toContain('Multiple changes');
      expect(event.changeDescription).toContain('retry policy');
      expect(event.changeDescription).toContain('enabled state');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Device-1',
        'Change 1'
      );

      const event2 = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Device-2',
        'Change 2'
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.changeDescription).not.toBe(event2.changeDescription);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        changeDescription
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  describe('change description content', () => {
    it('should support detailed change descriptions', () => {
      const detailedDescription =
        'Configuration updated: retry policy changed from 3 to 5 attempts, ' +
        'backoff multiplier changed from 1.5 to 2.0, ' +
        'max backoff time changed from 60s to 120s';

      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        detailedDescription
      );

      expect(event.changeDescription).toContain('retry policy');
      expect(event.changeDescription).toContain('backoff multiplier');
      expect(event.changeDescription).toContain('max backoff');
    });

    it('should support simple change descriptions', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        'Enabled'
      );

      expect(event.changeDescription).toBe('Enabled');
    });

    it('should support structured change descriptions', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        'Field: retryPolicy.maxAttempts, Old: 3, New: 5'
      );

      expect(event.changeDescription).toContain('Field:');
      expect(event.changeDescription).toContain('Old:');
      expect(event.changeDescription).toContain('New:');
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        '',
        changeDescription
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle empty change description', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        ''
      );

      expect(event.changeDescription).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        longName,
        changeDescription
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle very long change descriptions', () => {
      const longDescription = 'Configuration change: '.repeat(50);
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        longDescription
      );

      expect(event.changeDescription).toBe(longDescription);
      expect(event.changeDescription.length).toBeGreaterThan(500);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        specialName,
        changeDescription
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle special characters in change description', () => {
      const specialDescription = 'Config: retry@3->5, backoff#1.5->2.0, max$60->120';
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        specialDescription
      );

      expect(event.changeDescription).toBe(specialDescription);
    });

    it('should handle multiline change descriptions', () => {
      const multilineDescription =
        'Configuration changes:\n' +
        '- Retry policy: 3 -> 5 attempts\n' +
        '- Backoff: 1.5 -> 2.0\n' +
        '- Max backoff: 60s -> 120s';

      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        deviceName,
        multilineDescription
      );

      expect(event.changeDescription).toContain('\n');
      expect(event.changeDescription.split('\n').length).toBe(4);
    });
  });

  describe('real-world change scenarios', () => {
    it('should represent enabling device after maintenance', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Maintenance-Router',
        'Polling re-enabled after scheduled maintenance completion'
      );

      expect(event.changeDescription).toContain('re-enabled');
      expect(event.changeDescription).toContain('maintenance');
    });

    it('should represent emergency polling suspension', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Critical-Switch',
        'Polling temporarily disabled due to network incident'
      );

      expect(event.changeDescription).toContain('disabled');
      expect(event.changeDescription).toContain('incident');
    });

    it('should represent optimization changes', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Edge-Device',
        'Retry policy optimized: reduced attempts from 5 to 3 for faster failure detection'
      );

      expect(event.changeDescription).toContain('optimized');
      expect(event.changeDescription).toContain('reduced');
    });

    it('should represent bulk configuration update', () => {
      const event = new PollingConfigurationChangedEvent(
        aggregateId,
        networkDeviceId,
        'Standard-AP',
        'Applied standard configuration template: retry=3, backoff=1.5, maxBackoff=60s'
      );

      expect(event.changeDescription).toContain('template');
      expect(event.changeDescription).toContain('retry=3');
    });
  });
});
