// Source: src/domain/device-inventory/aggregates/Device.ts

import {
  Device,
  DeviceName,
  DeviceStatus,
  DeviceCategory,
  SerialNumber,
  DeviceCreatedEvent,
  DeviceStatusChangedEvent,
  DeviceLocationAssignedEvent,
  DeviceMonitoringToggledEvent,
  DeviceDetailsUpdatedEvent,
  DeviceModelCorrectedEvent,
  DeviceOwnerType,
  DeviceProps
} from '../../../../src/domain/device-inventory';
import { IPAddress, MACAddress } from '../../../../src/domain/shared';
import {
  DeviceId,
  DeviceModelId,
  LocationId
} from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Mirrors what Device.create accepts: the timestamps and the tombstone/lineage
// fields are the aggregate's to set, never the caller's.
type CreateDeviceProps = Omit<
  DeviceProps,
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
  | 'deletedBy'
  | 'replacedAt'
  | 'replacesDeviceId'
  | 'replacedByDeviceId'
>;

/**
 * Default base props: INVENTORY status with a serialNumber so the
 * "INVENTORY/DAMAGED must have serial or MAC" invariant is satisfied.
 */
function makeProps(
  overrides: Partial<CreateDeviceProps> = {}
): CreateDeviceProps {
  return {
    deviceModelId: DeviceModelId.create(),
    name: DeviceName.create('Core-Router-01').value,
    status: DeviceStatus.createInventory(),
    ownerType: DeviceOwnerType.COMPANY,
    locationId: null,
    category: null,
    serialNumber: SerialNumber.create('SN-DEFAULT').value,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    monitoringEnabled: false,
    ...overrides
  };
}

function makeDevice(
  overrides: Partial<CreateDeviceProps> = {}
): Device {
  const result = Device.create(makeProps(overrides));
  if (result.isFailure) {
    throw new Error(`makeDevice: ${result.error}`);
  }
  return result.value;
}

/**
 * Same as makeProps(), but omits monitoringEnabled entirely so tests can
 * exercise Device.create()'s "unspecified" default-resolution path
 * (as opposed to an explicit true/false).
 */
function makePropsWithoutMonitoring(
  overrides: Partial<Omit<CreateDeviceProps, 'monitoringEnabled'>> = {}
): Omit<CreateDeviceProps, 'monitoringEnabled'> {
  const { monitoringEnabled: _unused, ...rest } = makeProps(overrides);
  return rest;
}

// ---------------------------------------------------------------------------
describe('Device', () => {
  // =========================================================================
  describe('create()', () => {
    describe('when given valid required-only props', () => {
      it('should return a successful Result', () => {
        const result = Device.create(makeProps());

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should return a Device instance', () => {
        const result = Device.create(makeProps());

        expect(result.value).toBeInstanceOf(Device);
      });

      it('should assign a valid DeviceId', () => {
        const device = makeDevice();

        expect(device.id).toBeInstanceOf(DeviceId);
        expect(device.id.toValue().length).toBeGreaterThan(0);
      });

      it('should expose the provided name', () => {
        const name = DeviceName.create('AP-Floor-2').value;
        const device = makeDevice({ name });

        expect(device.name.value).toBe('AP-Floor-2');
      });

      it('should expose the provided status', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('192.168.1.1').value,
          locationId: LocationId.create()
        });

        expect(device.status.isActive()).toBe(true);
      });

      it('should expose the provided ownerType', () => {
        const device = makeDevice({
          ownerType: DeviceOwnerType.CLIENT
        });

        expect(device.ownerType).toBe(DeviceOwnerType.CLIENT);
      });

      it('should default optional fields to null when not provided', () => {
        // Use INVENTORY + serialNumber so invariant is satisfied, no category/ip
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          serialNumber: SerialNumber.create('SN-001').value,
          macAddress: null,
          ipAddress: null,
          locationId: null,
          category: null,
          description: null,
          installedDate: null
        });

        expect(device.locationId).toBeNull();
        expect(device.category).toBeNull();
        expect(device.macAddress).toBeNull();
        expect(device.ipAddress).toBeNull();
        expect(device.description).toBeNull();
        expect(device.installedDate).toBeNull();
      });

      it('should set monitoringEnabled to the provided value', () => {
        const device = makeDevice({
          monitoringEnabled: true,
          ipAddress: IPAddress.create('10.0.0.1').value,
          status: DeviceStatus.createActive(),
          locationId: LocationId.create()
        });

        expect(device.monitoringEnabled).toBe(true);
      });

      it('should set createdAt and updatedAt to recent timestamps', () => {
        const before = new Date();
        const device = makeDevice();
        const after = new Date();

        expect(device.createdAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(device.createdAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
        expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
      });

      it('should generate unique IDs for each created device', () => {
        const a = makeDevice();
        const b = makeDevice();

        expect(a.id.toString()).not.toBe(b.id.toString());
      });
    });

    // -----------------------------------------------------------------------
    describe('when given all optional props', () => {
      it('should expose all optional props', () => {
        const locationId = LocationId.create();
        const category = DeviceCategory.createCpe();
        const serialNumber = SerialNumber.create('SN-001').value;
        const macAddress = MACAddress.create(
          '00:1A:2B:3C:4D:5E'
        ).value;
        const ipAddress = IPAddress.create('192.168.1.1').value;
        const installedDate = new Date('2023-01-15T00:00:00Z');

        const device = makeDevice({
          status: DeviceStatus.createActive(),
          locationId,
          category,
          serialNumber,
          macAddress,
          ipAddress,
          description: 'Main distribution router',
          installedDate,
          monitoringEnabled: true
        });

        expect(device.locationId).toBe(locationId);
        expect(device.category).toBe(category);
        expect(device.serialNumber).toBe(serialNumber);
        expect(device.macAddress).toBe(macAddress);
        expect(device.ipAddress).toBe(ipAddress);
        expect(device.description).toBe('Main distribution router');
        expect(device.installedDate).toEqual(installedDate);
        expect(device.monitoringEnabled).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-040] required field validation', () => {
      it('should fail when deviceModelId is null', () => {
        const result = Device.create(
          makeProps({
            deviceModelId: null as unknown as DeviceModelId
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceModelId');
      });

      it('should fail when deviceModelId is undefined', () => {
        const result = Device.create(
          makeProps({
            deviceModelId: undefined as unknown as DeviceModelId
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceModelId');
      });

      it('should fail when name is null', () => {
        const result = Device.create(
          makeProps({ name: null as unknown as DeviceName })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is undefined', () => {
        const result = Device.create(
          makeProps({ name: undefined as unknown as DeviceName })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when status is null', () => {
        const result = Device.create(
          makeProps({ status: null as unknown as DeviceStatus })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('status');
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-052] description invariant', () => {
      it('should fail when description exceeds 500 characters', () => {
        const result = Device.create(
          makeProps({ description: 'A'.repeat(501) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('500');
      });

      it('should succeed when description is exactly 500 characters', () => {
        const result = Device.create(
          makeProps({ description: 'A'.repeat(500) })
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-051] installedDate invariant', () => {
      it('should fail when installedDate is not a valid Date', () => {
        const result = Device.create(
          makeProps({
            installedDate: 'not-a-date' as unknown as Date
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('installedDate');
      });

      it('should succeed when installedDate is a valid Date', () => {
        const result = Device.create(
          makeProps({ installedDate: new Date('2023-01-01') })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when installedDate is in the future', () => {
        const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const result = Device.create(
          makeProps({ installedDate: future })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('future');
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-057] [DEV-058] monitoringEnabled invariant', () => {
      it('should fail when monitoringEnabled is true and status is INVENTORY', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createInventory(),
            monitoringEnabled: true,
            ipAddress: IPAddress.create('10.0.0.1').value
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ACTIVE or COMMISSIONING');
      });

      it('should fail when monitoringEnabled is true and status is DAMAGED', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createDamaged(),
            monitoringEnabled: true,
            ipAddress: IPAddress.create('10.0.0.1').value
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ACTIVE or COMMISSIONING');
      });

      it('should succeed when monitoringEnabled is true and status is ACTIVE', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createActive(),
            monitoringEnabled: true,
            ipAddress: IPAddress.create('10.0.0.1').value,
            locationId: LocationId.create()
          })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when monitoringEnabled is true and status is COMMISSIONING', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createCommissioning(),
            monitoringEnabled: true,
            ipAddress: IPAddress.create('10.0.0.1').value
          })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should default monitoringEnabled to true when unspecified for a COMMISSIONING device', () => {
        const result = Device.create(
          makePropsWithoutMonitoring({
            status: DeviceStatus.createCommissioning(),
            ipAddress: IPAddress.create('10.0.0.1').value
          })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.monitoringEnabled).toBe(true);
      });

      it('should respect an explicit monitoringEnabled=false for a COMMISSIONING device', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createCommissioning(),
            ipAddress: IPAddress.create('10.0.0.1').value,
            monitoringEnabled: false
          })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.monitoringEnabled).toBe(false);
      });

      it('should default monitoringEnabled to false when unspecified for a non-COMMISSIONING device', () => {
        const result = Device.create(makePropsWithoutMonitoring());

        expect(result.isSuccess).toBe(true);
        expect(result.value.monitoringEnabled).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-053] INVENTORY / DAMAGED status invariant', () => {
      it('should fail when INVENTORY status has neither serialNumber nor macAddress', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createInventory(),
            serialNumber: null,
            macAddress: null
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('serial number or MAC address');
      });

      it('should fail when DAMAGED status has neither serialNumber nor macAddress', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createDamaged(),
            serialNumber: null,
            macAddress: null
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('serial number or MAC address');
      });

      it('should succeed when INVENTORY status has a serialNumber', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createInventory(),
            serialNumber: SerialNumber.create('SN-001').value,
            macAddress: null
          })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when INVENTORY status has a macAddress', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createInventory(),
            serialNumber: null,
            macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value
          })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when DAMAGED status has both serialNumber and macAddress', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createDamaged(),
            serialNumber: SerialNumber.create('SN-002').value,
            macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value
          })
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-054] [DEV-055] ACTIVE status invariant', () => {
      it('should fail when ACTIVE status has no ipAddress', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: null,
            locationId: LocationId.create()
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('IP address');
      });

      it('should fail when ACTIVE status has no locationId', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: IPAddress.create('10.0.0.1').value,
            locationId: null
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('location');
      });

      it('should succeed when ACTIVE status has an ipAddress and a locationId', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: IPAddress.create('10.0.0.1').value,
            locationId: LocationId.create()
          })
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-056] [DEV-058] COMMISSIONING status invariant', () => {
      it('should fail when creating a COMMISSIONING device without an IP address', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createCommissioning(),
            ipAddress: null
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('IP address');
      });

      it('should auto-set monitoringEnabled to true when creating a COMMISSIONING device without specifying it', () => {
        const result = Device.create(
          makePropsWithoutMonitoring({
            status: DeviceStatus.createCommissioning(),
            ipAddress: IPAddress.create('10.0.0.1').value
          })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.monitoringEnabled).toBe(true);
      });

      it('should respect an explicit monitoringEnabled=false when creating a COMMISSIONING device', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createCommissioning(),
            ipAddress: IPAddress.create('10.0.0.1').value,
            monitoringEnabled: false
          })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.monitoringEnabled).toBe(false);
      });

      it('should succeed when creating a COMMISSIONING device with an IP address', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createCommissioning(),
            ipAddress: IPAddress.create('10.0.0.1').value
          })
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('category invariant', () => {
      it('should succeed when a category is set and ipAddress is provided', () => {
        const result = Device.create(
          makeProps({
            category: DeviceCategory.createAccessPoint(),
            ipAddress: IPAddress.create('192.168.1.1').value
          })
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('domain event emission', () => {
      it('should add exactly one domain event on successful creation', () => {
        const device = makeDevice();

        expect(device.domainEvents.length).toBe(1);
      });

      it('should emit a DeviceCreatedEvent', () => {
        const device = makeDevice();

        expect(device.domainEvents[0]).toBeInstanceOf(
          DeviceCreatedEvent
        );
      });

      it('should emit a DeviceCreatedEvent with the correct aggregate ID', () => {
        const device = makeDevice();
        const event = device.domainEvents[0] as DeviceCreatedEvent;

        expect(event.aggregateId.toString()).toBe(
          device.id.toString()
        );
      });

      it('should emit a DeviceCreatedEvent with the correct device name', () => {
        const device = makeDevice({
          name: DeviceName.create('Dist-Switch-01').value
        });
        const event = device.domainEvents[0] as DeviceCreatedEvent;

        expect(event.deviceName.value).toBe('Dist-Switch-01');
      });

      it('should emit a DeviceCreatedEvent with the correct status', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('10.0.0.1').value,
          locationId: LocationId.create()
        });
        const event = device.domainEvents[0] as DeviceCreatedEvent;

        expect(event.status.isActive()).toBe(true);
      });

      it('should emit a DeviceCreatedEvent with a recent dateTimeOccurred', () => {
        const before = new Date();
        const device = makeDevice();
        const after = new Date();
        const event = device.domainEvents[0] as DeviceCreatedEvent;

        expect(
          event.dateTimeOccurred.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
        expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should not emit any domain event when creation fails', () => {
        const result = Device.create(
          makeProps({ name: null as unknown as DeviceName })
        );

        expect(result.isFailure).toBe(true);
        // No Device instance created — no events exist.
      });
    });
  });

  // =========================================================================
  describe('[DEV-061] reconstitute()', () => {
    it('should return a Device instance without emitting domain events', () => {
      const id = DeviceId.create();
      const now = new Date();
      const device = Device.reconstitute(id, {
        ...makeProps(),
        createdAt: now,
        updatedAt: now
      });

      expect(device).toBeInstanceOf(Device);
      expect(device.domainEvents.length).toBe(0);
    });

    it('should use the provided ID', () => {
      const id = DeviceId.create();
      const now = new Date();
      const device = Device.reconstitute(id, {
        ...makeProps(),
        createdAt: now,
        updatedAt: now
      });

      expect(device.id).toBe(id);
    });

    it('should expose all props it was given', () => {
      const id = DeviceId.create();
      const locationId = LocationId.create();
      const category = DeviceCategory.createGateway();
      const serialNumber = SerialNumber.create('SN-PERSIST').value;
      const now = new Date('2023-01-01T00:00:00Z');

      // reconstitute bypasses validation — status can be any value
      const device = Device.reconstitute(id, {
        ...makeProps({
          name: DeviceName.create('Legacy-AP').value,
          status: DeviceStatus.createDamaged(),
          ownerType: DeviceOwnerType.CLIENT,
          locationId,
          category,
          serialNumber,
          description: 'Reconstituted device',
          monitoringEnabled: true
        }),
        createdAt: now,
        updatedAt: now
      });

      expect(device.name.value).toBe('Legacy-AP');
      expect(device.status.isDamaged()).toBe(true);
      expect(device.ownerType).toBe(DeviceOwnerType.CLIENT);
      expect(device.locationId).toBe(locationId);
      expect(device.category).toBe(category);
      expect(device.serialNumber).toBe(serialNumber);
      expect(device.description).toBe('Reconstituted device');
      expect(device.monitoringEnabled).toBe(true);
      expect(device.createdAt).toEqual(now);
      expect(device.updatedAt).toEqual(now);
    });
  });

  // =========================================================================
  describe('changeStatus()', () => {
    describe('happy path', () => {
      it('should succeed when transitioning INVENTORY to COMMISSIONING with an IP address', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory()
        });
        device.clearEvents();
        device.updateDetails({
          ipAddress: IPAddress.create('192.168.1.1').value
        });
        const result = device.changeStatus(
          DeviceStatus.createCommissioning()
        );
        expect(result.isSuccess).toBe(true);
      });

      it('should fail when transitioning to ACTIVE without an IP Address', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          serialNumber: SerialNumber.create('SN-001').value,
          ipAddress: null
        });
        device.clearEvents();
        const result = device.changeStatus(
          DeviceStatus.createActive()
        );
        expect(result.isSuccess).toBe(false);
      });

      it('should update the status when transitioning INVENTORY to DAMAGED', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory()
        });
        device.changeStatus(DeviceStatus.createDamaged());

        expect(device.status.isDamaged()).toBe(true);
      });

      it('should emit a DeviceStatusChangedEvent', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          ipAddress: IPAddress.create('10.0.0.1').value
        });
        device.assignLocation(LocationId.create());
        device.clearEvents();
        device.changeStatus(DeviceStatus.createActive());

        expect(device.domainEvents.length).toBe(1);
        expect(device.domainEvents[0]).toBeInstanceOf(
          DeviceStatusChangedEvent
        );
      });

      it('should emit a DeviceStatusChangedEvent with correct previous and new status', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          ipAddress: IPAddress.create('10.0.0.1').value
        });
        device.assignLocation(LocationId.create());
        device.clearEvents();
        device.changeStatus(DeviceStatus.createActive());

        const event = device
          .domainEvents[0] as DeviceStatusChangedEvent;

        expect(event.previousStatus.isInInventory()).toBe(true);
        expect(event.newStatus.isActive()).toBe(true);
      });

      it('should update updatedAt timestamp', () => {
        const device = makeDevice({
          serialNumber: SerialNumber.create('SN-001').value
        });
        const before = new Date();
        device.changeStatus(DeviceStatus.createDamaged());
        const after = new Date();

        expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(device.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when status is unchanged', () => {
      it('should return a successful Result without emitting an event', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory()
        });
        device.clearEvents();
        const result = device.changeStatus(
          DeviceStatus.createInventory()
        );

        expect(result.isSuccess).toBe(true);
        expect(device.domainEvents.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-053] INVENTORY / DAMAGED transition invariant', () => {
      it('should fail when transitioning to INVENTORY without a serial number or MAC address', () => {
        const device = Device.reconstitute(DeviceId.create(), {
          ...makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: IPAddress.create('10.0.0.1').value,
            serialNumber: null,
            macAddress: null
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const result = device.changeStatus(
          DeviceStatus.createInventory()
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('serial number or MAC address');
      });

      it('should fail when transitioning to DAMAGED without a serial number or MAC address', () => {
        const device = Device.reconstitute(DeviceId.create(), {
          ...makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: IPAddress.create('10.0.0.1').value,
            serialNumber: null,
            macAddress: null
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const result = device.changeStatus(
          DeviceStatus.createDamaged()
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('serial number or MAC address');
      });

      it('should succeed transitioning to INVENTORY when a MAC address exists', () => {
        const device = Device.reconstitute(DeviceId.create(), {
          ...makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: IPAddress.create('10.0.0.1').value,
            serialNumber: null,
            macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const result = device.changeStatus(
          DeviceStatus.createInventory()
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-057] monitoringEnabled invariant', () => {
      it('should fail to transition to INVENTORY while monitoring is enabled', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('10.0.0.1').value,
          locationId: LocationId.create(),
          serialNumber: SerialNumber.create('SN-001').value,
          monitoringEnabled: true
        });

        const result = device.changeStatus(
          DeviceStatus.createInventory()
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ACTIVE or COMMISSIONING');
      });

      it('should succeed transitioning to INVENTORY after monitoring is disabled', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('10.0.0.1').value,
          locationId: LocationId.create(),
          serialNumber: SerialNumber.create('SN-001').value,
          monitoringEnabled: true
        });
        device.disableMonitoring();

        const result = device.changeStatus(
          DeviceStatus.createInventory()
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('null validation', () => {
      it('should fail when newStatus is null', () => {
        const device = makeDevice();
        const result = device.changeStatus(
          null as unknown as DeviceStatus
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('status');
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-056] [DEV-059] COMMISSIONING status invariant', () => {
      it('should fail when transitioning to COMMISSIONING without an IP address', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          ipAddress: null
        });
        device.clearEvents();
        const result = device.changeStatus(
          DeviceStatus.createCommissioning()
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('IP address');
      });

      it('should succeed when transitioning INVENTORY to COMMISSIONING with an IP address', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          ipAddress: IPAddress.create('10.0.0.1').value
        });
        device.clearEvents();
        const result = device.changeStatus(
          DeviceStatus.createCommissioning()
        );

        expect(result.isSuccess).toBe(true);
        expect(device.status.isCommissioning()).toBe(true);
      });

      it('should auto-enable monitoring on transition to COMMISSIONING', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          ipAddress: IPAddress.create('10.0.0.1').value,
          monitoringEnabled: false
        });
        device.clearEvents();
        device.changeStatus(DeviceStatus.createCommissioning());

        expect(device.monitoringEnabled).toBe(true);
      });

      it('should emit both DeviceStatusChangedEvent and DeviceMonitoringToggledEvent when transitioning to COMMISSIONING', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          ipAddress: IPAddress.create('10.0.0.1').value,
          monitoringEnabled: false
        });
        device.clearEvents();
        device.changeStatus(DeviceStatus.createCommissioning());

        expect(device.domainEvents.length).toBe(2);
        expect(device.domainEvents[0]).toBeInstanceOf(
          DeviceStatusChangedEvent
        );
        expect(device.domainEvents[1]).toBeInstanceOf(
          DeviceMonitoringToggledEvent
        );
      });

      it('should NOT emit DeviceMonitoringToggledEvent when monitoring was already enabled before transitioning to COMMISSIONING', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('10.0.0.1').value,
          locationId: LocationId.create(),
          monitoringEnabled: true
        });
        device.clearEvents();
        device.changeStatus(DeviceStatus.createCommissioning());

        expect(device.domainEvents.length).toBe(1);
        expect(device.domainEvents[0]).toBeInstanceOf(
          DeviceStatusChangedEvent
        );
      });
    });
  });

  // =========================================================================
  describe('assignLocation()', () => {
    describe('happy path', () => {
      it('should return a successful Result when assigning a location', () => {
        const device = makeDevice();
        const result = device.assignLocation(LocationId.create());

        expect(result.isSuccess).toBe(true);
      });

      it('should update locationId', () => {
        const device = makeDevice();
        const locationId = LocationId.create();
        device.assignLocation(locationId);

        expect(device.locationId).toBe(locationId);
      });

      it('should emit a DeviceLocationAssignedEvent', () => {
        const device = makeDevice();
        device.clearEvents();
        device.assignLocation(LocationId.create());

        expect(device.domainEvents.length).toBe(1);
        expect(device.domainEvents[0]).toBeInstanceOf(
          DeviceLocationAssignedEvent
        );
      });

      it('should emit a DeviceLocationAssignedEvent with correct previousLocationId and newLocationId', () => {
        const oldLocation = LocationId.create();
        const newLocation = LocationId.create();
        const device = makeDevice({ locationId: oldLocation });
        device.clearEvents();
        device.assignLocation(newLocation);

        const event = device
          .domainEvents[0] as DeviceLocationAssignedEvent;

        expect(event.previousLocationId!.toString()).toBe(
          oldLocation.toString()
        );
        expect(event.newLocationId!.toString()).toBe(
          newLocation.toString()
        );
      });

      it('should allow unassigning location by passing null', () => {
        const locationId = LocationId.create();
        const device = makeDevice({ locationId });
        device.clearEvents();
        device.assignLocation(null);

        expect(device.locationId).toBeNull();
        expect(device.domainEvents.length).toBe(1);
        const event = device
          .domainEvents[0] as DeviceLocationAssignedEvent;

        expect(event.newLocationId).toBeNull();
        expect(event.previousLocationId!.toString()).toBe(
          locationId.toString()
        );
      });

      it('should update updatedAt timestamp', () => {
        const device = makeDevice();
        const before = new Date();
        device.assignLocation(LocationId.create());
        const after = new Date();

        expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(device.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when location is unchanged', () => {
      it('should not emit an event when the same LocationId is assigned again', () => {
        const locationId = LocationId.create();
        const device = makeDevice({ locationId });
        device.clearEvents();
        const result = device.assignLocation(locationId);

        expect(result.isSuccess).toBe(true);
        expect(device.domainEvents.length).toBe(0);
      });

      it('should not emit an event when null is assigned to a device with no location', () => {
        const device = makeDevice({ locationId: null });
        device.clearEvents();
        const result = device.assignLocation(null);

        expect(result.isSuccess).toBe(true);
        expect(device.domainEvents.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-055] invariant enforcement', () => {
      it('should fail to unassign the location of an ACTIVE device', () => {
        const locationId = LocationId.create();
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('10.0.0.1').value,
          locationId
        });
        const result = device.assignLocation(null);

        expect(result.isFailure).toBe(true);
        expect(device.locationId).toBe(locationId);
      });
    });
  });

  // =========================================================================
  describe('[DEV-060] applyChanges() — whole-state validation', () => {
    it('should accept a location and ACTIVE status in one call', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: IPAddress.create('10.2.0.1').value,
        locationId: null
      });
      const locationId = LocationId.create();

      const result = device.applyChanges({
        locationId,
        status: DeviceStatus.createActive()
      });

      expect(result.isSuccess).toBe(true);
      expect(device.locationId).toBe(locationId);
      expect(device.status.toString()).toBe('ACTIVE');
    });

    it('should accept an IP and ACTIVE status in one call', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: null,
        locationId: LocationId.create()
      });
      const ip = IPAddress.create('10.2.0.2').value;

      const result = device.applyChanges({
        ipAddress: ip,
        status: DeviceStatus.createActive()
      });

      expect(result.isSuccess).toBe(true);
      expect(device.ipAddress).toBe(ip);
    });

    it('should accept clearing the location while leaving ACTIVE in one call', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.2.0.3').value,
        locationId: LocationId.create(),
        serialNumber: SerialNumber.create('SN-1').value
      });

      const result = device.applyChanges({
        locationId: null,
        status: DeviceStatus.createInventory()
      });

      expect(result.isSuccess).toBe(true);
      expect(device.locationId).toBeNull();
      expect(device.status.toString()).toBe('INVENTORY');
    });

    it('should still reject clearing the location of a device that stays ACTIVE', () => {
      const locationId = LocationId.create();
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.2.0.4').value,
        locationId
      });

      const result = device.applyChanges({ locationId: null });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('must have a location assigned');
      expect(device.locationId).toBe(locationId);
    });

    it('should accept disabling monitoring while moving to a non-monitorable status', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.2.0.5').value,
        locationId: LocationId.create(),
        serialNumber: SerialNumber.create('SN-2').value,
        monitoringEnabled: true
      });

      const result = device.applyChanges({
        status: DeviceStatus.createDamaged(),
        monitoringEnabled: false
      });

      expect(result.isSuccess).toBe(true);
      expect(device.monitoringEnabled).toBe(false);
      expect(device.status.toString()).toBe('DAMAGED');
    });

    it('[DEV-059] should respect an explicit false when moving into COMMISSIONING', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: IPAddress.create('10.2.0.6').value,
        monitoringEnabled: false
      });

      const result = device.applyChanges({
        status: DeviceStatus.createCommissioning(),
        monitoringEnabled: false
      });

      expect(result.isSuccess).toBe(true);
      expect(device.monitoringEnabled).toBe(false);
    });

    it('[DEV-059] should turn monitoring on when moving into COMMISSIONING without a stated preference', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: IPAddress.create('10.2.0.8').value,
        monitoringEnabled: false
      });

      const result = device.applyChanges({
        status: DeviceStatus.createCommissioning()
      });

      expect(result.isSuccess).toBe(true);
      expect(device.monitoringEnabled).toBe(true);
    });

    it('should leave the aggregate untouched when the candidate state is invalid', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: null,
        locationId: null
      });
      device.clearEvents();

      // ACTIVE needs both an IP and a location; only the IP is supplied.
      const result = device.applyChanges({
        ipAddress: IPAddress.create('10.2.0.7').value,
        status: DeviceStatus.createActive()
      });

      expect(result.isFailure).toBe(true);
      expect(device.ipAddress).toBeNull();
      expect(device.status.toString()).toBe('INVENTORY');
      expect(device.domainEvents.length).toBe(0);
    });

    it('should emit one event per changed aspect', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: IPAddress.create('10.2.0.8').value,
        locationId: null
      });
      device.clearEvents();

      device.applyChanges({
        name: DeviceName.create('Renamed').value,
        locationId: LocationId.create(),
        status: DeviceStatus.createActive(),
        monitoringEnabled: true
      });

      const kinds = device.domainEvents.map((e) => e.constructor.name);
      expect(kinds).toEqual([
        'DeviceDetailsUpdatedEvent',
        'DeviceStatusChangedEvent',
        'DeviceLocationAssignedEvent',
        'DeviceMonitoringToggledEvent'
      ]);
    });

    it('should be a no-op for an empty change set', () => {
      const device = makeDevice();
      const before = device.updatedAt;
      device.clearEvents();

      const result = device.applyChanges({});

      expect(result.isSuccess).toBe(true);
      expect(device.domainEvents.length).toBe(0);
      expect(device.updatedAt).toBe(before);
    });
  });

  // =========================================================================
  describe('[DEV-063] correctDeviceModel()', () => {
    describe('happy path', () => {
      it('should return a successful Result for an INVENTORY device', () => {
        const device = makeDevice();
        const result = device.correctDeviceModel(DeviceModelId.create());

        expect(result.isSuccess).toBe(true);
      });

      it('should replace deviceModelId', () => {
        const device = makeDevice();
        const newModelId = DeviceModelId.create();
        device.correctDeviceModel(newModelId);

        expect(device.deviceModelId).toBe(newModelId);
      });

      it('should emit a DeviceModelCorrectedEvent carrying both ids', () => {
        const oldModelId = DeviceModelId.create();
        const newModelId = DeviceModelId.create();
        const device = makeDevice({ deviceModelId: oldModelId });
        device.clearEvents();
        device.correctDeviceModel(newModelId);

        expect(device.domainEvents.length).toBe(1);
        const event = device
          .domainEvents[0] as DeviceModelCorrectedEvent;

        expect(event).toBeInstanceOf(DeviceModelCorrectedEvent);
        expect(event.previousDeviceModelId.toString()).toBe(
          oldModelId.toString()
        );
        expect(event.newDeviceModelId.toString()).toBe(
          newModelId.toString()
        );
        expect(event.deviceName).toBe(device.name);
      });

      it('should update the updatedAt timestamp', () => {
        const device = makeDevice();
        const before = new Date();
        device.correctDeviceModel(DeviceModelId.create());
        const after = new Date();

        expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(device.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op', () => {
      it('should succeed without an event when the model is unchanged', () => {
        const modelId = DeviceModelId.create();
        const device = makeDevice({ deviceModelId: modelId });
        device.clearEvents();
        const result = device.correctDeviceModel(modelId);

        expect(result.isSuccess).toBe(true);
        expect(device.domainEvents.length).toBe(0);
      });

      it('should succeed for the unchanged model even when not INVENTORY', () => {
        const modelId = DeviceModelId.create();
        const device = makeDevice({
          deviceModelId: modelId,
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('10.0.0.5').value,
          locationId: LocationId.create()
        });
        const result = device.correctDeviceModel(modelId);

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('invariant enforcement', () => {
      it.each([
        ['ACTIVE', DeviceStatus.createActive()],
        ['COMMISSIONING', DeviceStatus.createCommissioning()],
        ['DAMAGED', DeviceStatus.createDamaged()]
      ])(
        'should fail for a %s device and leave the model untouched',
        (_label, status) => {
          const oldModelId = DeviceModelId.create();
          const device = makeDevice({
            deviceModelId: oldModelId,
            status,
            ipAddress: IPAddress.create('10.0.0.9').value,
            locationId: LocationId.create()
          });
          device.clearEvents();
          const result = device.correctDeviceModel(
            DeviceModelId.create()
          );

          expect(result.isFailure).toBe(true);
          expect(result.error).toContain(
            'Cannot change the device model of a device with status'
          );
          expect(device.deviceModelId).toBe(oldModelId);
          expect(device.domainEvents.length).toBe(0);
        }
      );

      it('should fail when deviceModelId is null', () => {
        const device = makeDevice();
        const result = device.correctDeviceModel(
          null as unknown as DeviceModelId
        );

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // =========================================================================
  describe('enableMonitoring()', () => {
    describe('happy path', () => {
      it('should return a successful Result', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('192.168.0.1').value,
          locationId: LocationId.create(),
          monitoringEnabled: false
        });
        const result = device.enableMonitoring();

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when enabling monitoring without an IP Address', () => {
        const device = Device.reconstitute(DeviceId.create(), {
          ...makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: null,
            locationId: LocationId.create(),
            monitoringEnabled: false
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        const result = device.enableMonitoring();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('IP address');
      });

      it('should fail when enabling monitoring on a device that is not ACTIVE or COMMISSIONING', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          ipAddress: IPAddress.create('10.0.0.1').value
        });
        const result = device.enableMonitoring();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ACTIVE or COMMISSIONING');
      });

      it('should set monitoringEnabled to true', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('192.168.0.1').value,
          locationId: LocationId.create(),
          monitoringEnabled: false
        });
        device.enableMonitoring();

        expect(device.monitoringEnabled).toBe(true);
      });

      it('should emit a DeviceMonitoringToggledEvent with monitoringEnabled = true', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('192.168.0.1').value,
          locationId: LocationId.create(),
          monitoringEnabled: false
        });
        device.clearEvents();
        device.enableMonitoring();

        expect(device.domainEvents.length).toBe(1);
        const event = device
          .domainEvents[0] as DeviceMonitoringToggledEvent;

        expect(event).toBeInstanceOf(DeviceMonitoringToggledEvent);
        expect(event.monitoringEnabled).toBe(true);
      });

      it('should update updatedAt timestamp', () => {
        const device = makeDevice({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('192.168.0.1').value,
          locationId: LocationId.create(),
          monitoringEnabled: false
        });
        const before = new Date();
        device.enableMonitoring();
        const after = new Date();

        expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(device.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when already enabled', () => {
      it('should return a successful Result without emitting an event', () => {
        const device = makeDevice({
          monitoringEnabled: true,
          ipAddress: IPAddress.create('10.0.0.1').value,
          status: DeviceStatus.createActive(),
          locationId: LocationId.create()
        });
        device.clearEvents();
        const result = device.enableMonitoring();

        expect(result.isSuccess).toBe(true);
        expect(device.domainEvents.length).toBe(0);
      });
    });
  });

  // =========================================================================
  describe('disableMonitoring()', () => {
    describe('happy path', () => {
      it('should return a successful Result', () => {
        const device = makeDevice({
          monitoringEnabled: true,
          ipAddress: IPAddress.create('10.0.0.1').value,
          status: DeviceStatus.createActive(),
          locationId: LocationId.create()
        });
        const result = device.disableMonitoring();

        expect(result.isSuccess).toBe(true);
      });

      it('should set monitoringEnabled to false', () => {
        const device = makeDevice({
          monitoringEnabled: true,
          ipAddress: IPAddress.create('10.0.0.1').value,
          status: DeviceStatus.createActive(),
          locationId: LocationId.create()
        });
        device.disableMonitoring();

        expect(device.monitoringEnabled).toBe(false);
      });

      it('should emit a DeviceMonitoringToggledEvent with monitoringEnabled = false', () => {
        const device = makeDevice({
          monitoringEnabled: true,
          ipAddress: IPAddress.create('10.0.0.1').value,
          status: DeviceStatus.createActive(),
          locationId: LocationId.create()
        });
        device.clearEvents();
        device.disableMonitoring();

        expect(device.domainEvents.length).toBe(1);
        const event = device
          .domainEvents[0] as DeviceMonitoringToggledEvent;

        expect(event).toBeInstanceOf(DeviceMonitoringToggledEvent);
        expect(event.monitoringEnabled).toBe(false);
      });

      it('should update updatedAt timestamp', () => {
        const device = makeDevice({
          monitoringEnabled: true,
          ipAddress: IPAddress.create('10.0.0.1').value,
          status: DeviceStatus.createActive(),
          locationId: LocationId.create()
        });
        const before = new Date();
        device.disableMonitoring();
        const after = new Date();

        expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(device.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when already disabled', () => {
      it('should return a successful Result without emitting an event', () => {
        const device = makeDevice({ monitoringEnabled: false });
        device.clearEvents();
        const result = device.disableMonitoring();

        expect(result.isSuccess).toBe(true);
        expect(device.domainEvents.length).toBe(0);
      });
    });
  });

  // =========================================================================
  describe('updateDetails()', () => {
    describe('[DEV-041] name update', () => {
      it('should update the name when a valid DeviceName is provided', () => {
        const device = makeDevice();
        device.updateDetails({
          name: DeviceName.create('Updated-Router').value
        });

        expect(device.name.value).toBe('Updated-Router');
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-052] description update', () => {
      it('should update the description when a valid string is provided', () => {
        const device = makeDevice();
        device.updateDetails({ description: 'New description' });

        expect(device.description).toBe('New description');
      });

      it('should set description to null when explicitly null', () => {
        const device = makeDevice({ description: 'Old description' });
        device.updateDetails({ description: null });

        expect(device.description).toBeNull();
      });

      it('should not change the description when not provided (undefined)', () => {
        const device = makeDevice({ description: 'Keep me' });
        device.updateDetails({
          name: DeviceName.create('New-Name').value
        });

        expect(device.description).toBe('Keep me');
      });

      it('should fail when description exceeds 500 characters', () => {
        const device = makeDevice();
        const result = device.updateDetails({
          description: 'A'.repeat(501)
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('500');
      });

      it('should not change the description when validation fails', () => {
        const device = makeDevice({ description: 'Keep me' });
        device.updateDetails({ description: 'A'.repeat(501) });

        expect(device.description).toBe('Keep me');
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-043] category update', () => {
      it('should update the category', () => {
        const device = makeDevice();
        device.updateDetails({
          category: DeviceCategory.createCpe()
        });

        expect(device.category!.isCpe()).toBe(true);
      });

      it('should set category to null when explicitly null', () => {
        const device = makeDevice({
          category: DeviceCategory.createAccessPoint(),
          ipAddress: IPAddress.create('10.0.0.1').value
        });
        device.updateDetails({ category: null });

        expect(device.category).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-045] serialNumber update', () => {
      it('should update the serial number when a valid SerialNumber is provided', () => {
        const device = makeDevice();
        device.updateDetails({
          serialNumber: SerialNumber.create('SN-NEW-001').value
        });

        expect(device.serialNumber!.value).toBe('SN-NEW-001');
      });

      it('should set serialNumber to null when explicitly null and a macAddress remains', () => {
        const device = makeDevice({
          serialNumber: SerialNumber.create('SN-OLD').value,
          macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value
        });
        device.updateDetails({ serialNumber: null });

        expect(device.serialNumber).toBeNull();
      });

      it('should fail to null the serialNumber when no macAddress remains on an INVENTORY device', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory(),
          serialNumber: SerialNumber.create('SN-ONLY').value,
          macAddress: null
        });
        const result = device.updateDetails({ serialNumber: null });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('serial number or MAC address');
        expect(device.serialNumber).not.toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-044] ownerType update', () => {
      it('should update the ownerType', () => {
        const device = makeDevice({
          ownerType: DeviceOwnerType.COMPANY
        });
        device.updateDetails({ ownerType: DeviceOwnerType.CLIENT });

        expect(device.ownerType).toBe(DeviceOwnerType.CLIENT);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-051] installedDate update', () => {
      it('should update the installedDate', () => {
        const device = makeDevice();
        const date = new Date('2023-06-01T00:00:00Z');
        device.updateDetails({ installedDate: date });

        expect(device.installedDate).toEqual(date);
      });

      it('should set installedDate to null when explicitly null', () => {
        const device = makeDevice({
          installedDate: new Date()
        });
        device.updateDetails({ installedDate: null });

        expect(device.installedDate).toBeNull();
      });

      it('should fail when installedDate is not a Date', () => {
        const device = makeDevice();
        const result = device.updateDetails({
          installedDate: 'not-a-date' as unknown as Date
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('installedDate');
      });

      it('should fail when installedDate is in the future', () => {
        const device = makeDevice();
        const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const result = device.updateDetails({ installedDate: future });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('future');
      });
    });

    // -----------------------------------------------------------------------
    describe('updatedAt timestamp', () => {
      it('should update updatedAt on a successful update', () => {
        const device = makeDevice();
        const before = new Date();
        device.updateDetails({
          name: DeviceName.create('Updated-Name').value
        });
        const after = new Date();

        expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(device.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });
  });

  // =========================================================================
  describe('query methods', () => {
    it('status.isActive() should return true when status is ACTIVE', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.0.0.1').value,
        locationId: LocationId.create()
      });

      expect(device.status.isActive()).toBe(true);
    });

    it('status.isActive() should return false when status is not ACTIVE', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory()
      });

      expect(device.status.isActive()).toBe(false);
    });

    it('status.isInInventory() should return true when status is INVENTORY', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory()
      });

      expect(device.status.isInInventory()).toBe(true);
    });

    it('status.isInInventory() should return false when status is not INVENTORY', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.0.0.1').value,
        locationId: LocationId.create()
      });

      expect(device.status.isInInventory()).toBe(false);
    });

    it('locationId should be null when no location is assigned', () => {
      const device = makeDevice({ locationId: null });

      expect(device.locationId).toBeNull();
    });

    it('locationId should be set when a location is assigned', () => {
      const device = makeDevice({ locationId: LocationId.create() });

      expect(device.locationId).not.toBeNull();
    });

    it('monitoringEnabled should reflect the flag value', () => {
      const enabled = makeDevice({
        monitoringEnabled: true,
        ipAddress: IPAddress.create('10.0.0.1').value,
        status: DeviceStatus.createActive(),
        locationId: LocationId.create()
      });
      const disabled = makeDevice({ monitoringEnabled: false });

      expect(enabled.monitoringEnabled).toBe(true);
      expect(disabled.monitoringEnabled).toBe(false);
    });

    it('locationId should reflect updated state after assignLocation', () => {
      const device = makeDevice({ locationId: null });
      expect(device.locationId).toBeNull();

      device.assignLocation(LocationId.create());
      expect(device.locationId).not.toBeNull();

      device.assignLocation(null);
      expect(device.locationId).toBeNull();
    });
  });

  // =========================================================================
  describe('[DEV-062] canHaveWirelessConfig()', () => {
    it('should return true for a WIRELESS_CPE device', () => {
      const device = makeDevice({
        category: DeviceCategory.createWirelessCpe()
      });

      expect(device.canHaveWirelessConfig()).toBe(true);
    });

    it('should return true for an AP device', () => {
      const device = makeDevice({ category: DeviceCategory.createAccessPoint() });

      expect(device.canHaveWirelessConfig()).toBe(true);
    });

    it('should return false for a CPE device', () => {
      const device = makeDevice({ category: DeviceCategory.createCpe() });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });

    it('should return false for a GATEWAY device', () => {
      const device = makeDevice({
        category: DeviceCategory.createGateway()
      });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });

    it('should return false for an AGGREGATION_SWITCH device', () => {
      const device = makeDevice({
        category: DeviceCategory.createAggregationSwitch()
      });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });

    it('should return false when the device has no category', () => {
      const device = makeDevice({ category: null });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });
  });

  // =========================================================================
  describe('clearEvents()', () => {
    it('should remove all domain events', () => {
      const device = makeDevice();
      expect(device.domainEvents.length).toBe(1);

      device.clearEvents();

      expect(device.domainEvents.length).toBe(0);
    });

    it('should allow new events to accumulate after clearing', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('192.168.0.1').value,
        locationId: LocationId.create(),
        monitoringEnabled: false
      });
      device.clearEvents();

      device.enableMonitoring();

      expect(device.domainEvents.length).toBe(1);
    });
  });

  // =========================================================================
  describe('real-world scenarios', () => {
    it('should represent a fully-configured ISP device', () => {
      const result = Device.create({
        deviceModelId: DeviceModelId.create(),
        name: DeviceName.create('Core-Dist-SW-01').value,
        status: DeviceStatus.createActive(),
        ownerType: DeviceOwnerType.COMPANY,
        locationId: LocationId.create(),
        category: DeviceCategory.createAggregationSwitch(),
        serialNumber: SerialNumber.create('SN-DIST-2024-001').value,
        macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
        ipAddress: IPAddress.create('10.0.1.1').value,
        description: 'Core distribution switch on floor 1',
        installedDate: new Date('2023-09-01T00:00:00Z'),
        monitoringEnabled: true
      });

      expect(result.isSuccess).toBe(true);
      const device = result.value;
      expect(device.status.isActive()).toBe(true);
      expect(device.monitoringEnabled).toBe(true);
      expect(device.locationId).not.toBeNull();
      expect(device.category!.isAggregationSwitch()).toBe(true);
    });

    it('should allow sequential state changes and accumulate matching events', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        monitoringEnabled: false
      });
      device.clearEvents();

      device.assignLocation(LocationId.create());
      device.updateDetails({
        ipAddress: IPAddress.create('192.168.1.1').value
      });
      device.changeStatus(DeviceStatus.createActive());
      device.enableMonitoring();

      expect(device.domainEvents.length).toBe(4);
      expect(device.domainEvents[0]).toBeInstanceOf(
        DeviceLocationAssignedEvent
      );
      expect(device.domainEvents[1]).toBeInstanceOf(
        DeviceDetailsUpdatedEvent
      );
      expect(device.domainEvents[2]).toBeInstanceOf(
        DeviceStatusChangedEvent
      );
      expect(device.domainEvents[3]).toBeInstanceOf(
        DeviceMonitoringToggledEvent
      );
    });

    it('should represent an ACTIVE device that can transition back to INVENTORY when it has a serial number', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.0.0.1').value,
        serialNumber: SerialNumber.create('SN-001').value,
        locationId: LocationId.create()
      });

      const result = device.changeStatus(
        DeviceStatus.createInventory()
      );

      expect(result.isSuccess).toBe(true);
      expect(device.status.isInInventory()).toBe(true);
    });

    it('should fail transitioning ACTIVE to INVENTORY when no serial or MAC is set', () => {
      const device = Device.reconstitute(DeviceId.create(), {
        ...makeProps({
          status: DeviceStatus.createActive(),
          ipAddress: IPAddress.create('10.0.0.1').value,
          serialNumber: null,
          macAddress: null
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = device.changeStatus(
        DeviceStatus.createInventory()
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('serial number or MAC address');
    });

    it('should fail creating an ACTIVE device without an IP address', () => {
      const result = Device.create(
        makeProps({
          status: DeviceStatus.createActive(),
          ipAddress: null
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address');
    });
  });

  // =========================================================================
  describe('DeviceCreatedEvent payload completeness', () => {
    it('should emit ownerType in the DeviceCreatedEvent', () => {
      const device = makeDevice({ ownerType: DeviceOwnerType.CLIENT });
      const event = device.domainEvents[0] as DeviceCreatedEvent;

      expect(event.ownerType).toBe(DeviceOwnerType.CLIENT);
    });

    it('should emit null ownerType when ownerType is not provided', () => {
      const result = Device.create({
        ...makeProps(),
        ownerType: undefined as unknown as DeviceOwnerType
      });
      // ownerType defaults to null via the ?? null coercion in create()
      const device = result.value;
      const event = device.domainEvents[0] as DeviceCreatedEvent;

      expect(event.ownerType).toBeNull();
    });

    it('should emit monitoringEnabled = false in the DeviceCreatedEvent when not provided', () => {
      const device = makeDevice({ monitoringEnabled: false });
      const event = device.domainEvents[0] as DeviceCreatedEvent;

      expect(event.monitoringEnabled).toBe(false);
    });

    it('should emit monitoringEnabled = true in the DeviceCreatedEvent when set', () => {
      const device = makeDevice({
        monitoringEnabled: true,
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.1.0.1').value,
        locationId: LocationId.create()
      });
      const event = device.domainEvents[0] as DeviceCreatedEvent;

      expect(event.monitoringEnabled).toBe(true);
    });

    it('should emit ipAddress in the DeviceCreatedEvent when set', () => {
      const ip = IPAddress.create('172.16.0.1').value;
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: ip,
        locationId: LocationId.create()
      });
      const event = device.domainEvents[0] as DeviceCreatedEvent;

      expect(event.ipAddress).toBe(ip);
    });

    it('should emit null ipAddress in the DeviceCreatedEvent when no IP is present', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: null
      });
      const event = device.domainEvents[0] as DeviceCreatedEvent;

      expect(event.ipAddress).toBeNull();
    });
  });

  // =========================================================================
  describe('DeviceStatusChangedEvent payload completeness', () => {
    it('should embed the correct aggregateId in the event', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: IPAddress.create('10.0.0.1').value
      });
      device.assignLocation(LocationId.create());
      device.clearEvents();
      device.changeStatus(DeviceStatus.createActive());

      const event = device.domainEvents[0] as DeviceStatusChangedEvent;

      expect(event.aggregateId.toString()).toBe(device.id.toString());
    });

    it('should embed the current device name in the event', () => {
      const device = makeDevice({
        name: DeviceName.create('Status-Test-Device').value,
        status: DeviceStatus.createInventory(),
        ipAddress: IPAddress.create('10.0.0.1').value
      });
      device.assignLocation(LocationId.create());
      device.clearEvents();
      device.changeStatus(DeviceStatus.createActive());

      const event = device.domainEvents[0] as DeviceStatusChangedEvent;

      expect(event.deviceName.value).toBe('Status-Test-Device');
    });
  });

  // =========================================================================
  describe('DeviceMonitoringToggledEvent payload completeness', () => {
    it('should carry the correct ipAddress when monitoring is enabled', () => {
      const ip = IPAddress.create('192.168.10.1').value;
      const device = makeDevice({
        monitoringEnabled: false,
        ipAddress: ip,
        status: DeviceStatus.createActive(),
        locationId: LocationId.create()
      });
      device.clearEvents();
      device.enableMonitoring();

      const event = device.domainEvents[0] as DeviceMonitoringToggledEvent;

      expect(event.ipAddress).toBe(ip);
    });

    it('should carry the correct ipAddress when monitoring is disabled', () => {
      const ip = IPAddress.create('192.168.10.2').value;
      const device = makeDevice({
        monitoringEnabled: true,
        ipAddress: ip,
        status: DeviceStatus.createActive(),
        locationId: LocationId.create()
      });
      device.clearEvents();
      device.disableMonitoring();

      const event = device.domainEvents[0] as DeviceMonitoringToggledEvent;

      expect(event.ipAddress).toBe(ip);
    });

    it('should carry the device name in the event', () => {
      const ip = IPAddress.create('10.5.0.1').value;
      const device = makeDevice({
        name: DeviceName.create('Monitored-AP-01').value,
        monitoringEnabled: false,
        ipAddress: ip,
        status: DeviceStatus.createActive(),
        locationId: LocationId.create()
      });
      device.clearEvents();
      device.enableMonitoring();

      const event = device.domainEvents[0] as DeviceMonitoringToggledEvent;

      expect(event.deviceName.value).toBe('Monitored-AP-01');
    });
  });

  // =========================================================================
  describe('DeviceDetailsUpdatedEvent payload completeness', () => {
    it('should emit a DeviceDetailsUpdatedEvent after a successful update', () => {
      const device = makeDevice();
      device.clearEvents();
      device.updateDetails({
        name: DeviceName.create('Renamed-Device').value
      });

      expect(device.domainEvents.length).toBe(1);
      expect(device.domainEvents[0]).toBeInstanceOf(DeviceDetailsUpdatedEvent);
    });

    it('should embed the correct aggregateId in the DeviceDetailsUpdatedEvent', () => {
      const device = makeDevice();
      device.clearEvents();
      device.updateDetails({
        name: DeviceName.create('Renamed-Device').value
      });

      const event = device.domainEvents[0] as DeviceDetailsUpdatedEvent;

      expect(event.aggregateId.toString()).toBe(device.id.toString());
    });

    it('should embed the updated device name in the DeviceDetailsUpdatedEvent', () => {
      const device = makeDevice();
      device.clearEvents();
      device.updateDetails({
        name: DeviceName.create('New-Name').value
      });

      const event = device.domainEvents[0] as DeviceDetailsUpdatedEvent;

      expect(event.deviceName.value).toBe('New-Name');
    });

    it('should carry updated description in the event updatedFields', () => {
      const device = makeDevice();
      device.clearEvents();
      device.updateDetails({ description: 'A useful description' });

      const event = device.domainEvents[0] as DeviceDetailsUpdatedEvent;

      expect(event.updatedFields.description).toBe('A useful description');
    });

    it('should not emit anything when called with an empty fields object', () => {
      const device = makeDevice();
      const before = device.updatedAt;
      device.clearEvents();
      const result = device.updateDetails({});

      expect(result.isSuccess).toBe(true);
      expect(device.domainEvents.length).toBe(0);
      expect(device.updatedAt).toBe(before);
    });
  });

  // =========================================================================
  describe('[DEV-046] [DEV-048] updateDetails() — macAddress and ipAddress fields', () => {
    it('should update macAddress when a valid MACAddress is provided', () => {
      const mac = MACAddress.create('11:22:33:44:55:66').value;
      const device = makeDevice({ macAddress: null });
      device.updateDetails({ macAddress: mac });

      expect(device.macAddress).toBe(mac);
    });

    it('should set macAddress to null when explicitly null is provided', () => {
      const device = makeDevice({
        macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value
      });
      device.updateDetails({ macAddress: null });

      expect(device.macAddress).toBeNull();
    });

    it('should not change macAddress when the field is not included', () => {
      const mac = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const device = makeDevice({ macAddress: mac });
      device.updateDetails({
        name: DeviceName.create('No-Mac-Change').value
      });

      expect(device.macAddress).toBe(mac);
    });

    it('should update ipAddress when a valid IPAddress is provided', () => {
      const ip = IPAddress.create('10.20.30.40').value;
      const device = makeDevice();
      device.updateDetails({ ipAddress: ip });

      expect(device.ipAddress).toBe(ip);
    });

    it('should set ipAddress to null when explicitly null is provided', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: IPAddress.create('10.0.0.1').value,
        serialNumber: SerialNumber.create('SN-IP-NULL').value
      });
      device.updateDetails({ ipAddress: null });

      expect(device.ipAddress).toBeNull();
    });

    it('should not change ipAddress when the field is not included', () => {
      const ip = IPAddress.create('10.0.0.99').value;
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        ipAddress: ip
      });
      device.updateDetails({ description: 'No IP change' });

      expect(device.ipAddress).toBe(ip);
    });

    it('should fail to null the ipAddress when monitoring is enabled', () => {
      const ip = IPAddress.create('10.0.0.1').value;
      const device = makeDevice({
        status: DeviceStatus.createCommissioning(),
        ipAddress: ip,
        monitoringEnabled: true
      });
      const result = device.updateDetails({ ipAddress: null });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address');
      expect(device.ipAddress).toBe(ip);
    });

    it('should fail to null the ipAddress of an ACTIVE device', () => {
      const ip = IPAddress.create('10.0.0.1').value;
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: ip,
        locationId: LocationId.create()
      });
      const result = device.updateDetails({ ipAddress: null });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address');
      expect(device.ipAddress).toBe(ip);
    });
  });

  // =========================================================================
  describe('disableMonitoring() no-op — updatedAt unchanged', () => {
    it('should not mutate updatedAt when already disabled', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      const id = DeviceId.create();
      const device = Device.reconstitute(id, {
        ...makeProps({ monitoringEnabled: false }),
        createdAt: now,
        updatedAt: now
      });

      device.disableMonitoring();

      // updatedAt should remain the reconstituted value because no mutation occurred
      expect(device.updatedAt).toEqual(now);
    });
  });
  // =========================================================================
  // Soft delete, restore, and replacement lineage
  // =========================================================================

  describe('[DEV-070] softDelete()', () => {
    it('should stamp deletedAt and deletedBy', () => {
      const device = makeDevice();
      const at = new Date('2026-08-11T10:00:00Z');

      const result = device.softDelete('user-1', at);

      expect(result.isSuccess).toBe(true);
      expect(device.isDeleted()).toBe(true);
      expect(device.deletedAt).toEqual(at);
      expect(device.deletedBy).toBe('user-1');
    });

    it('should accept a null actor', () => {
      const device = makeDevice();

      device.softDelete(null);

      expect(device.deletedBy).toBeNull();
    });

    it('should raise DeviceDeletedEvent', () => {
      const device = makeDevice();
      device.clearEvents();

      device.softDelete('user-1');

      const names = device.domainEvents.map((e) => e.constructor.name);
      expect(names).toContain('DeviceDeletedEvent');
    });

    it('should refuse a second delete', () => {
      const device = makeDevice();
      device.softDelete(null);

      const result = device.softDelete(null);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already deleted');
    });
  });

  describe('[DEV-071] softDelete() stops monitoring', () => {
    it('should turn monitoring off', () => {
      const device = makeDevice({
        status: DeviceStatus.createCommissioning(),
        ipAddress: IPAddress.create('10.0.0.9').value,
        monitoringEnabled: true
      });

      device.softDelete(null);

      expect(device.monitoringEnabled).toBe(false);
    });

    it('should raise DeviceMonitoringToggledEvent so the polling pipeline reacts', () => {
      const device = makeDevice({
        status: DeviceStatus.createCommissioning(),
        ipAddress: IPAddress.create('10.0.0.9').value,
        monitoringEnabled: true
      });
      device.clearEvents();

      device.softDelete(null);

      const toggled = device.domainEvents.find(
        (e) => e.constructor.name === 'DeviceMonitoringToggledEvent'
      );
      expect(toggled).toBeDefined();
    });

    it('should not raise a monitoring event when monitoring was already off', () => {
      const device = makeDevice({ monitoringEnabled: false });
      device.clearEvents();

      device.softDelete(null);

      const names = device.domainEvents.map((e) => e.constructor.name);
      expect(names).not.toContain('DeviceMonitoringToggledEvent');
    });
  });

  describe('[DEV-073] a deleted device rejects every mutation', () => {
    it('should refuse applyChanges', () => {
      const device = makeDevice();
      device.softDelete(null);

      const result = device.updateDetails({
        description: 'anything'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot modify a deleted device');
    });

    it('should refuse a status change', () => {
      const device = makeDevice();
      device.softDelete(null);

      const result = device.changeStatus(
        DeviceStatus.createDamaged()
      );

      expect(result.isFailure).toBe(true);
    });

    it('should leave the field unchanged after a refused mutation', () => {
      const device = makeDevice({ description: 'original' });
      device.softDelete(null);

      device.updateDetails({ description: 'overwritten' });

      expect(device.description).toBe('original');
    });
  });

  describe('[DEV-074] restore()', () => {
    it('should clear the tombstone inside the grace period', () => {
      const device = makeDevice();
      const deletedAt = new Date('2026-08-01T00:00:00Z');
      device.softDelete('user-1', deletedAt);

      const result = device.restore(
        new Date('2026-08-06T00:00:00Z'),
        7
      );

      expect(result.isSuccess).toBe(true);
      expect(device.isDeleted()).toBe(false);
      expect(device.deletedAt).toBeNull();
      expect(device.deletedBy).toBeNull();
    });

    it('should refuse once the grace period has expired', () => {
      const device = makeDevice();
      device.softDelete(null, new Date('2026-08-01T00:00:00Z'));

      const result = device.restore(
        new Date('2026-08-09T00:00:01Z'),
        7
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('grace period expired');
      expect(device.isDeleted()).toBe(true);
    });

    it('should allow a restore exactly on the boundary', () => {
      const device = makeDevice();
      device.softDelete(null, new Date('2026-08-01T00:00:00Z'));

      const result = device.restore(
        new Date('2026-08-08T00:00:00Z'),
        7
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should refuse to restore a device that is not deleted', () => {
      const device = makeDevice();

      const result = device.restore();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not deleted');
    });

    it('should leave monitoring off — restoring is not returning to service', () => {
      const device = makeDevice({
        status: DeviceStatus.createCommissioning(),
        ipAddress: IPAddress.create('10.0.0.9').value,
        monitoringEnabled: true
      });
      device.softDelete(null);

      device.restore();

      expect(device.monitoringEnabled).toBe(false);
    });

    it('should raise DeviceRestoredEvent', () => {
      const device = makeDevice();
      device.softDelete(null);
      device.clearEvents();

      device.restore();

      const names = device.domainEvents.map((e) => e.constructor.name);
      expect(names).toContain('DeviceRestoredEvent');
    });
  });

  describe('[DEV-078] [DEV-079] markReplaced()', () => {
    function makeReplaceable(): Device {
      return makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.0.0.5').value,
        locationId: LocationId.create(),
        monitoringEnabled: true
      });
    }

    it.each([
      ['INVENTORY', () => DeviceStatus.createInventory()],
      ['DAMAGED', () => DeviceStatus.createDamaged()],
      ['DECOMMISSIONED', () => DeviceStatus.createDecommissioned()]
    ])('should retire the unit into %s', (label, make) => {
      const device = makeReplaceable();

      const result = device.markReplaced(make());

      expect(result.isSuccess).toBe(true);
      expect(device.status.toString()).toBe(label);
    });

    it.each([
      ['ACTIVE', () => DeviceStatus.createActive()],
      ['COMMISSIONING', () => DeviceStatus.createCommissioning()]
    ])('should refuse to retire into %s', (_label, make) => {
      const device = makeReplaceable();

      const result = device.markReplaced(make());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('must be one of');
    });

    it('[DEV-079] should release the IP address for the successor', () => {
      const device = makeReplaceable();

      device.markReplaced(DeviceStatus.createInventory());

      expect(device.ipAddress).toBeNull();
    });

    it('should stamp replacedAt', () => {
      const device = makeReplaceable();
      const at = new Date('2026-08-11T12:00:00Z');

      device.markReplaced(DeviceStatus.createInventory(), at);

      expect(device.replacedAt).toEqual(at);
    });

    it('should stop monitoring', () => {
      const device = makeReplaceable();

      device.markReplaced(DeviceStatus.createInventory());

      expect(device.monitoringEnabled).toBe(false);
    });

    it('should raise DeviceReplacedEvent carrying the released IP', () => {
      const device = makeReplaceable();
      device.clearEvents();

      device.markReplaced(DeviceStatus.createInventory());

      const event = device.domainEvents.find(
        (e) => e.constructor.name === 'DeviceReplacedEvent'
      ) as unknown as {
        releasedIpAddress: { toString(): string } | null;
      };
      expect(event).toBeDefined();
      expect(event.releasedIpAddress?.toString()).toBe('10.0.0.5');
    });

    it('should raise DeviceStatusChangedEvent when the status actually moves', () => {
      const device = makeReplaceable();
      device.clearEvents();

      device.markReplaced(DeviceStatus.createInventory());

      const names = device.domainEvents.map((e) => e.constructor.name);
      expect(names).toContain('DeviceStatusChangedEvent');
    });

    it('[DEV-083] should refuse to replace a deleted device', () => {
      const device = makeReplaceable();
      device.softDelete(null);

      const result = device.markReplaced(
        DeviceStatus.createInventory()
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot replace a deleted device');
    });

    it('should refuse when the retired state would break an invariant', () => {
      // No serial and no MAC: every retired status demands an identifier.
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        serialNumber: null,
        macAddress: null,
        ipAddress: IPAddress.create('10.0.0.6').value,
        locationId: LocationId.create()
      });

      const result = device.markReplaced(
        DeviceStatus.createInventory()
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('serial number or MAC address');
    });
  });

  describe('[DEV-053] DECOMMISSIONED requires an identifier', () => {
    it('should refuse a DECOMMISSIONED device with neither serial nor MAC', () => {
      const result = Device.create(
        makeProps({
          status: DeviceStatus.createDecommissioned(),
          serialNumber: null,
          macAddress: null
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('serial number or MAC address');
    });

    it('should accept a DECOMMISSIONED device with a serial number', () => {
      const result = Device.create(
        makeProps({
          status: DeviceStatus.createDecommissioned()
        })
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('[DEV-057] monitoring cannot be on for a DECOMMISSIONED device', () => {
    it('should refuse the combination', () => {
      const result = Device.create(
        makeProps({
          status: DeviceStatus.createDecommissioned(),
          monitoringEnabled: true
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Monitoring can only be enabled');
    });
  });
});
