// Source: src/domain/device-inventory/aggregates/DeviceModel.ts

import {
  DeviceModel,
  DeviceModelProps,
  DeviceModelCreatedEvent,
  DeviceModelUpdatedEvent
} from '../../../../src/domain/device-inventory';
import { DeviceModelId, VendorId } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type CreateDeviceModelProps = Omit<DeviceModelProps, 'createdAt' | 'updatedAt'>;

function makeProps(
  overrides: Partial<CreateDeviceModelProps> = {}
): CreateDeviceModelProps {
  return {
    vendorId: VendorId.create(),
    vendorName: 'Cisco',
    vendorSlug: 'cisco',
    model: 'ISR-4321',
    deviceType: 'Router',
    ...overrides
  };
}

function makeDeviceModel(
  overrides: Partial<CreateDeviceModelProps> = {}
): DeviceModel {
  const result = DeviceModel.create(makeProps(overrides));
  if (result.isFailure) {
    throw new Error(`makeDeviceModel: ${result.error}`);
  }
  return result.value;
}

// ---------------------------------------------------------------------------
describe('DeviceModel', () => {
  // =========================================================================
  describe('create()', () => {
    describe('when given valid props', () => {
      it('should return a successful Result', () => {
        const result = DeviceModel.create(makeProps());

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should return a DeviceModel instance', () => {
        const result = DeviceModel.create(makeProps());

        expect(result.value).toBeInstanceOf(DeviceModel);
      });

      it('should assign a valid DeviceModelId', () => {
        const deviceModel = makeDeviceModel();

        expect(deviceModel.id).toBeInstanceOf(DeviceModelId);
        expect(deviceModel.id.toValue().length).toBeGreaterThan(0);
      });

      it('should expose the provided vendorId', () => {
        const vendorId = VendorId.create();
        const deviceModel = makeDeviceModel({ vendorId });

        expect(deviceModel.vendorId).toBe(vendorId);
      });

      it('should expose the provided vendorName', () => {
        const deviceModel = makeDeviceModel({ vendorName: 'MikroTik' });

        expect(deviceModel.vendorName).toBe('MikroTik');
      });

      it('should expose the provided vendorSlug', () => {
        const deviceModel = makeDeviceModel({ vendorSlug: 'mikrotik' });

        expect(deviceModel.vendorSlug).toBe('mikrotik');
      });

      it('should expose the provided model', () => {
        const deviceModel = makeDeviceModel({ model: 'RB750Gr3' });

        expect(deviceModel.model).toBe('RB750Gr3');
      });

      it('should expose the provided deviceType', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Switch' });

        expect(deviceModel.deviceType).toBe('Switch');
      });

      it('should set createdAt and updatedAt to recent timestamps', () => {
        const before = new Date();
        const deviceModel = makeDeviceModel();
        const after = new Date();

        expect(deviceModel.createdAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(deviceModel.createdAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
        expect(deviceModel.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(deviceModel.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should generate unique IDs for each created DeviceModel', () => {
        const a = makeDeviceModel();
        const b = makeDeviceModel();

        expect(a.id.toString()).not.toBe(b.id.toString());
      });
    });

    // -----------------------------------------------------------------------
    describe('required field validation', () => {
      it('should fail when vendorId is null', () => {
        const result = DeviceModel.create(
          makeProps({ vendorId: null as unknown as VendorId })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('vendorId');
      });

      it('should fail when vendorId is undefined', () => {
        const result = DeviceModel.create(
          makeProps({ vendorId: undefined as unknown as VendorId })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('vendorId');
      });

      it('should fail when model is null', () => {
        const result = DeviceModel.create(
          makeProps({ model: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('model');
      });

      it('should fail when model is undefined', () => {
        const result = DeviceModel.create(
          makeProps({ model: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('model');
      });

      it('should fail when model is an empty string', () => {
        const result = DeviceModel.create(makeProps({ model: '' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when model is a whitespace-only string', () => {
        const result = DeviceModel.create(makeProps({ model: '   ' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when model exceeds 150 characters', () => {
        const result = DeviceModel.create(
          makeProps({ model: 'A'.repeat(151) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });

      it('should succeed when model is exactly 150 characters', () => {
        const result = DeviceModel.create(
          makeProps({ model: 'A'.repeat(150) })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when deviceType is null', () => {
        const result = DeviceModel.create(
          makeProps({ deviceType: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should fail when deviceType is undefined', () => {
        const result = DeviceModel.create(
          makeProps({ deviceType: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });
    });

    // -----------------------------------------------------------------------
    describe('domain event emission', () => {
      it('should add exactly one domain event on successful creation', () => {
        const deviceModel = makeDeviceModel();

        expect(deviceModel.domainEvents.length).toBe(1);
      });

      it('should emit a DeviceModelCreatedEvent', () => {
        const deviceModel = makeDeviceModel();

        expect(deviceModel.domainEvents[0]).toBeInstanceOf(
          DeviceModelCreatedEvent
        );
      });

      it('should emit a DeviceModelCreatedEvent with the correct aggregate ID', () => {
        const deviceModel = makeDeviceModel();
        const event = deviceModel.domainEvents[0] as DeviceModelCreatedEvent;

        expect(event.aggregateId.toString()).toBe(
          deviceModel.id.toString()
        );
      });

      it('should emit a DeviceModelCreatedEvent with the correct vendorName', () => {
        const deviceModel = makeDeviceModel({ vendorName: 'Ubiquiti' });
        const event = deviceModel.domainEvents[0] as DeviceModelCreatedEvent;

        expect(event.vendorName).toBe('Ubiquiti');
      });

      it('should emit a DeviceModelCreatedEvent with the correct model', () => {
        const deviceModel = makeDeviceModel({ model: 'UniFi-AP-AC-Pro' });
        const event = deviceModel.domainEvents[0] as DeviceModelCreatedEvent;

        expect(event.model).toBe('UniFi-AP-AC-Pro');
      });

      it('should emit a DeviceModelCreatedEvent with a recent dateTimeOccurred', () => {
        const before = new Date();
        const deviceModel = makeDeviceModel();
        const after = new Date();
        const event = deviceModel.domainEvents[0] as DeviceModelCreatedEvent;

        expect(event.dateTimeOccurred.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should not emit a domain event when creation fails', () => {
        const result = DeviceModel.create(
          makeProps({ model: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        // No DeviceModel instance created — no events exist.
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a DeviceModel instance without emitting domain events', () => {
      const id = DeviceModelId.create();
      const now = new Date();
      const deviceModel = DeviceModel.reconstitute(id, {
        ...makeProps(),
        createdAt: now,
        updatedAt: now
      });

      expect(deviceModel).toBeInstanceOf(DeviceModel);
      expect(deviceModel.domainEvents.length).toBe(0);
    });

    it('should use the provided ID', () => {
      const id = DeviceModelId.create();
      const now = new Date();
      const deviceModel = DeviceModel.reconstitute(id, {
        ...makeProps(),
        createdAt: now,
        updatedAt: now
      });

      expect(deviceModel.id).toBe(id);
    });

    it('should expose all props it was given', () => {
      const id = DeviceModelId.create();
      const vendorId = VendorId.create();
      const createdAt = new Date('2023-01-01T00:00:00Z');
      const updatedAt = new Date('2023-06-01T00:00:00Z');

      const deviceModel = DeviceModel.reconstitute(id, {
        vendorId,
        vendorName: 'HP',
        vendorSlug: 'hp',
        model: 'ProCurve-2920',
        deviceType: 'Switch',
        createdAt,
        updatedAt
      });

      expect(deviceModel.vendorId).toBe(vendorId);
      expect(deviceModel.vendorName).toBe('HP');
      expect(deviceModel.vendorSlug).toBe('hp');
      expect(deviceModel.model).toBe('ProCurve-2920');
      expect(deviceModel.deviceType).toBe('Switch');
      expect(deviceModel.createdAt).toEqual(createdAt);
      expect(deviceModel.updatedAt).toEqual(updatedAt);
    });
  });

  // =========================================================================
  describe('updateModel()', () => {
    describe('happy path', () => {
      it('should return a successful Result when given a valid new model name', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateModel('ISR-4431');

        expect(result.isSuccess).toBe(true);
      });

      it('should update the model prop', () => {
        const deviceModel = makeDeviceModel({ model: 'Old-Model' });
        deviceModel.updateModel('New-Model');

        expect(deviceModel.model).toBe('New-Model');
      });

      it('should trim whitespace from the new model name', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.updateModel('  Trimmed-Model  ');

        expect(deviceModel.model).toBe('Trimmed-Model');
      });

      it('should update updatedAt timestamp', () => {
        const deviceModel = makeDeviceModel();
        const before = new Date();
        deviceModel.updateModel('Updated-Model');
        const after = new Date();

        expect(deviceModel.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(deviceModel.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should emit a DeviceModelUpdatedEvent', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateModel('ISR-4431');

        expect(deviceModel.domainEvents.length).toBe(1);
        expect(deviceModel.domainEvents[0]).toBeInstanceOf(
          DeviceModelUpdatedEvent
        );
      });

      it('should emit a DeviceModelUpdatedEvent with changedFields containing "model"', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateModel('ISR-4431');

        const event = deviceModel.domainEvents[0] as DeviceModelUpdatedEvent;

        expect(event.changedFields).toContain('model');
        expect(event.changedFields).toHaveLength(1);
      });

      it('should emit a DeviceModelUpdatedEvent with the correct aggregate ID', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateModel('ISR-4431');

        const event = deviceModel.domainEvents[0] as DeviceModelUpdatedEvent;

        expect(event.aggregateId.toString()).toBe(deviceModel.id.toString());
      });

      it('should emit a DeviceModelUpdatedEvent with the new model value', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateModel('ISR-4431');

        const event = deviceModel.domainEvents[0] as DeviceModelUpdatedEvent;

        expect(event.model).toBe('ISR-4431');
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when model is unchanged', () => {
      it('should return a successful Result without emitting an event', () => {
        const deviceModel = makeDeviceModel({ model: 'ISR-4321' });
        deviceModel.clearEvents();
        const result = deviceModel.updateModel('ISR-4321');

        expect(result.isSuccess).toBe(true);
        expect(deviceModel.domainEvents.length).toBe(0);
      });

      it('should not change updatedAt when the value is the same', () => {
        const deviceModel = makeDeviceModel({ model: 'ISR-4321' });
        const updatedAtBefore = deviceModel.updatedAt;
        deviceModel.updateModel('ISR-4321');

        expect(deviceModel.updatedAt).toBe(updatedAtBefore);
      });
    });

    // -----------------------------------------------------------------------
    describe('validation failures', () => {
      it('should fail when newModel is null', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateModel(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('model');
      });

      it('should fail when newModel is undefined', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateModel(undefined as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('model');
      });

      it('should fail when newModel is an empty string', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateModel('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when newModel is a whitespace-only string', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateModel('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when newModel exceeds 150 characters', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateModel('A'.repeat(151));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });

      it('should not change the model when validation fails', () => {
        const deviceModel = makeDeviceModel({ model: 'ISR-4321' });
        deviceModel.updateModel('');

        expect(deviceModel.model).toBe('ISR-4321');
      });

      it('should not emit an event when validation fails', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateModel('');

        expect(deviceModel.domainEvents.length).toBe(0);
      });
    });
  });

  // =========================================================================
  describe('updateDeviceType()', () => {
    describe('happy path', () => {
      it('should return a successful Result when given a valid new device type', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        const result = deviceModel.updateDeviceType('Switch');

        expect(result.isSuccess).toBe(true);
      });

      it('should update the deviceType prop', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        deviceModel.updateDeviceType('Switch');

        expect(deviceModel.deviceType).toBe('Switch');
      });

      it('should update updatedAt timestamp', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        const before = new Date();
        deviceModel.updateDeviceType('Switch');
        const after = new Date();

        expect(deviceModel.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(deviceModel.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should emit a DeviceModelUpdatedEvent', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        deviceModel.clearEvents();
        deviceModel.updateDeviceType('Switch');

        expect(deviceModel.domainEvents.length).toBe(1);
        expect(deviceModel.domainEvents[0]).toBeInstanceOf(
          DeviceModelUpdatedEvent
        );
      });

      it('should emit a DeviceModelUpdatedEvent with changedFields containing "deviceType"', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        deviceModel.clearEvents();
        deviceModel.updateDeviceType('Switch');

        const event = deviceModel.domainEvents[0] as DeviceModelUpdatedEvent;

        expect(event.changedFields).toContain('deviceType');
        expect(event.changedFields).toHaveLength(1);
      });

      it('should emit a DeviceModelUpdatedEvent with the correct aggregate ID', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        deviceModel.clearEvents();
        deviceModel.updateDeviceType('Switch');

        const event = deviceModel.domainEvents[0] as DeviceModelUpdatedEvent;

        expect(event.aggregateId.toString()).toBe(deviceModel.id.toString());
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when deviceType is unchanged', () => {
      it('should return a successful Result without emitting an event', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        deviceModel.clearEvents();
        const result = deviceModel.updateDeviceType('Router');

        expect(result.isSuccess).toBe(true);
        expect(deviceModel.domainEvents.length).toBe(0);
      });

      it('should not change updatedAt when the value is the same', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        const updatedAtBefore = deviceModel.updatedAt;
        deviceModel.updateDeviceType('Router');

        expect(deviceModel.updatedAt).toBe(updatedAtBefore);
      });
    });

    // -----------------------------------------------------------------------
    describe('validation failures', () => {
      it('should fail when newDeviceType is null', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateDeviceType(
          null as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should fail when newDeviceType is undefined', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateDeviceType(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should not change the deviceType when validation fails', () => {
        const deviceModel = makeDeviceModel({ deviceType: 'Router' });
        deviceModel.updateDeviceType(null as unknown as string);

        expect(deviceModel.deviceType).toBe('Router');
      });

      it('should not emit an event when validation fails', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateDeviceType(null as unknown as string);

        expect(deviceModel.domainEvents.length).toBe(0);
      });
    });
  });

  // =========================================================================
  describe('updateVendor()', () => {
    describe('happy path', () => {
      it('should return a successful Result when given valid vendor data', () => {
        const deviceModel = makeDeviceModel();
        const newVendorId = VendorId.create();
        const result = deviceModel.updateVendor(
          newVendorId,
          'MikroTik',
          'mikrotik'
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should update the vendorId prop', () => {
        const deviceModel = makeDeviceModel();
        const newVendorId = VendorId.create();
        deviceModel.updateVendor(newVendorId, 'MikroTik', 'mikrotik');

        expect(deviceModel.vendorId).toBe(newVendorId);
      });

      it('should update the vendorName prop', () => {
        const deviceModel = makeDeviceModel({ vendorName: 'Cisco' });
        deviceModel.updateVendor(VendorId.create(), 'MikroTik', 'mikrotik');

        expect(deviceModel.vendorName).toBe('MikroTik');
      });

      it('should update the vendorSlug prop', () => {
        const deviceModel = makeDeviceModel({ vendorSlug: 'cisco' });
        deviceModel.updateVendor(VendorId.create(), 'MikroTik', 'mikrotik');

        expect(deviceModel.vendorSlug).toBe('mikrotik');
      });

      it('should update updatedAt timestamp', () => {
        const deviceModel = makeDeviceModel();
        const before = new Date();
        deviceModel.updateVendor(VendorId.create(), 'MikroTik', 'mikrotik');
        const after = new Date();

        expect(deviceModel.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(deviceModel.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should emit a DeviceModelUpdatedEvent', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateVendor(VendorId.create(), 'MikroTik', 'mikrotik');

        expect(deviceModel.domainEvents.length).toBe(1);
        expect(deviceModel.domainEvents[0]).toBeInstanceOf(
          DeviceModelUpdatedEvent
        );
      });

      it('should emit a DeviceModelUpdatedEvent with changedFields containing "vendorId"', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateVendor(VendorId.create(), 'MikroTik', 'mikrotik');

        const event = deviceModel.domainEvents[0] as DeviceModelUpdatedEvent;

        expect(event.changedFields).toContain('vendorId');
        expect(event.changedFields).toHaveLength(1);
      });

      it('should emit a DeviceModelUpdatedEvent with the correct aggregate ID', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateVendor(VendorId.create(), 'MikroTik', 'mikrotik');

        const event = deviceModel.domainEvents[0] as DeviceModelUpdatedEvent;

        expect(event.aggregateId.toString()).toBe(deviceModel.id.toString());
      });
    });

    // -----------------------------------------------------------------------
    describe('validation failures', () => {
      it('should fail when vendorId is null', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateVendor(
          null as unknown as VendorId,
          'MikroTik',
          'mikrotik'
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('vendorId');
      });

      it('should fail when vendorId is undefined', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateVendor(
          undefined as unknown as VendorId,
          'MikroTik',
          'mikrotik'
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('vendorId');
      });

      it('should fail when vendorName is null', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateVendor(
          VendorId.create(),
          null as unknown as string,
          'mikrotik'
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('vendorName');
      });

      it('should fail when vendorSlug is null', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateVendor(
          VendorId.create(),
          'MikroTik',
          null as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('vendorSlug');
      });

      it('should not change the vendor when validation fails', () => {
        const originalVendorId = VendorId.create();
        const deviceModel = makeDeviceModel({
          vendorId: originalVendorId,
          vendorName: 'Cisco',
          vendorSlug: 'cisco'
        });
        deviceModel.updateVendor(
          null as unknown as VendorId,
          'MikroTik',
          'mikrotik'
        );

        expect(deviceModel.vendorName).toBe('Cisco');
        expect(deviceModel.vendorSlug).toBe('cisco');
      });

      it('should not emit an event when validation fails', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.clearEvents();
        deviceModel.updateVendor(
          null as unknown as VendorId,
          'MikroTik',
          'mikrotik'
        );

        expect(deviceModel.domainEvents.length).toBe(0);
      });
    });
  });

  // =========================================================================
  describe('domain event accumulation', () => {
    it('should have 1 event after create', () => {
      const deviceModel = makeDeviceModel();

      expect(deviceModel.domainEvents.length).toBe(1);
    });

    it('should have 2 events after create + one updateModel call', () => {
      const deviceModel = makeDeviceModel({ model: 'Old-Model' });
      deviceModel.updateModel('New-Model');

      expect(deviceModel.domainEvents.length).toBe(2);
    });

    it('should accumulate events across multiple update calls', () => {
      const deviceModel = makeDeviceModel({
        model: 'Old-Model',
        deviceType: 'Router'
      });
      deviceModel.updateModel('New-Model');
      deviceModel.updateDeviceType('Switch');
      deviceModel.updateVendor(VendorId.create(), 'HP', 'hp');

      expect(deviceModel.domainEvents.length).toBe(4);
      expect(deviceModel.domainEvents[0]).toBeInstanceOf(DeviceModelCreatedEvent);
      expect(deviceModel.domainEvents[1]).toBeInstanceOf(DeviceModelUpdatedEvent);
      expect(deviceModel.domainEvents[2]).toBeInstanceOf(DeviceModelUpdatedEvent);
      expect(deviceModel.domainEvents[3]).toBeInstanceOf(DeviceModelUpdatedEvent);
    });
  });

  // =========================================================================
  describe('clearEvents()', () => {
    it('should remove all domain events', () => {
      const deviceModel = makeDeviceModel();
      expect(deviceModel.domainEvents.length).toBe(1);

      deviceModel.clearEvents();

      expect(deviceModel.domainEvents.length).toBe(0);
    });

    it('should allow new events to accumulate after clearing', () => {
      const deviceModel = makeDeviceModel({ model: 'Old-Model' });
      deviceModel.clearEvents();

      deviceModel.updateModel('New-Model');

      expect(deviceModel.domainEvents.length).toBe(1);
    });
  });
});
