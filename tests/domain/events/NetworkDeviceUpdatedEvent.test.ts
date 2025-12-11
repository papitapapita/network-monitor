import {
  NetworkDeviceUpdatedEvent,
  NetworkDeviceId,
  UniqueEntityID
} from '../../../src/domain';

describe('NetworkDeviceUpdatedEvent', () => {
  let aggregateId: NetworkDeviceId;
  const deviceName = 'Router-01';

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const changedFields = ['name'];
      const previousValues = { name: 'OldRouter' };
      const newValues = { name: 'NewRouter' };

      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        changedFields,
        previousValues,
        newValues
      );

      expect(event).toBeDefined();
      expect(event.deviceName).toBe(deviceName);
      expect(event.changedFields).toEqual(changedFields);
      expect(event.previousValues).toEqual(previousValues);
      expect(event.newValues).toEqual(newValues);
    });

    it('should set dateTimeOccurred to current time', () => {
      const beforeCreation = new Date();
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
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
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect((event as any).aggregateId).toBe(aggregateId);
    });

    it('should handle single field change', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['description'],
        { description: 'Old description' },
        { description: 'New description' }
      );

      expect(event.changedFields).toHaveLength(1);
      expect(event.changedFields).toContain('description');
    });

    it('should handle multiple field changes', () => {
      const changedFields = ['name', 'description', 'managementPort'];
      const previousValues = {
        name: 'OldRouter',
        description: 'Old desc',
        managementPort: 22
      };
      const newValues = {
        name: 'NewRouter',
        description: 'New desc',
        managementPort: 8080
      };

      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        changedFields,
        previousValues,
        newValues
      );

      expect(event.changedFields).toHaveLength(3);
      expect(event.changedFields).toContain('name');
      expect(event.changedFields).toContain('description');
      expect(event.changedFields).toContain('managementPort');
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      const id = event.getAggregateId();

      expect(id).toBe(aggregateId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      const id = event.getAggregateId();

      expect(id).toBeInstanceOf(NetworkDeviceId);
    });
  });

  describe('hasFieldChanged', () => {
    it('should return true for changed field', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name', 'description'],
        { name: 'OldRouter', description: 'Old desc' },
        { name: 'NewRouter', description: 'New desc' }
      );

      expect(event.hasFieldChanged('name')).toBe(true);
      expect(event.hasFieldChanged('description')).toBe(true);
    });

    it('should return false for unchanged field', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.hasFieldChanged('description')).toBe(false);
      expect(event.hasFieldChanged('managementPort')).toBe(false);
    });

    it('should return false for non-existent field', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.hasFieldChanged('nonExistentField')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.hasFieldChanged('name')).toBe(true);
      expect(event.hasFieldChanged('Name')).toBe(false);
      expect(event.hasFieldChanged('NAME')).toBe(false);
    });
  });

  describe('getPreviousValue', () => {
    it('should return previous value for changed field', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.getPreviousValue('name')).toBe('OldRouter');
    });

    it('should return undefined for non-tracked field', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.getPreviousValue('description')).toBeUndefined();
    });

    it('should return null if previous value was null', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['description'],
        { description: null },
        { description: 'New description' }
      );

      expect(event.getPreviousValue('description')).toBeNull();
    });

    it('should return correct value for multiple fields', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name', 'managementPort'],
        { name: 'OldRouter', managementPort: 22 },
        { name: 'NewRouter', managementPort: 8080 }
      );

      expect(event.getPreviousValue('name')).toBe('OldRouter');
      expect(event.getPreviousValue('managementPort')).toBe(22);
    });

    it('should handle complex object values', () => {
      const previousConfig = { enabled: false, timeout: 30 };
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['config'],
        { config: previousConfig },
        { config: { enabled: true, timeout: 60 } }
      );

      expect(event.getPreviousValue('config')).toEqual(previousConfig);
    });
  });

  describe('getNewValue', () => {
    it('should return new value for changed field', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.getNewValue('name')).toBe('NewRouter');
    });

    it('should return undefined for non-tracked field', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.getNewValue('description')).toBeUndefined();
    });

    it('should return null if new value is null', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['description'],
        { description: 'Old description' },
        { description: null }
      );

      expect(event.getNewValue('description')).toBeNull();
    });

    it('should return correct value for multiple fields', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name', 'managementPort'],
        { name: 'OldRouter', managementPort: 22 },
        { name: 'NewRouter', managementPort: 8080 }
      );

      expect(event.getNewValue('name')).toBe('NewRouter');
      expect(event.getNewValue('managementPort')).toBe(8080);
    });

    it('should handle complex object values', () => {
      const newConfig = { enabled: true, timeout: 60 };
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['config'],
        { config: { enabled: false, timeout: 30 } },
        { config: newConfig }
      );

      expect(event.getNewValue('config')).toEqual(newConfig);
    });
  });

  describe('IDomainEvent interface', () => {
    it('should implement IDomainEvent interface', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.dateTimeOccurred).toBeDefined();
      expect(typeof event.getAggregateId).toBe('function');
    });

    it('should have dateTimeOccurred as a Date', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  describe('property immutability', () => {
    it('should have readonly deviceName', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should have readonly changedFields', () => {
      const changedFields = ['name', 'description'];
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        changedFields,
        { name: 'OldRouter', description: 'Old desc' },
        { name: 'NewRouter', description: 'New desc' }
      );

      expect(event.changedFields).toEqual(changedFields);
    });

    it('should have readonly previousValues', () => {
      const previousValues = { name: 'OldRouter' };
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        previousValues,
        { name: 'NewRouter' }
      );

      expect(event.previousValues).toEqual(previousValues);
    });

    it('should have readonly newValues', () => {
      const newValues = { name: 'NewRouter' };
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        newValues
      );

      expect(event.newValues).toEqual(newValues);
    });
  });

  describe('update scenarios', () => {
    it('should represent name change', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        'Router-New',
        ['name'],
        { name: 'Router-Old' },
        { name: 'Router-New' }
      );

      expect(event.hasFieldChanged('name')).toBe(true);
      expect(event.getPreviousValue('name')).toBe('Router-Old');
      expect(event.getNewValue('name')).toBe('Router-New');
    });

    it('should represent description update', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['description'],
        { description: 'Old description text' },
        { description: 'New description text' }
      );

      expect(event.hasFieldChanged('description')).toBe(true);
      expect(event.getPreviousValue('description')).toBe(
        'Old description text'
      );
      expect(event.getNewValue('description')).toBe('New description text');
    });

    it('should represent management configuration change', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['managementPort', 'managementProtocol'],
        { managementPort: 22, managementProtocol: 'ssh' },
        { managementPort: 8080, managementProtocol: 'https' }
      );

      expect(event.hasFieldChanged('managementPort')).toBe(true);
      expect(event.hasFieldChanged('managementProtocol')).toBe(true);
      expect(event.getPreviousValue('managementPort')).toBe(22);
      expect(event.getNewValue('managementPort')).toBe(8080);
      expect(event.getPreviousValue('managementProtocol')).toBe('ssh');
      expect(event.getNewValue('managementProtocol')).toBe('https');
    });

    it('should represent multiple field update', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        'UpdatedRouter',
        ['name', 'description', 'managementPort'],
        {
          name: 'OldRouter',
          description: 'Old desc',
          managementPort: 22
        },
        {
          name: 'UpdatedRouter',
          description: 'New desc',
          managementPort: 443
        }
      );

      expect(event.changedFields).toHaveLength(3);
      expect(event.hasFieldChanged('name')).toBe(true);
      expect(event.hasFieldChanged('description')).toBe(true);
      expect(event.hasFieldChanged('managementPort')).toBe(true);
    });

    it('should capture audit context for update', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        'Production-Router',
        ['name'],
        { name: 'Dev-Router' },
        { name: 'Production-Router' }
      );

      expect(event.getAggregateId()).toBeDefined();
      expect(event.deviceName).toBe('Production-Router');
      expect(event.changedFields).toBeDefined();
      expect(event.previousValues).toBeDefined();
      expect(event.newValues).toBeDefined();
      expect(event.dateTimeOccurred).toBeDefined();
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new NetworkDeviceUpdatedEvent(
        aggregateId,
        'Device-1',
        ['name'],
        { name: 'Old-Device-1' },
        { name: 'Device-1' }
      );

      const event2 = new NetworkDeviceUpdatedEvent(
        aggregateId,
        'Device-2',
        ['description'],
        { description: 'Old description' },
        { description: 'New description' }
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.changedFields).not.toEqual(event2.changedFields);
    });

    it('should have different timestamps for events created at different times', async () => {
      const event1 = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event2 = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['description'],
        { description: 'Old desc' },
        { description: 'New desc' }
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty changedFields array', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        [],
        {},
        {}
      );

      expect(event.changedFields).toEqual([]);
      expect(event.hasFieldChanged('name')).toBe(false);
    });

    it('should handle empty device name', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        '',
        ['name'],
        { name: 'OldRouter' },
        { name: '' }
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle very long field names', () => {
      const longFieldName = 'x'.repeat(250);
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        [longFieldName],
        { [longFieldName]: 'old value' },
        { [longFieldName]: 'new value' }
      );

      expect(event.hasFieldChanged(longFieldName)).toBe(true);
      expect(event.getPreviousValue(longFieldName)).toBe('old value');
      expect(event.getNewValue(longFieldName)).toBe('new value');
    });

    it('should handle special characters in field names', () => {
      const specialField = 'field-with_special.chars';
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        [specialField],
        { [specialField]: 'old' },
        { [specialField]: 'new' }
      );

      expect(event.hasFieldChanged(specialField)).toBe(true);
    });

    it('should handle null values in previousValues', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['description'],
        { description: null },
        { description: 'Now has description' }
      );

      expect(event.getPreviousValue('description')).toBeNull();
      expect(event.getNewValue('description')).toBe('Now has description');
    });

    it('should handle null values in newValues', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['description'],
        { description: 'Had description' },
        { description: null }
      );

      expect(event.getPreviousValue('description')).toBe('Had description');
      expect(event.getNewValue('description')).toBeNull();
    });

    it('should handle boolean values', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['remoteAccessEnabled'],
        { remoteAccessEnabled: false },
        { remoteAccessEnabled: true }
      );

      expect(event.getPreviousValue('remoteAccessEnabled')).toBe(false);
      expect(event.getNewValue('remoteAccessEnabled')).toBe(true);
    });

    it('should handle numeric values', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['port'],
        { port: 0 },
        { port: 8080 }
      );

      expect(event.getPreviousValue('port')).toBe(0);
      expect(event.getNewValue('port')).toBe(8080);
    });

    it('should handle array values', () => {
      const oldTags = ['production', 'critical'];
      const newTags = ['production', 'critical', 'monitoring'];
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['tags'],
        { tags: oldTags },
        { tags: newTags }
      );

      expect(event.getPreviousValue('tags')).toEqual(oldTags);
      expect(event.getNewValue('tags')).toEqual(newTags);
    });
  });

  describe('timestamp accuracy', () => {
    it('should capture update time accurately', () => {
      const now = Date.now();
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      const timeDiff = event.dateTimeOccurred.getTime() - now;

      // Should be created within 100ms
      expect(timeDiff).toBeGreaterThanOrEqual(0);
      expect(timeDiff).toBeLessThan(100);
    });

    it('should have consistent timestamp', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'OldRouter' },
        { name: 'NewRouter' }
      );

      const time1 = event.dateTimeOccurred.getTime();
      const time2 = event.dateTimeOccurred.getTime();

      expect(time1).toBe(time2);
    });
  });

  describe('change tracking', () => {
    it('should track single property change', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name'],
        { name: 'Router-A' },
        { name: 'Router-B' }
      );

      expect(event.changedFields.length).toBe(1);
      expect(event.changedFields[0]).toBe('name');
    });

    it('should track multiple property changes', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name', 'description', 'managementPort'],
        {
          name: 'Router-A',
          description: 'Old',
          managementPort: 22
        },
        {
          name: 'Router-B',
          description: 'New',
          managementPort: 8080
        }
      );

      expect(event.changedFields.length).toBe(3);
      expect(event.changedFields).toContain('name');
      expect(event.changedFields).toContain('description');
      expect(event.changedFields).toContain('managementPort');
    });

    it('should allow querying all changed fields', () => {
      const event = new NetworkDeviceUpdatedEvent(
        aggregateId,
        deviceName,
        ['name', 'description'],
        { name: 'Router-A', description: 'Old' },
        { name: 'Router-B', description: 'New' }
      );

      const changes = event.changedFields.map((field) => ({
        field,
        previous: event.getPreviousValue(field),
        new: event.getNewValue(field)
      }));

      expect(changes).toHaveLength(2);
      expect(changes[0]).toEqual({
        field: 'name',
        previous: 'Router-A',
        new: 'Router-B'
      });
      expect(changes[1]).toEqual({
        field: 'description',
        previous: 'Old',
        new: 'New'
      });
    });
  });
});
