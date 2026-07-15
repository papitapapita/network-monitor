// Source: src/domain/device-inventory/events/DeviceDetailsUpdatedEvent.ts

import {
  DeviceDetailsUpdatedEvent,
  DeviceDetailsUpdatedEventProps,
  DeviceName,
  DeviceCategory,
  SerialNumber,
  DeviceOwnerType
} from '../../../../src/domain/device-inventory';
import {
  DeviceId,
  UniqueEntityID,
  MACAddress
} from '../../../../src/domain/shared';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeviceName(raw = 'Core-Router-01'): DeviceName {
  return DeviceName.create(raw).value;
}

function makeSerialNumber(raw: string): SerialNumber {
  return SerialNumber.create(raw).value;
}

function makeEventProps(
  overrides?: Partial<DeviceDetailsUpdatedEventProps>
): DeviceDetailsUpdatedEventProps {
  return {
    aggregateId: DeviceId.create(),
    deviceName: makeDeviceName(),
    updatedFields: { name: makeDeviceName() },
    dateTimeOccurred: new Date('2024-06-01T10:00:00Z'),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
describe('DeviceDetailsUpdatedEvent', () => {
  let aggregateId: DeviceId;
  let deviceName: DeviceName;
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = DeviceId.create();
    deviceName = makeDeviceName('Core-Router-01');
    dateTimeOccurred = new Date('2024-06-01T10:00:00Z');
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const updatedName = makeDeviceName('New-Router-01');
      const props = makeEventProps({
        aggregateId,
        deviceName,
        updatedFields: { name: updatedName },
        dateTimeOccurred
      });
      const event = new DeviceDetailsUpdatedEvent(props);

      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceName).toBe(deviceName);
      expect(event.updatedFields.name).toBe(updatedName);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new DeviceDetailsUpdatedEvent(makeEventProps());

      expect(
        Object.isFrozen(
          (event as unknown as { props: unknown }).props
        )
      ).toBe(true);
    });

    it('should isolate event from external mutation of the original props object', () => {
      const props = makeEventProps({ aggregateId, deviceName });
      const event = new DeviceDetailsUpdatedEvent(props);

      (props as { deviceName: DeviceName }).deviceName =
        makeDeviceName('Mutated-Name');

      expect(event.deviceName.value).toBe('Core-Router-01');
    });

    it('should accept props with an empty updatedFields object', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ updatedFields: {} })
      );

      expect(event).toBeDefined();
      expect(event.updatedFields).toEqual({});
    });

    it('should accept props where every optional field is present simultaneously', () => {
      const updatedName = makeDeviceName('Full-Device');
      const category = DeviceCategory.createCpe();
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const ip = IPAddress.create('10.0.0.1').value;
      const installedDate = new Date('2023-01-01T00:00:00Z');
      const serialNumber = makeSerialNumber('SN-001');

      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({
          updatedFields: {
            name: updatedName,
            description: 'Updated description',
            category,
            serialNumber,
            macAddress: mac,
            ipAddress: ip,
            installedDate,
            ownerType: DeviceOwnerType.CLIENT
          }
        })
      );

      expect(event.updatedFields.name).toBe(updatedName);
      expect(event.updatedFields.description).toBe('Updated description');
      expect(event.updatedFields.category).toBe(category);
      expect(event.updatedFields.serialNumber).toBe(serialNumber);
      expect(event.updatedFields.macAddress).toBe(mac);
      expect(event.updatedFields.ipAddress).toBe(ip);
      expect(event.updatedFields.installedDate).toBe(installedDate);
      expect(event.updatedFields.ownerType).toBe(DeviceOwnerType.CLIENT);
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should not allow mutation of a top-level prop after construction', () => {
      const event = new DeviceDetailsUpdatedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as {
            props: { deviceName: DeviceName };
          }
        ).props.deviceName = makeDeviceName('Hacked');
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = new DeviceDetailsUpdatedEvent(makeEventProps());

      expect(() => {
        (
          event as unknown as { props: Record<string, unknown> }
        ).props.extra = 'value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      const event = new DeviceDetailsUpdatedEvent(makeEventProps());

      expect(() => {
        delete (
          event as unknown as { props: Record<string, unknown> }
        ).props.deviceName;
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the DeviceId provided at construction', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should be an instance of DeviceId', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(DeviceId);
    });

    it('should also satisfy the UniqueEntityID contract', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId).toBe(event.aggregateId);
    });

    it('should preserve the UUID value carried by the DeviceId', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId })
      );

      expect(event.aggregateId.toString()).toBe(aggregateId.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should be a Date instance', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ dateTimeOccurred })
      );

      expect(event.dateTimeOccurred).toBe(event.dateTimeOccurred);
    });

    it('should preserve the exact timestamp provided', () => {
      const specificDate = new Date('2025-12-25T00:00:00.000Z');
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ dateTimeOccurred: specificDate })
      );

      expect(event.dateTimeOccurred.toISOString()).toBe(
        '2025-12-25T00:00:00.000Z'
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceName getter', () => {
    it('should return the DeviceName provided at construction', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ deviceName })
      );

      expect(event.deviceName).toBe(deviceName);
    });

    it('should be an instance of DeviceName', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ deviceName })
      );

      expect(event.deviceName).toBeInstanceOf(DeviceName);
    });

    it('should expose the correct string value', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ deviceName: makeDeviceName('AP-Floor-3') })
      );

      expect(event.deviceName.value).toBe('AP-Floor-3');
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ deviceName })
      );

      expect(event.deviceName).toBe(event.deviceName);
    });
  });

  // -------------------------------------------------------------------------
  describe('updatedFields getter', () => {
    it('should return the updatedFields object provided at construction', () => {
      const updatedName = makeDeviceName('Switch-B1');
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ updatedFields: { name: updatedName } })
      );

      expect(event.updatedFields.name).toBe(updatedName);
    });

    it('should return the same reference on repeated reads', () => {
      const event = new DeviceDetailsUpdatedEvent(makeEventProps());

      expect(event.updatedFields).toBe(event.updatedFields);
    });

    // -- name field ----------------------------------------------------------
    describe('name field', () => {
      it('should carry the updated DeviceName when provided', () => {
        const updatedName = makeDeviceName('New-Name');
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { name: updatedName } })
        );

        expect(event.updatedFields.name).toBe(updatedName);
        expect(event.updatedFields.name?.value).toBe('New-Name');
      });

      it('should be undefined when name is not part of the update', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { description: 'desc' } })
        );

        expect(event.updatedFields.name).toBeUndefined();
      });
    });

    // -- description field ---------------------------------------------------
    describe('description field', () => {
      it('should carry a string description when provided', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({
            updatedFields: { description: 'Core router for building A' }
          })
        );

        expect(event.updatedFields.description).toBe(
          'Core router for building A'
        );
      });

      it('should carry null when description is explicitly cleared', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { description: null } })
        );

        expect(event.updatedFields.description).toBeNull();
      });

      it('should be undefined when description is not part of the update', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { name: makeDeviceName() } })
        );

        expect(event.updatedFields.description).toBeUndefined();
      });
    });

    // -- category field ------------------------------------------------------
    describe('category field', () => {
      it('should carry the updated DeviceCategory when provided', () => {
        const category = DeviceCategory.createAp();
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { category } })
        );

        expect(event.updatedFields.category).toBe(category);
        expect(event.updatedFields.category?.value).toBe('AP');
      });

      it('should carry null when category is explicitly cleared', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { category: null } })
        );

        expect(event.updatedFields.category).toBeNull();
      });

      it('should be undefined when category is not part of the update', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { description: 'desc' } })
        );

        expect(event.updatedFields.category).toBeUndefined();
      });

      it('should accept every valid category variant', () => {
        const categories = [
          DeviceCategory.createCpe(),
          DeviceCategory.createAp(),
          DeviceCategory.createRouterboard(),
          DeviceCategory.createSmartSwitch(),
          DeviceCategory.createSmartSwitchPoe(),
          DeviceCategory.createOther()
        ];

        for (const category of categories) {
          const event = new DeviceDetailsUpdatedEvent(
            makeEventProps({ updatedFields: { category } })
          );

          expect(event.updatedFields.category?.value).toBe(category.value);
        }
      });
    });

    // -- serialNumber field --------------------------------------------------
    describe('serialNumber field', () => {
      it('should carry the updated SerialNumber value object when provided', () => {
        const serialNumber = makeSerialNumber('SN-XYZ-789');
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { serialNumber } })
        );

        expect(event.updatedFields.serialNumber).toBe(serialNumber);
      });

      it('should carry null when serialNumber is explicitly cleared', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { serialNumber: null } })
        );

        expect(event.updatedFields.serialNumber).toBeNull();
      });

      it('should be undefined when serialNumber is not part of the update', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: {} })
        );

        expect(event.updatedFields.serialNumber).toBeUndefined();
      });
    });

    // -- macAddress field ----------------------------------------------------
    describe('macAddress field', () => {
      it('should carry the updated MACAddress value object when provided', () => {
        const mac = MACAddress.create('00:1A:2B:3C:4D:5E').value;
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { macAddress: mac } })
        );

        expect(event.updatedFields.macAddress).toBe(mac);
        expect(event.updatedFields.macAddress?.value).toBe(
          '00:1A:2B:3C:4D:5E'
        );
      });

      it('should carry null when macAddress is explicitly cleared', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { macAddress: null } })
        );

        expect(event.updatedFields.macAddress).toBeNull();
      });

      it('should be undefined when macAddress is not part of the update', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: {} })
        );

        expect(event.updatedFields.macAddress).toBeUndefined();
      });
    });

    // -- ipAddress field -----------------------------------------------------
    describe('ipAddress field', () => {
      it('should carry the updated IPv4 IPAddress value object when provided', () => {
        const ip = IPAddress.create('192.168.1.50').value;
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { ipAddress: ip } })
        );

        expect(event.updatedFields.ipAddress).toBe(ip);
        expect(event.updatedFields.ipAddress?.value).toBe('192.168.1.50');
        expect(event.updatedFields.ipAddress?.isIPv4()).toBe(true);
      });

      it('should carry the updated IPv6 IPAddress value object when provided', () => {
        const ip = IPAddress.create('2001:0db8:85a3::8a2e:0370:7334').value;
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { ipAddress: ip } })
        );

        expect(event.updatedFields.ipAddress?.isIPv6()).toBe(true);
      });

      it('should carry null when ipAddress is explicitly cleared', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { ipAddress: null } })
        );

        expect(event.updatedFields.ipAddress).toBeNull();
      });

      it('should be undefined when ipAddress is not part of the update', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: {} })
        );

        expect(event.updatedFields.ipAddress).toBeUndefined();
      });
    });

    // -- installedDate field -------------------------------------------------
    describe('installedDate field', () => {
      it('should carry the updated installed date when provided', () => {
        const installedDate = new Date('2022-03-15T08:00:00Z');
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { installedDate } })
        );

        expect(event.updatedFields.installedDate).toBe(installedDate);
      });

      it('should carry null when installedDate is explicitly cleared', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { installedDate: null } })
        );

        expect(event.updatedFields.installedDate).toBeNull();
      });

      it('should be undefined when installedDate is not part of the update', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: {} })
        );

        expect(event.updatedFields.installedDate).toBeUndefined();
      });
    });

    // -- ownerType field -----------------------------------------------------
    describe('ownerType field', () => {
      it('should carry COMPANY ownerType when provided', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({
            updatedFields: { ownerType: DeviceOwnerType.COMPANY }
          })
        );

        expect(event.updatedFields.ownerType).toBe(DeviceOwnerType.COMPANY);
      });

      it('should carry CLIENT ownerType when provided', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({
            updatedFields: { ownerType: DeviceOwnerType.CLIENT }
          })
        );

        expect(event.updatedFields.ownerType).toBe(DeviceOwnerType.CLIENT);
      });

      it('should be undefined when ownerType is not part of the update', () => {
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: {} })
        );

        expect(event.updatedFields.ownerType).toBeUndefined();
      });
    });

    // -- combinations of updatedFields ---------------------------------------
    describe('field combinations', () => {
      it('should handle a single-field update (name only)', () => {
        const updatedName = makeDeviceName('Single-Field');
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({ updatedFields: { name: updatedName } })
        );

        const fields = event.updatedFields;
        expect(fields.name).toBe(updatedName);
        expect(fields.description).toBeUndefined();
        expect(fields.category).toBeUndefined();
        expect(fields.serialNumber).toBeUndefined();
        expect(fields.macAddress).toBeUndefined();
        expect(fields.ipAddress).toBeUndefined();
        expect(fields.installedDate).toBeUndefined();
        expect(fields.ownerType).toBeUndefined();
      });

      it('should handle updating description and category simultaneously', () => {
        const category = DeviceCategory.createAp();
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({
            updatedFields: {
              description: 'New description',
              category
            }
          })
        );

        expect(event.updatedFields.description).toBe('New description');
        expect(event.updatedFields.category).toBe(category);
        expect(event.updatedFields.name).toBeUndefined();
      });

      it('should handle updating network configuration (mac and ip) simultaneously', () => {
        const mac = MACAddress.create('11:22:33:44:55:66').value;
        const ip = IPAddress.create('172.16.0.1').value;
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({
            updatedFields: { macAddress: mac, ipAddress: ip }
          })
        );

        expect(event.updatedFields.macAddress).toBe(mac);
        expect(event.updatedFields.ipAddress).toBe(ip);
      });

      it('should handle a mixed null-clearance and new-value update', () => {
        const updatedName = makeDeviceName('Renamed-Device');
        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({
            updatedFields: {
              name: updatedName,
              description: null,
              category: null,
              serialNumber: null,
              macAddress: null,
              ipAddress: null,
              installedDate: null
            }
          })
        );

        expect(event.updatedFields.name).toBe(updatedName);
        expect(event.updatedFields.description).toBeNull();
        expect(event.updatedFields.category).toBeNull();
        expect(event.updatedFields.serialNumber).toBeNull();
        expect(event.updatedFields.macAddress).toBeNull();
        expect(event.updatedFields.ipAddress).toBeNull();
        expect(event.updatedFields.installedDate).toBeNull();
        expect(event.updatedFields.ownerType).toBeUndefined();
      });

      it('should handle updating all fields at once', () => {
        const updatedName = makeDeviceName('Full-Update-Device');
        const category = DeviceCategory.createSmartSwitchPoe();
        const mac = MACAddress.create('FF:EE:DD:CC:BB:AA').value;
        const ip = IPAddress.create('10.10.10.10').value;
        const installedDate = new Date('2021-07-04T12:00:00Z');
        const serialNumber = makeSerialNumber('SN-FULL-001');

        const event = new DeviceDetailsUpdatedEvent(
          makeEventProps({
            updatedFields: {
              name: updatedName,
              description: 'Complete update',
              category,
              serialNumber,
              macAddress: mac,
              ipAddress: ip,
              installedDate,
              ownerType: DeviceOwnerType.COMPANY
            }
          })
        );

        expect(event.updatedFields.name).toBe(updatedName);
        expect(event.updatedFields.description).toBe('Complete update');
        expect(event.updatedFields.category).toBe(category);
        expect(event.updatedFields.serialNumber).toBe(serialNumber);
        expect(event.updatedFields.macAddress).toBe(mac);
        expect(event.updatedFields.ipAddress).toBe(ip);
        expect(event.updatedFields.installedDate).toBe(installedDate);
        expect(event.updatedFields.ownerType).toBe(DeviceOwnerType.COMPANY);
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('toString() — inherited from DomainEvent', () => {
    it('should contain the event class name', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain('DeviceDetailsUpdatedEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toContain(dateTimeOccurred.toISOString());
    });

    it('should return a consistent string across multiple calls', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ aggregateId, dateTimeOccurred })
      );

      expect(event.toString()).toBe(event.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events created from different props', () => {
      const id1 = DeviceId.create();
      const id2 = DeviceId.create();
      const name1 = makeDeviceName('Device-A');
      const name2 = makeDeviceName('Device-B');

      const event1 = new DeviceDetailsUpdatedEvent(
        makeEventProps({
          aggregateId: id1,
          deviceName: name1,
          updatedFields: { description: 'Description A' }
        })
      );

      const event2 = new DeviceDetailsUpdatedEvent(
        makeEventProps({
          aggregateId: id2,
          deviceName: name2,
          updatedFields: { description: 'Description B' }
        })
      );

      expect(event1.aggregateId.toString()).not.toBe(
        event2.aggregateId.toString()
      );
      expect(event1.deviceName.value).not.toBe(event2.deviceName.value);
      expect(event1.updatedFields.description).not.toBe(
        event2.updatedFields.description
      );
    });

    it('should have different timestamps when created with different dates', () => {
      const earlier = new Date('2024-01-01T00:00:00Z');
      const later = new Date('2024-12-31T23:59:59Z');

      const event1 = new DeviceDetailsUpdatedEvent(
        makeEventProps({ dateTimeOccurred: earlier })
      );
      const event2 = new DeviceDetailsUpdatedEvent(
        makeEventProps({ dateTimeOccurred: later })
      );

      expect(event2.dateTimeOccurred.getTime()).toBeGreaterThan(
        event1.dateTimeOccurred.getTime()
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('real-world scenarios', () => {
    it('should represent a device rename with no other changes', () => {
      const oldName = makeDeviceName('Office-AP-1');
      const newName = makeDeviceName('HQ-AP-Floor1');

      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({
          deviceName: oldName,
          updatedFields: { name: newName }
        })
      );

      expect(event.deviceName.value).toBe('Office-AP-1');
      expect(event.updatedFields.name?.value).toBe('HQ-AP-Floor1');
      expect(event.updatedFields.description).toBeUndefined();
    });

    it('should represent replacing a MAC address after NIC swap', () => {
      const newMac = MACAddress.create('AA:BB:CC:00:11:22').value;

      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({
          updatedFields: { macAddress: newMac }
        })
      );

      expect(event.updatedFields.macAddress?.value).toBe(
        'AA:BB:CC:00:11:22'
      );
    });

    it('should represent reclassifying a device category', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({
          updatedFields: { category: DeviceCategory.createCpe() }
        })
      );

      expect(event.updatedFields.category?.isCpe()).toBe(true);
    });

    it('should represent ownership transfer from COMPANY to CLIENT', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({
          updatedFields: { ownerType: DeviceOwnerType.CLIENT }
        })
      );

      expect(event.updatedFields.ownerType).toBe(DeviceOwnerType.CLIENT);
    });

    it('should represent clearing an installation date', () => {
      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({ updatedFields: { installedDate: null } })
      );

      expect(event.updatedFields.installedDate).toBeNull();
    });

    it('should represent a bulk network-reconfiguration update', () => {
      const newIp = IPAddress.create('192.168.100.5').value;
      const newMac = MACAddress.create('DE:AD:BE:EF:00:01').value;

      const event = new DeviceDetailsUpdatedEvent(
        makeEventProps({
          updatedFields: {
            ipAddress: newIp,
            macAddress: newMac,
            description: 'Re-patched to VLAN 100'
          }
        })
      );

      expect(event.updatedFields.ipAddress?.value).toBe('192.168.100.5');
      expect(event.updatedFields.macAddress?.value).toBe(
        'DE:AD:BE:EF:00:01'
      );
      expect(event.updatedFields.description).toBe(
        'Re-patched to VLAN 100'
      );
    });
  });
});
