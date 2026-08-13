// Source: src/domain/device-inventory/services/DeviceEligibilityService.ts

import {
  Device,
  DeviceCategory,
  DeviceEligibilityService,
  DeviceName,
  DeviceOwnerType,
  DeviceStatus,
  SerialNumber
} from '../../../../src/domain/device-inventory';
import { DeviceId, DeviceModelId } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ReconstituteProps = Parameters<typeof Device.reconstitute>[1];

// reconstitute() rather than create(), so a test can arrange states the
// aggregate's invariants forbid — a deleted device that still has monitoring
// on is exactly the drift this service exists to catch.
function makeProps(
  overrides: Partial<ReconstituteProps> = {}
): ReconstituteProps {
  return {
    deviceModelId: DeviceModelId.create(),
    name: DeviceName.create('CPE-Vargas').value,
    status: DeviceStatus.createActive(),
    ownerType: DeviceOwnerType.COMPANY,
    locationId: null,
    category: null,
    serialNumber: SerialNumber.create('SN-DEFAULT').value,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    monitoringEnabled: true,
    ...overrides
  };
}

function makeDevice(
  overrides: Partial<ReconstituteProps> = {}
): Device {
  return Device.reconstitute(DeviceId.create(), makeProps(overrides));
}

const RETIRED_STATUSES: Array<[string, DeviceStatus]> = [
  ['INVENTORY', DeviceStatus.createInventory()],
  ['DAMAGED', DeviceStatus.createDamaged()],
  ['DECOMMISSIONED', DeviceStatus.createDecommissioned()]
];

// ---------------------------------------------------------------------------

describe('DeviceEligibilityService', () => {
  let service: DeviceEligibilityService;

  beforeEach(() => {
    service = new DeviceEligibilityService();
  });

  describe('[DEV-086] canPoll()', () => {
    it('should allow an ACTIVE device with monitoring enabled', () => {
      const decision = service.canPoll(makeDevice());

      expect(decision.eligible).toBe(true);
    });

    it('should allow a COMMISSIONING device — a unit is monitored while it is being installed', () => {
      const device = makeDevice({
        status: DeviceStatus.createCommissioning()
      });

      expect(service.canPoll(device).eligible).toBe(true);
    });

    it('should deny a deleted device', () => {
      const device = makeDevice({ deletedAt: new Date() });

      const decision = service.canPoll(device);

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'DEVICE_DELETED'
      });
    });

    it('should deny a replaced device', () => {
      const device = makeDevice({
        replacedByDeviceId: DeviceId.create()
      });

      const decision = service.canPoll(device);

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'DEVICE_REPLACED'
      });
    });

    it.each(RETIRED_STATUSES)(
      'should deny a device in %s',
      (_label, status) => {
        const decision = service.canPoll(makeDevice({ status }));

        expect(decision).toMatchObject({
          eligible: false,
          reason: 'DEVICE_RETIRED'
        });
      }
    );

    it('should deny a device with monitoring disabled', () => {
      const device = makeDevice({ monitoringEnabled: false });

      const decision = service.canPoll(device);

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'MONITORING_DISABLED'
      });
    });

    it('should report deletion ahead of status when a device is both deleted and retired', () => {
      const device = makeDevice({
        status: DeviceStatus.createDamaged(),
        deletedAt: new Date()
      });

      const decision = service.canPoll(device);

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'DEVICE_DELETED'
      });
    });
  });

  describe('[DEV-087] canAlert()', () => {
    it('should allow an ACTIVE device', () => {
      expect(service.canAlert(makeDevice()).eligible).toBe(true);
    });

    it('should allow a COMMISSIONING device', () => {
      const device = makeDevice({
        status: DeviceStatus.createCommissioning()
      });

      expect(service.canAlert(device).eligible).toBe(true);
    });

    // The flag is the stale-cache problem this service routes around, so it
    // must not gate alerting.
    it('should allow a device whose monitoring flag is off', () => {
      const device = makeDevice({ monitoringEnabled: false });

      expect(service.canAlert(device).eligible).toBe(true);
    });

    it('should deny a deleted device', () => {
      const device = makeDevice({ deletedAt: new Date() });

      const decision = service.canAlert(device);

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'DEVICE_DELETED'
      });
    });

    it('should deny a replaced device', () => {
      const device = makeDevice({
        replacedByDeviceId: DeviceId.create()
      });

      const decision = service.canAlert(device);

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'DEVICE_REPLACED'
      });
    });

    it.each(RETIRED_STATUSES)(
      'should deny a device in %s',
      (_label, status) => {
        const decision = service.canAlert(makeDevice({ status }));

        expect(decision).toMatchObject({
          eligible: false,
          reason: 'DEVICE_RETIRED'
        });
      }
    );
  });

  describe('[DEV-088] canPollWireless()', () => {
    it('should allow an ACTIVE WIRELESS_CPE', () => {
      const device = makeDevice({
        category: DeviceCategory.createWirelessCpe()
      });

      expect(service.canPollWireless(device).eligible).toBe(true);
    });

    it('should allow an ACTIVE ACCESS_POINT', () => {
      const device = makeDevice({
        category: DeviceCategory.createAccessPoint()
      });

      expect(service.canPollWireless(device).eligible).toBe(true);
    });

    it('should deny a device with no category', () => {
      const decision = service.canPollWireless(
        makeDevice({ category: null })
      );

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'NOT_WIRELESS_CAPABLE'
      });
    });

    it('should deny a non-radio category', () => {
      const device = makeDevice({
        category: DeviceCategory.createGateway()
      });

      const decision = service.canPollWireless(device);

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'NOT_WIRELESS_CAPABLE'
      });
    });

    it('should inherit the polling guards ahead of the capability check', () => {
      const device = makeDevice({
        category: DeviceCategory.createWirelessCpe(),
        deletedAt: new Date()
      });

      const decision = service.canPollWireless(device);

      expect(decision).toMatchObject({
        eligible: false,
        reason: 'DEVICE_DELETED'
      });
    });
  });
});
