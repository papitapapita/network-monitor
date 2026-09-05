// Source: src/domain/device-inventory/aggregates/DeviceModel.ts

import {
  DeviceModel,
  DeviceModelProps,
  DeviceType
} from '../../../../src/domain/device-inventory';
import {
  DeviceModelId,
  VendorId
} from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type CreateDeviceModelProps = Omit<
  DeviceModelProps,
  'createdAt' | 'updatedAt'
>;

function makeProps(
  overrides: Partial<CreateDeviceModelProps> = {}
): CreateDeviceModelProps {
  return {
    vendorId: VendorId.create(),
    vendorName: 'Cisco',
    vendorSlug: 'cisco',
    model: 'ISR-4321',
    deviceType: DeviceType.reconstitute(DeviceType.ROUTER),
    isWireless: false,
    imageUrl: null,
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
        const deviceModel = makeDeviceModel({
          vendorName: 'MikroTik'
        });

        expect(deviceModel.vendorName).toBe('MikroTik');
      });

      it('should expose the provided vendorSlug', () => {
        const deviceModel = makeDeviceModel({
          vendorSlug: 'mikrotik'
        });

        expect(deviceModel.vendorSlug).toBe('mikrotik');
      });

      it('should expose the provided model', () => {
        const deviceModel = makeDeviceModel({ model: 'RB750Gr3' });

        expect(deviceModel.model).toBe('RB750Gr3');
      });

      it('should expose the provided deviceType', () => {
        const deviceModel = makeDeviceModel({
          deviceType: DeviceType.reconstitute(DeviceType.SWITCH)
        });

        expect(deviceModel.deviceType.value).toBe(DeviceType.SWITCH);
      });

      it('should set createdAt and updatedAt to recent timestamps', () => {
        const before = new Date();
        const deviceModel = makeDeviceModel();
        const after = new Date();

        expect(
          deviceModel.createdAt.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
        expect(deviceModel.createdAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
        expect(
          deviceModel.updatedAt.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
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
    describe('[DEV-025] isWireless default', () => {
      it('should default isWireless to false when not provided', () => {
        const props = makeProps();
        delete (props as Partial<CreateDeviceModelProps>).isWireless;

        const result = DeviceModel.create(
          props as CreateDeviceModelProps
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.isWireless).toBe(false);
      });

      it('should respect an explicit isWireless=true', () => {
        const result = DeviceModel.create(
          makeProps({ isWireless: true })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.isWireless).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-020] required field validation', () => {
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
        const result = DeviceModel.create(
          makeProps({ model: '   ' })
        );

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
          makeProps({ deviceType: null as unknown as DeviceType })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should fail when deviceType is undefined', () => {
        const result = DeviceModel.create(
          makeProps({
            deviceType: undefined as unknown as DeviceType
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
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
        deviceType: DeviceType.reconstitute(DeviceType.SWITCH),
        isWireless: false,
        imageUrl: null,
        createdAt,
        updatedAt
      });

      expect(deviceModel.vendorId).toBe(vendorId);
      expect(deviceModel.vendorName).toBe('HP');
      expect(deviceModel.vendorSlug).toBe('hp');
      expect(deviceModel.model).toBe('ProCurve-2920');
      expect(deviceModel.deviceType.value).toBe(DeviceType.SWITCH);
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

        expect(
          deviceModel.updatedAt.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
        expect(deviceModel.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when model is unchanged', () => {
      it('should return a successful Result and emit no events', () => {
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
    describe('[DEV-023] validation failures', () => {
      it('should fail when newModel is null', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateModel(
          null as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('model');
      });

      it('should fail when newModel is undefined', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateModel(
          undefined as unknown as string
        );

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
    });
  });

  // =========================================================================
  describe('updateDeviceType()', () => {
    describe('happy path', () => {
      it('should return a successful Result when given a valid new device type', () => {
        const deviceModel = makeDeviceModel({
          deviceType: DeviceType.reconstitute(DeviceType.ROUTER)
        });
        const result = deviceModel.updateDeviceType(
          DeviceType.reconstitute(DeviceType.SWITCH)
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should update the deviceType prop', () => {
        const deviceModel = makeDeviceModel({
          deviceType: DeviceType.reconstitute(DeviceType.ROUTER)
        });
        deviceModel.updateDeviceType(
          DeviceType.reconstitute(DeviceType.SWITCH)
        );

        expect(deviceModel.deviceType.value).toBe(DeviceType.SWITCH);
      });

      it('should update updatedAt timestamp', () => {
        const deviceModel = makeDeviceModel({
          deviceType: DeviceType.reconstitute(DeviceType.ROUTER)
        });
        const before = new Date();
        deviceModel.updateDeviceType(
          DeviceType.reconstitute(DeviceType.SWITCH)
        );
        const after = new Date();

        expect(
          deviceModel.updatedAt.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
        expect(deviceModel.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when deviceType is unchanged', () => {
      it('should return a successful Result and emit no events', () => {
        const deviceModel = makeDeviceModel({
          deviceType: DeviceType.reconstitute(DeviceType.ROUTER)
        });
        deviceModel.clearEvents();
        const result = deviceModel.updateDeviceType(
          DeviceType.reconstitute(DeviceType.ROUTER)
        );

        expect(result.isSuccess).toBe(true);
        expect(deviceModel.domainEvents.length).toBe(0);
      });

      it('should not change updatedAt when the value is the same', () => {
        const deviceModel = makeDeviceModel({
          deviceType: DeviceType.reconstitute(DeviceType.ROUTER)
        });
        const updatedAtBefore = deviceModel.updatedAt;
        deviceModel.updateDeviceType(
          DeviceType.reconstitute(DeviceType.ROUTER)
        );

        expect(deviceModel.updatedAt).toBe(updatedAtBefore);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-024] validation failures', () => {
      it('should fail when newDeviceType is null', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateDeviceType(
          null as unknown as DeviceType
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should fail when newDeviceType is undefined', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateDeviceType(
          undefined as unknown as DeviceType
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should not change the deviceType when validation fails', () => {
        const deviceModel = makeDeviceModel({
          deviceType: DeviceType.reconstitute(DeviceType.ROUTER)
        });
        deviceModel.updateDeviceType(null as unknown as DeviceType);

        expect(deviceModel.deviceType.value).toBe(DeviceType.ROUTER);
      });
    });
  });

  // =========================================================================
  describe('updateImageUrl()', () => {
    describe('happy path', () => {
      it('should return a successful Result when given a valid URL', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateImageUrl(
          'https://example.com/camera.jpg'
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should update the imageUrl prop', () => {
        const deviceModel = makeDeviceModel();
        deviceModel.updateImageUrl('https://example.com/camera.jpg');

        expect(deviceModel.imageUrl).toBe(
          'https://example.com/camera.jpg'
        );
      });

      it('should allow clearing the imageUrl back to null', () => {
        const deviceModel = makeDeviceModel({
          imageUrl: 'https://example.com/camera.jpg'
        });
        deviceModel.updateImageUrl(null);

        expect(deviceModel.imageUrl).toBeNull();
      });

      it('should update updatedAt timestamp', () => {
        const deviceModel = makeDeviceModel();
        const before = new Date();
        deviceModel.updateImageUrl('https://example.com/camera.jpg');
        const after = new Date();

        expect(
          deviceModel.updatedAt.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
        expect(deviceModel.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when imageUrl is unchanged', () => {
      it('should return a successful Result and emit no events', () => {
        const deviceModel = makeDeviceModel({
          imageUrl: 'https://example.com/camera.jpg'
        });
        deviceModel.clearEvents();
        const result = deviceModel.updateImageUrl(
          'https://example.com/camera.jpg'
        );

        expect(result.isSuccess).toBe(true);
        expect(deviceModel.domainEvents.length).toBe(0);
      });

      it('should not change updatedAt when the value is the same', () => {
        const deviceModel = makeDeviceModel({
          imageUrl: 'https://example.com/camera.jpg'
        });
        const updatedAtBefore = deviceModel.updatedAt;
        deviceModel.updateImageUrl('https://example.com/camera.jpg');

        expect(deviceModel.updatedAt).toBe(updatedAtBefore);
      });
    });

    // -----------------------------------------------------------------------
    describe('validation failures', () => {
      it('should fail when a non-string, non-null value is given', () => {
        const deviceModel = makeDeviceModel();
        const result = deviceModel.updateImageUrl(
          42 as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('imageUrl');
      });
    });
  });

  // =========================================================================
  describe('updateVendor()', () => {
    describe('[DEV-028] happy path', () => {
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
        deviceModel.updateVendor(
          VendorId.create(),
          'MikroTik',
          'mikrotik'
        );

        expect(deviceModel.vendorName).toBe('MikroTik');
      });

      it('should update the vendorSlug prop', () => {
        const deviceModel = makeDeviceModel({ vendorSlug: 'cisco' });
        deviceModel.updateVendor(
          VendorId.create(),
          'MikroTik',
          'mikrotik'
        );

        expect(deviceModel.vendorSlug).toBe('mikrotik');
      });

      it('should update updatedAt timestamp', () => {
        const deviceModel = makeDeviceModel();
        const before = new Date();
        deviceModel.updateVendor(
          VendorId.create(),
          'MikroTik',
          'mikrotik'
        );
        const after = new Date();

        expect(
          deviceModel.updatedAt.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
        expect(deviceModel.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
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
    });
  });
});
