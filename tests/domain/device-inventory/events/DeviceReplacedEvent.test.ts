import {
  DeviceReplacedEvent,
  DeviceReplacedEventProps,
  NetworkDeviceId,
  UniqueEntityID,
  IPAddress,
  MACAddress
} from '../../../src/domain/device-inventory';

describe('DeviceReplacedEvent', () => {
  let oldDeviceId: NetworkDeviceId;
  let newDeviceId: NetworkDeviceId;
  let ipAddress: IPAddress;
  let oldMacAddress: MACAddress;
  let newMacAddress: MACAddress;
  const replacedBy = 'admin-user-123';
  let dateTimeOccurred: Date;

  beforeEach(() => {
    oldDeviceId = NetworkDeviceId.create().value;
    newDeviceId = NetworkDeviceId.create().value;
    ipAddress = IPAddress.create('192.168.1.100').value;
    oldMacAddress = MACAddress.create('00:1A:2B:3C:4D:5E').value;
    newMacAddress = MACAddress.create('00:1A:2B:3C:4D:5F').value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<DeviceReplacedEventProps>
  ): DeviceReplacedEventProps => ({
    oldDeviceId,
    newDeviceId,
    ipAddress,
    oldMacAddress,
    newMacAddress,
    configMigrated: true,
    metadataMigrated: true,
    replacedBy,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event).toBeDefined();
      expect(event.oldDeviceId).toBe(oldDeviceId);
      expect(event.newDeviceId).toBe(newDeviceId);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.oldMacAddress).toBe(oldMacAddress);
      expect(event.oldMacAddress).toBeInstanceOf(MACAddress);
      expect(event.newMacAddress).toBe(newMacAddress);
      expect(event.newMacAddress).toBeInstanceOf(MACAddress);
      expect(event.configMigrated).toBe(true);
      expect(event.metadataMigrated).toBe(true);
      expect(event.replacedBy).toBe(replacedBy);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props to prevent external mutation', () => {
      const props = createEventProps();
      const event = new DeviceReplacedEvent(props);

      // Modify original props object
      (props as any).replacedBy = 'Modified';

      // Event should not be affected
      expect(event.replacedBy).toBe(replacedBy);
    });

    it('should accept different configMigrated and metadataMigrated combinations', () => {
      const combinations = [
        { configMigrated: true, metadataMigrated: true },
        { configMigrated: true, metadataMigrated: false },
        { configMigrated: false, metadataMigrated: true },
        { configMigrated: false, metadataMigrated: false }
      ];

      combinations.forEach((combo) => {
        const event = new DeviceReplacedEvent(
          createEventProps(combo)
        );

        expect(event.configMigrated).toBe(combo.configMigrated);
        expect(event.metadataMigrated).toBe(combo.metadataMigrated);
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
        const event = new DeviceReplacedEvent(
          createEventProps({ ipAddress: ipVO })
        );

        expect(event.ipAddress).toBe(ipVO);
        expect(event.ipAddress.value).toBe(ip);
      });
    });

    it('should accept different MAC address pairs', () => {
      const macPairs = [
        { old: '00:1A:2B:3C:4D:5E', new: '00:1A:2B:3C:4D:5F' },
        { old: 'AA:BB:CC:DD:EE:FF', new: '11:22:33:44:55:66' },
        { old: 'FF:FF:FF:FF:FF:FE', new: 'FF:FF:FF:FF:FF:FF' }
      ];

      macPairs.forEach((pair) => {
        const oldMac = MACAddress.create(pair.old).value;
        const newMac = MACAddress.create(pair.new).value;
        const event = new DeviceReplacedEvent(
          createEventProps({
            oldMacAddress: oldMac,
            newMacAddress: newMac
          })
        );

        expect(event.oldMacAddress.value).toBe(
          pair.old.toUpperCase()
        );
        expect(event.newMacAddress.value).toBe(
          pair.new.toUpperCase()
        );
      });
    });

    it('should accept different replacedBy user IDs', () => {
      const userIds = [
        'user-123',
        'admin-456',
        'system:migration',
        'tech-789'
      ];

      userIds.forEach((userId) => {
        const event = new DeviceReplacedEvent(
          createEventProps({ replacedBy: userId })
        );

        expect(event.replacedBy).toBe(userId);
      });
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(() => {
        (event as any).props.replacedBy = 'Modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(() => {
        (event as any).props.newProperty = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(() => {
        delete (event as any).props.replacedBy;
      }).toThrow();
    });
  });

  describe('aggregateId', () => {
    it('should return the newDeviceId as aggregateId', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBe(newDeviceId);
    });

    it('should return an instance of UniqueEntityID', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return NetworkDeviceId type', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const id = event.aggregateId;

      expect(id).toBeInstanceOf(NetworkDeviceId);
    });

    it('should return the same ID on multiple calls', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const id1 = event.aggregateId;
      const id2 = event.aggregateId;

      expect(id1).toBe(id2);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the provided dateTimeOccurred', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should return a Date instance', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same date on multiple calls', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const date1 = event.dateTimeOccurred;
      const date2 = event.dateTimeOccurred;

      expect(date1).toBe(date2);
    });
  });

  describe('property getters', () => {
    it('should return oldDeviceId', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event.oldDeviceId).toBe(oldDeviceId);
      expect(event.oldDeviceId).toBeInstanceOf(NetworkDeviceId);
    });

    it('should return newDeviceId', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event.newDeviceId).toBe(newDeviceId);
      expect(event.newDeviceId).toBeInstanceOf(NetworkDeviceId);
    });

    it('should return ipAddress value object', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.ipAddress.value).toBe('192.168.1.100');
    });

    it('should return oldMacAddress value object', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event.oldMacAddress).toBe(oldMacAddress);
      expect(event.oldMacAddress).toBeInstanceOf(MACAddress);
      expect(event.oldMacAddress.value).toBe('00:1A:2B:3C:4D:5E');
    });

    it('should return newMacAddress value object', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event.newMacAddress).toBe(newMacAddress);
      expect(event.newMacAddress).toBeInstanceOf(MACAddress);
      expect(event.newMacAddress.value).toBe('00:1A:2B:3C:4D:5F');
    });

    it('should return configMigrated boolean', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({ configMigrated: true })
      );

      expect(event.configMigrated).toBe(true);
      expect(typeof event.configMigrated).toBe('boolean');
    });

    it('should return metadataMigrated boolean', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({ metadataMigrated: false })
      );

      expect(event.metadataMigrated).toBe(false);
      expect(typeof event.metadataMigrated).toBe('boolean');
    });

    it('should return replacedBy string', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      expect(event.replacedBy).toBe(replacedBy);
      expect(typeof event.replacedBy).toBe('string');
    });

    it('should return consistent values on multiple reads', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const oldId1 = event.oldDeviceId;
      const oldId2 = event.oldDeviceId;
      const newId1 = event.newDeviceId;
      const newId2 = event.newDeviceId;
      const ip1 = event.ipAddress;
      const ip2 = event.ipAddress;
      const oldMac1 = event.oldMacAddress;
      const oldMac2 = event.oldMacAddress;
      const newMac1 = event.newMacAddress;
      const newMac2 = event.newMacAddress;

      expect(oldId1).toBe(oldId2);
      expect(newId1).toBe(newId2);
      expect(ip1).toBe(ip2);
      expect(oldMac1).toBe(oldMac2);
      expect(newMac1).toBe(newMac2);
    });
  });

  describe('getReplacementMessage', () => {
    it('should return formatted replacement message', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const message = event.getReplacementMessage();

      expect(message).toContain('192.168.1.100');
      expect(message).toContain('00:1A:2B:3C:4D:5E');
      expect(message).toContain('00:1A:2B:3C:4D:5F');
      expect(message).toContain('admin-user-123');
      expect(message).toContain('replaced');
    });

    it('should include arrow notation for MAC address transition', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const message = event.getReplacementMessage();

      expect(message).toContain('→');
      expect(message).toMatch(
        /00:1A:2B:3C:4D:5E.*→.*00:1A:2B:3C:4D:5F/
      );
    });

    it('should return consistent message on multiple calls', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const message1 = event.getReplacementMessage();
      const message2 = event.getReplacementMessage();

      expect(message1).toBe(message2);
    });

    it('should handle different IP addresses in message', () => {
      const ip = IPAddress.create('10.0.0.1').value;
      const event = new DeviceReplacedEvent(
        createEventProps({ ipAddress: ip })
      );

      const message = event.getReplacementMessage();

      expect(message).toContain('10.0.0.1');
    });

    it('should handle different user IDs in message', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({ replacedBy: 'system:auto-migration' })
      );

      const message = event.getReplacementMessage();

      expect(message).toContain('system:auto-migration');
    });
  });

  describe('wasMigrated', () => {
    it('should return true when both config and metadata migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: true,
          metadataMigrated: true
        })
      );

      expect(event.wasMigrated()).toBe(true);
    });

    it('should return true when only config migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: true,
          metadataMigrated: false
        })
      );

      expect(event.wasMigrated()).toBe(true);
    });

    it('should return true when only metadata migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: false,
          metadataMigrated: true
        })
      );

      expect(event.wasMigrated()).toBe(true);
    });

    it('should return false when neither migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: false,
          metadataMigrated: false
        })
      );

      expect(event.wasMigrated()).toBe(false);
    });
  });

  describe('getMigrationSummary', () => {
    it('should return summary with checkmarks when both migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: true,
          metadataMigrated: true
        })
      );

      const summary = event.getMigrationSummary();

      expect(summary).toContain('Configuration: ✓ Migrated');
      expect(summary).toContain('Metadata: ✓ Migrated');
      expect(summary).toContain('|');
    });

    it('should return summary with X marks when neither migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: false,
          metadataMigrated: false
        })
      );

      const summary = event.getMigrationSummary();

      expect(summary).toContain('Configuration: ✗ Not Migrated');
      expect(summary).toContain('Metadata: ✗ Not Migrated');
    });

    it('should return mixed summary when only config migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: true,
          metadataMigrated: false
        })
      );

      const summary = event.getMigrationSummary();

      expect(summary).toContain('Configuration: ✓ Migrated');
      expect(summary).toContain('Metadata: ✗ Not Migrated');
    });

    it('should return mixed summary when only metadata migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: false,
          metadataMigrated: true
        })
      );

      const summary = event.getMigrationSummary();

      expect(summary).toContain('Configuration: ✗ Not Migrated');
      expect(summary).toContain('Metadata: ✓ Migrated');
    });

    it('should return consistent summary on multiple calls', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const summary1 = event.getMigrationSummary();
      const summary2 = event.getMigrationSummary();

      expect(summary1).toBe(summary2);
    });
  });

  describe('isFullyMigrated', () => {
    it('should return true when both config and metadata migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: true,
          metadataMigrated: true
        })
      );

      expect(event.isFullyMigrated()).toBe(true);
    });

    it('should return false when only config migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: true,
          metadataMigrated: false
        })
      );

      expect(event.isFullyMigrated()).toBe(false);
    });

    it('should return false when only metadata migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: false,
          metadataMigrated: true
        })
      );

      expect(event.isFullyMigrated()).toBe(false);
    });

    it('should return false when neither migrated', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: false,
          metadataMigrated: false
        })
      );

      expect(event.isFullyMigrated()).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const str = event.toString();

      expect(str).toContain('DeviceReplacedEvent');
      expect(str).toContain(newDeviceId.toString());
      expect(str).toContain(dateTimeOccurred.toISOString());
    });

    it('should include event name in string', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const str = event.toString();

      expect(str).toMatch(/DeviceReplacedEvent/);
    });

    it('should return consistent string on multiple calls', () => {
      const event = new DeviceReplacedEvent(createEventProps());

      const str1 = event.toString();
      const str2 = event.toString();

      expect(str1).toBe(str2);
    });
  });

  describe('value object integration', () => {
    it('should work with IPv4 addresses', () => {
      const ipv4 = IPAddress.create('10.0.0.1').value;
      const event = new DeviceReplacedEvent(
        createEventProps({ ipAddress: ipv4 })
      );

      expect(event.ipAddress).toBe(ipv4);
      expect(event.ipAddress.isIPv4()).toBe(true);
      expect(event.ipAddress.value).toBe('10.0.0.1');
    });

    it('should work with IPv6 addresses', () => {
      const ipv6 = IPAddress.create(
        '2001:0db8:85a3::8a2e:0370:7334'
      ).value;
      const event = new DeviceReplacedEvent(
        createEventProps({ ipAddress: ipv6 })
      );

      expect(event.ipAddress).toBe(ipv6);
      expect(event.ipAddress.isIPv6()).toBe(true);
    });

    it('should normalize MAC address formats', () => {
      const oldMac = MACAddress.create('aa-bb-cc-dd-ee-ff').value;
      const newMac = MACAddress.create('11:22:33:44:55:66').value;
      const event = new DeviceReplacedEvent(
        createEventProps({
          oldMacAddress: oldMac,
          newMacAddress: newMac
        })
      );

      expect(event.oldMacAddress.value).toBe('AA:BB:CC:DD:EE:FF');
      expect(event.newMacAddress.value).toBe('11:22:33:44:55:66');
    });

    it('should handle different device ID instances', () => {
      const oldId = NetworkDeviceId.create().value;
      const newId = NetworkDeviceId.create().value;
      const event = new DeviceReplacedEvent(
        createEventProps({
          oldDeviceId: oldId,
          newDeviceId: newId
        })
      );

      expect(event.oldDeviceId).toBe(oldId);
      expect(event.newDeviceId).toBe(newId);
      expect(event.oldDeviceId).not.toBe(event.newDeviceId);
    });
  });

  describe('real-world scenarios', () => {
    it('should represent hardware failure with full migration', () => {
      const oldMac = MACAddress.create('00:50:56:AA:BB:01').value;
      const newMac = MACAddress.create('00:50:56:AA:BB:02').value;
      const event = new DeviceReplacedEvent(
        createEventProps({
          oldMacAddress: oldMac,
          newMacAddress: newMac,
          configMigrated: true,
          metadataMigrated: true,
          replacedBy: 'tech-smith-789'
        })
      );

      expect(event.isFullyMigrated()).toBe(true);
      expect(event.getReplacementMessage()).toContain(
        'tech-smith-789'
      );
      expect(event.getMigrationSummary()).toContain('✓ Migrated');
    });

    it('should represent NIC replacement without metadata migration', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: true,
          metadataMigrated: false,
          replacedBy: 'system:auto-detect'
        })
      );

      expect(event.wasMigrated()).toBe(true);
      expect(event.isFullyMigrated()).toBe(false);
      expect(event.configMigrated).toBe(true);
      expect(event.metadataMigrated).toBe(false);
    });

    it('should represent device upgrade scenario', () => {
      const routerIP = IPAddress.create('10.100.1.1').value;
      const oldRouterMac = MACAddress.create(
        '00:1C:2E:3A:4B:5C'
      ).value;
      const newRouterMac = MACAddress.create(
        '00:1C:2E:3A:4B:6D'
      ).value;
      const event = new DeviceReplacedEvent(
        createEventProps({
          ipAddress: routerIP,
          oldMacAddress: oldRouterMac,
          newMacAddress: newRouterMac,
          configMigrated: true,
          metadataMigrated: true,
          replacedBy: 'admin-network-team'
        })
      );

      const message = event.getReplacementMessage();
      expect(message).toContain('10.100.1.1');
      expect(message).toContain('00:1C:2E:3A:4B:5C');
      expect(message).toContain('00:1C:2E:3A:4B:6D');
      expect(message).toContain('admin-network-team');
      expect(event.isFullyMigrated()).toBe(true);
    });

    it('should represent partial migration scenario', () => {
      const event = new DeviceReplacedEvent(
        createEventProps({
          configMigrated: false,
          metadataMigrated: true,
          replacedBy: 'admin-user-456'
        })
      );

      expect(event.wasMigrated()).toBe(true);
      expect(event.isFullyMigrated()).toBe(false);
      const summary = event.getMigrationSummary();
      expect(summary).toContain('Configuration: ✗ Not Migrated');
      expect(summary).toContain('Metadata: ✓ Migrated');
    });
  });

  describe('multiple event instances', () => {
    it('should create independent event instances', () => {
      const event1 = new DeviceReplacedEvent(
        createEventProps({
          replacedBy: 'user-1',
          configMigrated: true
        })
      );

      const event2 = new DeviceReplacedEvent(
        createEventProps({
          replacedBy: 'user-2',
          configMigrated: false
        })
      );

      expect(event1.replacedBy).not.toBe(event2.replacedBy);
      expect(event1.configMigrated).not.toBe(event2.configMigrated);
    });

    it('should have different timestamps for events created at different times', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T11:00:00Z');

      const event1 = new DeviceReplacedEvent(
        createEventProps({ dateTimeOccurred: date1 })
      );

      const event2 = new DeviceReplacedEvent(
        createEventProps({ dateTimeOccurred: date2 })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });
});
