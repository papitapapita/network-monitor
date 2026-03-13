import {
  NetworkDeviceUpdatedEvent,
  NetworkDeviceUpdatedEventProps,
  NetworkDeviceId
} from '../../../src/domain/device-inventory';

describe('NetworkDeviceUpdatedEvent', () => {
  let aggregateId: NetworkDeviceId;
  const deviceName = 'Router-01';
  const changedFields = ['name', 'description'];
  const previousValues = {
    name: 'Old-Router',
    description: 'Old description'
  };
  const newValues = {
    name: 'Router-01',
    description: 'Updated router'
  };
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<NetworkDeviceUpdatedEventProps>
  ): NetworkDeviceUpdatedEventProps => ({
    aggregateId,
    deviceName,
    changedFields,
    previousValues,
    newValues,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event).toBeDefined();
      expect(event.deviceName).toBe(deviceName);
      expect(event.changedFields).toEqual(changedFields);
      expect(event.previousValues).toEqual(previousValues);
      expect(event.newValues).toEqual(newValues);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new NetworkDeviceUpdatedEvent(props);

      // Modify original props object
      (props as any).deviceName = 'Modified';

      // Event should not be affected
      expect(event.deviceName).toBe(deviceName);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBe(aggregateId);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(NetworkDeviceId);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  describe('property getters', () => {
    it('should return deviceName', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.deviceName).toBe(deviceName);
    });

    it('should return changedFields', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.changedFields).toEqual(changedFields);
    });

    it('should return previousValues', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.previousValues).toEqual(previousValues);
    });

    it('should return newValues', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.newValues).toEqual(newValues);
    });
  });

  describe('hasFieldChanged', () => {
    it('should return true for changed fields', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.hasFieldChanged('name')).toBe(true);
      expect(event.hasFieldChanged('description')).toBe(true);
    });

    it('should return false for unchanged fields', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.hasFieldChanged('ipAddress')).toBe(false);
      expect(event.hasFieldChanged('macAddress')).toBe(false);
    });

    it('should be case sensitive', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.hasFieldChanged('Name')).toBe(false);
      expect(event.hasFieldChanged('name')).toBe(true);
    });
  });

  describe('getPreviousValue', () => {
    it('should return the previous value of a field', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.getPreviousValue('name')).toBe('Old-Router');
      expect(event.getPreviousValue('description')).toBe(
        'Old description'
      );
    });

    it('should return undefined for non-existent fields', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.getPreviousValue('nonExistent')).toBeUndefined();
    });

    it('should handle null values', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['description'],
          previousValues: { description: null },
          newValues: { description: 'New description' }
        })
      );

      expect(event.getPreviousValue('description')).toBeNull();
    });
  });

  describe('getNewValue', () => {
    it('should return the new value of a field', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.getNewValue('name')).toBe('Router-01');
      expect(event.getNewValue('description')).toBe('Updated router');
    });

    it('should return undefined for non-existent fields', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      expect(event.getNewValue('nonExistent')).toBeUndefined();
    });

    it('should handle null values', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['description'],
          previousValues: { description: 'Old description' },
          newValues: { description: null }
        })
      );

      expect(event.getNewValue('description')).toBeNull();
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      const str = event.toString();

      expect(str).toContain('NetworkDeviceUpdatedEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should return consistent string on multiple calls', () => {
      const event = new NetworkDeviceUpdatedEvent(createEventProps());

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('edge cases', () => {
    it('should handle single field change', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['name'],
          previousValues: { name: 'Old' },
          newValues: { name: 'New' }
        })
      );

      expect(event.changedFields).toEqual(['name']);
      expect(event.hasFieldChanged('name')).toBe(true);
    });

    it('should handle multiple field changes', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['name', 'ip', 'mac', 'description'],
          previousValues: {
            name: 'Old',
            ip: '192.168.1.1',
            mac: 'AA:BB:CC:DD:EE:FF',
            description: 'Old desc'
          },
          newValues: {
            name: 'New',
            ip: '192.168.1.2',
            mac: '11:22:33:44:55:66',
            description: 'New desc'
          }
        })
      );

      expect(event.changedFields.length).toBe(4);
      expect(event.hasFieldChanged('name')).toBe(true);
      expect(event.hasFieldChanged('ip')).toBe(true);
      expect(event.hasFieldChanged('mac')).toBe(true);
      expect(event.hasFieldChanged('description')).toBe(true);
    });

    it('should handle empty changed fields array', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: [],
          previousValues: {},
          newValues: {}
        })
      );

      expect(event.changedFields).toEqual([]);
      expect(event.hasFieldChanged('anything')).toBe(false);
    });

    it('should handle complex previous and new values', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['config'],
          previousValues: {
            config: { enabled: false, timeout: 30 }
          },
          newValues: {
            config: { enabled: true, timeout: 60 }
          }
        })
      );

      expect(event.getPreviousValue('config')).toEqual({
        enabled: false,
        timeout: 30
      });
      expect(event.getNewValue('config')).toEqual({
        enabled: true,
        timeout: 60
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should represent device name change', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['name'],
          previousValues: { name: 'Router-Old' },
          newValues: { name: 'Router-New' }
        })
      );

      expect(event.hasFieldChanged('name')).toBe(true);
      expect(event.getPreviousValue('name')).toBe('Router-Old');
      expect(event.getNewValue('name')).toBe('Router-New');
    });

    it('should represent IP address change', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['ipAddress'],
          previousValues: { ipAddress: '192.168.1.1' },
          newValues: { ipAddress: '192.168.1.100' }
        })
      );

      expect(event.hasFieldChanged('ipAddress')).toBe(true);
      expect(event.getPreviousValue('ipAddress')).toBe('192.168.1.1');
      expect(event.getNewValue('ipAddress')).toBe('192.168.1.100');
    });

    it('should represent description update', () => {
      const event = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['description'],
          previousValues: {
            description: 'Main office router'
          },
          newValues: {
            description: 'Main office router - upgraded firmware'
          }
        })
      );

      expect(event.hasFieldChanged('description')).toBe(true);
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['name'],
          previousValues: { name: 'Device1-Old' },
          newValues: { name: 'Device1-New' }
        })
      );

      const event2 = new NetworkDeviceUpdatedEvent(
        createEventProps({
          changedFields: ['ipAddress'],
          previousValues: { ipAddress: '192.168.1.1' },
          newValues: { ipAddress: '192.168.1.2' }
        })
      );

      expect(event1.changedFields).not.toEqual(event2.changedFields);
      expect(event1.hasFieldChanged('name')).toBe(true);
      expect(event2.hasFieldChanged('ipAddress')).toBe(true);
    });
  });
});
