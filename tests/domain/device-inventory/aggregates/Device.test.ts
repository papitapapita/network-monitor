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

type CreateDeviceProps = Omit<DeviceProps, 'createdAt' | 'updatedAt'>;

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
          ipAddress: IPAddress.create('192.168.1.1').value
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
          status: DeviceStatus.createActive()
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
    describe('required field validation', () => {
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
    describe('INVENTORY / DAMAGED status invariant', () => {
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
    describe('ACTIVE status invariant', () => {
      it('should fail when ACTIVE status has no ipAddress', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: null
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('IP address');
      });

      it('should succeed when ACTIVE status has an ipAddress', () => {
        const result = Device.create(
          makeProps({
            status: DeviceStatus.createActive(),
            ipAddress: IPAddress.create('10.0.0.1').value
          })
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('category invariant', () => {
      it('should fail when a category is set but ipAddress is absent', () => {
        const result = Device.create(
          makeProps({
            category: DeviceCategory.createCpe(),
            ipAddress: null
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('IP address');
      });

      it('should succeed when a category is set and ipAddress is provided', () => {
        const result = Device.create(
          makeProps({
            category: DeviceCategory.createAp(),
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
          ipAddress: IPAddress.create('10.0.0.1').value
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
  describe('reconstitute()', () => {
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
      const category = DeviceCategory.createRouterboard();
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
      it('should return a successful Result when transitioning to a valid status after assigning an IP Address', () => {
        const device = makeDevice({
          status: DeviceStatus.createInventory()
        });
        device.clearEvents();
        device.updateDetails({
          ipAddress: IPAddress.create('192.168.1.1').value
        });
        const result = device.changeStatus(
          DeviceStatus.createActive()
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
    describe('INVENTORY / DAMAGED transition invariant', () => {
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
  });

  // =========================================================================
  describe('enableMonitoring()', () => {
    describe('happy path', () => {
      it('should return a successful Result', () => {
        const device = makeDevice({ monitoringEnabled: false });
        device.updateDetails({
          ipAddress: IPAddress.create('192.168.0.1').value
        });
        const result = device.enableMonitoring();

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when enabling monitoring without an IP Address', () => {
        const device = makeDevice({
          monitoringEnabled: false,
          ipAddress: null
        });
        const result = device.enableMonitoring();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('IP address');
      });

      it('should set monitoringEnabled to true', () => {
        const device = makeDevice({ monitoringEnabled: false });
        device.updateDetails({
          ipAddress: IPAddress.create('192.168.0.1').value
        });
        device.enableMonitoring();

        expect(device.monitoringEnabled).toBe(true);
      });

      it('should emit a DeviceMonitoringToggledEvent with monitoringEnabled = true', () => {
        const device = makeDevice({ monitoringEnabled: false });
        device.updateDetails({
          ipAddress: IPAddress.create('192.168.0.1').value
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
        const device = makeDevice({ monitoringEnabled: false });
        device.updateDetails({
          ipAddress: IPAddress.create('192.168.0.1').value
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
          status: DeviceStatus.createActive()
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
          status: DeviceStatus.createActive()
        });
        const result = device.disableMonitoring();

        expect(result.isSuccess).toBe(true);
      });

      it('should set monitoringEnabled to false', () => {
        const device = makeDevice({
          monitoringEnabled: true,
          ipAddress: IPAddress.create('10.0.0.1').value,
          status: DeviceStatus.createActive()
        });
        device.disableMonitoring();

        expect(device.monitoringEnabled).toBe(false);
      });

      it('should emit a DeviceMonitoringToggledEvent with monitoringEnabled = false', () => {
        const device = makeDevice({
          monitoringEnabled: true,
          ipAddress: IPAddress.create('10.0.0.1').value,
          status: DeviceStatus.createActive()
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
          status: DeviceStatus.createActive()
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
    describe('name update', () => {
      it('should update the name when a valid string is provided', () => {
        const device = makeDevice();
        device.updateDetails({ name: 'Updated-Router' });

        expect(device.name.value).toBe('Updated-Router');
      });

      it('should fail when name is empty', () => {
        const device = makeDevice();
        const result = device.updateDetails({ name: '' });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when name exceeds 150 characters', () => {
        const device = makeDevice();
        const result = device.updateDetails({
          name: 'A'.repeat(151)
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });

      it('should not change the name when validation fails', () => {
        const device = makeDevice({
          name: DeviceName.create('Good-Name').value
        });
        device.updateDetails({ name: '' });

        expect(device.name.value).toBe('Good-Name');
      });
    });

    // -----------------------------------------------------------------------
    describe('description update', () => {
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
        device.updateDetails({ name: 'New-Name' });

        expect(device.description).toBe('Keep me');
      });
    });

    // -----------------------------------------------------------------------
    describe('category update', () => {
      it('should update the category', () => {
        const device = makeDevice();
        device.updateDetails({
          category: DeviceCategory.createCpe()
        });

        expect(device.category!.isCpe()).toBe(true);
      });

      it('should set category to null when explicitly null', () => {
        const device = makeDevice({
          category: DeviceCategory.createAp(),
          ipAddress: IPAddress.create('10.0.0.1').value
        });
        device.updateDetails({ category: null });

        expect(device.category).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('serialNumber update', () => {
      it('should update the serial number when a valid string is provided', () => {
        const device = makeDevice();
        device.updateDetails({ serialNumber: 'SN-NEW-001' });

        expect(device.serialNumber!.value).toBe('SN-NEW-001');
      });

      it('should fail when serial number is empty', () => {
        const device = makeDevice();
        const result = device.updateDetails({ serialNumber: '' });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should set serialNumber to null when explicitly null', () => {
        const device = makeDevice({
          serialNumber: SerialNumber.create('SN-OLD').value
        });
        device.updateDetails({ serialNumber: null });

        expect(device.serialNumber).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('ownerType update', () => {
      it('should update the ownerType', () => {
        const device = makeDevice({
          ownerType: DeviceOwnerType.COMPANY
        });
        device.updateDetails({ ownerType: DeviceOwnerType.CLIENT });

        expect(device.ownerType).toBe(DeviceOwnerType.CLIENT);
      });
    });

    // -----------------------------------------------------------------------
    describe('installedDate update', () => {
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
    });

    // -----------------------------------------------------------------------
    describe('updatedAt timestamp', () => {
      it('should update updatedAt on a successful update', () => {
        const device = makeDevice();
        const before = new Date();
        device.updateDetails({ name: 'Updated-Name' });
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
    it('isActive() should return true when status is ACTIVE', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.0.0.1').value
      });

      expect(device.isActive()).toBe(true);
    });

    it('isActive() should return false when status is not ACTIVE', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory()
      });

      expect(device.isActive()).toBe(false);
    });

    it('isInInventory() should return true when status is INVENTORY', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory()
      });

      expect(device.isInInventory()).toBe(true);
    });

    it('isInInventory() should return false when status is not INVENTORY', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.0.0.1').value
      });

      expect(device.isInInventory()).toBe(false);
    });

    it('hasLocation() should return false when locationId is null', () => {
      const device = makeDevice({ locationId: null });

      expect(device.hasLocation()).toBe(false);
    });

    it('hasLocation() should return true when locationId is set', () => {
      const device = makeDevice({ locationId: LocationId.create() });

      expect(device.hasLocation()).toBe(true);
    });

    it('isMonitored() should reflect the monitoringEnabled flag', () => {
      const enabled = makeDevice({
        monitoringEnabled: true,
        ipAddress: IPAddress.create('10.0.0.1').value,
        status: DeviceStatus.createActive()
      });
      const disabled = makeDevice({ monitoringEnabled: false });

      expect(enabled.isMonitored()).toBe(true);
      expect(disabled.isMonitored()).toBe(false);
    });

    it('hasLocation() should reflect updated state after assignLocation', () => {
      const device = makeDevice({ locationId: null });
      expect(device.hasLocation()).toBe(false);

      device.assignLocation(LocationId.create());
      expect(device.hasLocation()).toBe(true);

      device.assignLocation(null);
      expect(device.hasLocation()).toBe(false);
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
      const device = makeDevice({ monitoringEnabled: false });
      device.updateDetails({
        ipAddress: IPAddress.create('192.168.0.1').value
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
        category: DeviceCategory.createSmartSwitch(),
        serialNumber: SerialNumber.create('SN-DIST-2024-001').value,
        macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
        ipAddress: IPAddress.create('10.0.1.1').value,
        description: 'Core distribution switch on floor 1',
        installedDate: new Date('2023-09-01T00:00:00Z'),
        monitoringEnabled: true
      });

      expect(result.isSuccess).toBe(true);
      const device = result.value;
      expect(device.isActive()).toBe(true);
      expect(device.isMonitored()).toBe(true);
      expect(device.hasLocation()).toBe(true);
      expect(device.category!.isSmartSwitch()).toBe(true);
    });

    it('should allow sequential state changes and accumulate matching events', () => {
      const device = makeDevice({
        status: DeviceStatus.createInventory(),
        monitoringEnabled: false
      });
      device.clearEvents();

      device.updateDetails({
        ipAddress: IPAddress.create('192.168.1.1').value
      });
      device.changeStatus(DeviceStatus.createActive());
      device.assignLocation(LocationId.create());
      device.enableMonitoring();

      expect(device.domainEvents.length).toBe(4);
      expect(device.domainEvents[0]).toBeInstanceOf(
        DeviceDetailsUpdatedEvent
      );
      expect(device.domainEvents[1]).toBeInstanceOf(
        DeviceStatusChangedEvent
      );
      expect(device.domainEvents[2]).toBeInstanceOf(
        DeviceLocationAssignedEvent
      );
      expect(device.domainEvents[3]).toBeInstanceOf(
        DeviceMonitoringToggledEvent
      );
    });

    it('should represent an ACTIVE device that can transition back to INVENTORY when it has a serial number', () => {
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: IPAddress.create('10.0.0.1').value,
        serialNumber: SerialNumber.create('SN-001').value
      });

      const result = device.changeStatus(
        DeviceStatus.createInventory()
      );

      expect(result.isSuccess).toBe(true);
      expect(device.isInInventory()).toBe(true);
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
  describe('canHaveWirelessConfig()', () => {
    it('should return false when the device has no category', () => {
      const device = makeDevice({ category: null });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });

    it('should return true when category is WIRELESS_CPE', () => {
      const device = makeDevice({
        category: DeviceCategory.createWirelessCpe(),
        ipAddress: IPAddress.create('10.0.0.1').value
      });

      expect(device.canHaveWirelessConfig()).toBe(true);
    });

    it('should return true when category is AP', () => {
      const device = makeDevice({
        category: DeviceCategory.createAp(),
        ipAddress: IPAddress.create('10.0.0.2').value
      });

      expect(device.canHaveWirelessConfig()).toBe(true);
    });

    it('should return false when category is CPE', () => {
      const device = makeDevice({
        category: DeviceCategory.createCpe(),
        ipAddress: IPAddress.create('10.0.0.3').value
      });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });

    it('should return false when category is ROUTERBOARD', () => {
      const device = makeDevice({
        category: DeviceCategory.createRouterboard(),
        ipAddress: IPAddress.create('10.0.0.4').value
      });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });

    it('should return false when category is SMART_SWITCH', () => {
      const device = makeDevice({
        category: DeviceCategory.createSmartSwitch(),
        ipAddress: IPAddress.create('10.0.0.5').value
      });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });

    it('should return false when category is SMART_SWITCH_POE', () => {
      const device = makeDevice({
        category: DeviceCategory.createSmartSwitchPoe(),
        ipAddress: IPAddress.create('10.0.0.6').value
      });

      expect(device.canHaveWirelessConfig()).toBe(false);
    });

    it('should return false when category is OTHER', () => {
      const device = makeDevice({
        category: DeviceCategory.createOther(),
        ipAddress: IPAddress.create('10.0.0.7').value
      });

      expect(device.canHaveWirelessConfig()).toBe(false);
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
        ipAddress: IPAddress.create('10.1.0.1').value
      });
      const event = device.domainEvents[0] as DeviceCreatedEvent;

      expect(event.monitoringEnabled).toBe(true);
    });

    it('should emit ipAddress in the DeviceCreatedEvent when set', () => {
      const ip = IPAddress.create('172.16.0.1').value;
      const device = makeDevice({
        status: DeviceStatus.createActive(),
        ipAddress: ip
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
        status: DeviceStatus.createActive()
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
        status: DeviceStatus.createActive()
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
        status: DeviceStatus.createActive()
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
      device.updateDetails({ name: 'Renamed-Device' });

      expect(device.domainEvents.length).toBe(1);
      expect(device.domainEvents[0]).toBeInstanceOf(DeviceDetailsUpdatedEvent);
    });

    it('should embed the correct aggregateId in the DeviceDetailsUpdatedEvent', () => {
      const device = makeDevice();
      device.clearEvents();
      device.updateDetails({ name: 'Renamed-Device' });

      const event = device.domainEvents[0] as DeviceDetailsUpdatedEvent;

      expect(event.aggregateId.toString()).toBe(device.id.toString());
    });

    it('should embed the updated device name in the DeviceDetailsUpdatedEvent', () => {
      const device = makeDevice();
      device.clearEvents();
      device.updateDetails({ name: 'New-Name' });

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

    it('should still emit DeviceDetailsUpdatedEvent even when called with an empty fields object', () => {
      const device = makeDevice();
      device.clearEvents();
      const result = device.updateDetails({});

      expect(result.isSuccess).toBe(true);
      expect(device.domainEvents.length).toBe(1);
      expect(device.domainEvents[0]).toBeInstanceOf(DeviceDetailsUpdatedEvent);
    });
  });

  // =========================================================================
  describe('updateDetails() — macAddress and ipAddress fields', () => {
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
      device.updateDetails({ name: 'No-Mac-Change' });

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
});
