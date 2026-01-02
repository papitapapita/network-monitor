import {
  PollingConfigurationChangedEvent,
  PollingConfigurationChangedEventProps,
  NetworkDeviceId,
  PollingConfigurationId
} from '../../../src/domain';

describe('PollingConfigurationChangedEvent', () => {
  let aggregateId: NetworkDeviceId;
  let pollingConfigurationId: PollingConfigurationId;
  const deviceName = 'Router-01';
  const changeDescription = 'Retry policy updated to 5 attempts';
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = PollingConfigurationId.create().value;
    pollingConfigurationId = NetworkDeviceId.create().value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<PollingConfigurationChangedEventProps>
  ): PollingConfigurationChangedEventProps => ({
    aggregateId,
    pollingConfigurationId,
    deviceName,
    changeDescription,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(event).toBeDefined();
      expect(event.pollingConfigurationId).toBe(
        pollingConfigurationId
      );
      expect(event.deviceName).toBe(deviceName);
      expect(event.changeDescription).toBe(changeDescription);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new PollingConfigurationChangedEvent(props);

      // Modify original props object
      (props as any).deviceName = 'Modified';

      // Event should not be affected
      expect(event.deviceName).toBe(deviceName);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(() => {
        delete (event as any).props.deviceName;
      }).toThrow();
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should return PollingConfigurationId type', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(event.aggregateId).toBeInstanceOf(
        PollingConfigurationId
      );
    });

    it('should return the same ID on multiple calls', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  describe('property getters', () => {
    it('should return pollingConfigurationId', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(event.pollingConfigurationId).toBe(
        pollingConfigurationId
      );
      expect(event.pollingConfigurationId).toBeInstanceOf(
        NetworkDeviceId
      );
    });

    it('should return deviceName', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should return changeDescription', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      expect(event.changeDescription).toBe(changeDescription);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      const str = event.toString();

      expect(str).toContain('PollingConfigurationChangedEvent');
      expect(str).toContain(aggregateId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should return consistent string on multiple calls', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps()
      );

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty device name', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: ''
        })
      );

      expect(event.deviceName).toBe('');
    });

    it('should handle empty change description', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          changeDescription: ''
        })
      );

      expect(event.changeDescription).toBe('');
    });

    it('should handle very long device names', () => {
      const longName = 'A'.repeat(255);
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: longName
        })
      );

      expect(event.deviceName).toBe(longName);
      expect(event.deviceName.length).toBe(255);
    });

    it('should handle very long change descriptions', () => {
      const longDescription = 'Configuration change: '.repeat(50);
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          changeDescription: longDescription
        })
      );

      expect(event.changeDescription).toBe(longDescription);
      expect(event.changeDescription.length).toBeGreaterThan(500);
    });

    it('should handle special characters in device name', () => {
      const specialName = 'Router-Main_01@Site#1';
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: specialName
        })
      );

      expect(event.deviceName).toBe(specialName);
    });

    it('should handle special characters in change description', () => {
      const specialDescription =
        'Config: retry@3->5, backoff#1.5->2.0, max$60->120';
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          changeDescription: specialDescription
        })
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
        createEventProps({
          changeDescription: multilineDescription
        })
      );

      expect(event.changeDescription).toContain('\n');
      expect(event.changeDescription.split('\n').length).toBe(4);
    });
  });

  describe('change description content', () => {
    it('should support detailed change descriptions', () => {
      const detailedDescription =
        'Configuration updated: retry policy changed from 3 to 5 attempts, ' +
        'backoff multiplier changed from 1.5 to 2.0, ' +
        'max backoff time changed from 60s to 120s';

      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          changeDescription: detailedDescription
        })
      );

      expect(event.changeDescription).toContain('retry policy');
      expect(event.changeDescription).toContain('backoff multiplier');
      expect(event.changeDescription).toContain('max backoff');
    });

    it('should support simple change descriptions', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          changeDescription: 'Enabled'
        })
      );

      expect(event.changeDescription).toBe('Enabled');
    });

    it('should support structured change descriptions', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          changeDescription:
            'Field: retryPolicy.maxAttempts, Old: 3, New: 5'
        })
      );

      expect(event.changeDescription).toContain('Field:');
      expect(event.changeDescription).toContain('Old:');
      expect(event.changeDescription).toContain('New:');
    });
  });

  describe('real-world scenarios', () => {
    it('should represent retry policy update', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Critical-Router',
          changeDescription:
            'Retry policy updated: maxAttempts changed from 3 to 5'
        })
      );

      expect(event.deviceName).toBe('Critical-Router');
      expect(event.changeDescription).toContain('Retry policy');
      expect(event.changeDescription).toContain('5');
    });

    it('should represent enabling polling', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Edge-Switch',
          changeDescription: 'Polling enabled for device'
        })
      );

      expect(event.changeDescription).toContain('enabled');
    });

    it('should represent disabling polling', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Maintenance-AP',
          changeDescription: 'Polling disabled for maintenance'
        })
      );

      expect(event.changeDescription).toContain('disabled');
      expect(event.changeDescription).toContain('maintenance');
    });

    it('should represent configuration reset', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Test-Device',
          changeDescription: 'Configuration reset to default values'
        })
      );

      expect(event.changeDescription).toContain('reset');
      expect(event.changeDescription).toContain('default');
    });

    it('should represent multiple configuration changes', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Core-Switch',
          changeDescription:
            'Multiple changes: retry policy (3->5), enabled state (false->true)'
        })
      );

      expect(event.changeDescription).toContain('Multiple changes');
      expect(event.changeDescription).toContain('retry policy');
      expect(event.changeDescription).toContain('enabled state');
    });

    it('should represent enabling device after maintenance', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Maintenance-Router',
          changeDescription:
            'Polling re-enabled after scheduled maintenance completion'
        })
      );

      expect(event.changeDescription).toContain('re-enabled');
      expect(event.changeDescription).toContain('maintenance');
    });

    it('should represent emergency polling suspension', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Critical-Switch',
          changeDescription:
            'Polling temporarily disabled due to network incident'
        })
      );

      expect(event.changeDescription).toContain('disabled');
      expect(event.changeDescription).toContain('incident');
    });

    it('should represent optimization changes', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Edge-Device',
          changeDescription:
            'Retry policy optimized: reduced attempts from 5 to 3 for faster failure detection'
        })
      );

      expect(event.changeDescription).toContain('optimized');
      expect(event.changeDescription).toContain('reduced');
    });

    it('should represent bulk configuration update', () => {
      const event = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Standard-AP',
          changeDescription:
            'Applied standard configuration template: retry=3, backoff=1.5, maxBackoff=60s'
        })
      );

      expect(event.changeDescription).toContain('template');
      expect(event.changeDescription).toContain('retry=3');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Device-1',
          changeDescription: 'Change 1'
        })
      );

      const event2 = new PollingConfigurationChangedEvent(
        createEventProps({
          deviceName: 'Device-2',
          changeDescription: 'Change 2'
        })
      );

      expect(event1.deviceName).not.toBe(event2.deviceName);
      expect(event1.changeDescription).not.toBe(
        event2.changeDescription
      );
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:01Z');

      const event1 = new PollingConfigurationChangedEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new PollingConfigurationChangedEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
