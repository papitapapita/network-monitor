// Source: src/domain/device-inventory/services/UpstreamLinkPolicy.ts

import {
  Device,
  DeviceName,
  DeviceStatus,
  SerialNumber,
  UpstreamLinkPolicy
} from '../../../../src/domain/device-inventory';
import {
  DeviceId,
  DeviceModelId,
  IPAddress,
  LocationId
} from '../../../../src/domain/shared';

function makeDevice(
  name: string,
  status: DeviceStatus = DeviceStatus.createActive()
): Device {
  const onNetwork = status.isActive() || status.isCommissioning();
  return Device.create({
    deviceModelId: DeviceModelId.create(),
    name: DeviceName.create(name).value,
    status,
    ownerType: null,
    category: null,
    locationId: LocationId.create(),
    serialNumber: SerialNumber.create(`SN-${name}`).value,
    macAddress: null,
    ipAddress: onNetwork ? IPAddress.create('10.0.0.1').value : null,
    description: null,
    installedDate: null,
    monitoringEnabled: false
  }).value;
}

describe('UpstreamLinkPolicy', () => {
  it('accepts an ACTIVE upstream with nothing above it', () => {
    const result = UpstreamLinkPolicy.check(
      makeDevice('CPE'),
      makeDevice('AP'),
      []
    );

    expect(result.isSuccess).toBe(true);
  });

  it('[DEV-183] accepts a COMMISSIONING upstream', () => {
    const result = UpstreamLinkPolicy.check(
      makeDevice('CPE'),
      makeDevice('AP', DeviceStatus.createCommissioning()),
      []
    );

    expect(result.isSuccess).toBe(true);
  });

  it.each([
    ['INVENTORY', () => DeviceStatus.createInventory()],
    ['DAMAGED', () => DeviceStatus.createDamaged()],
    ['DECOMMISSIONED', () => DeviceStatus.createDecommissioned()]
  ])('[DEV-183] refuses an upstream that is %s', (label, make) => {
    const result = UpstreamLinkPolicy.check(
      makeDevice('CPE'),
      makeDevice('AP', make()),
      []
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(`not ${label}`);
  });

  it('[DEV-183] refuses a deleted upstream', () => {
    const upstream = makeDevice('AP');
    upstream.softDelete('user-1');

    const result = UpstreamLinkPolicy.check(
      makeDevice('CPE'),
      upstream,
      []
    );

    expect(result.error).toContain('has been deleted');
  });

  it('[DEV-182] refuses an upstream that hangs off the device itself', () => {
    const sw = makeDevice('Switch');
    const ap = makeDevice('AP');

    const result = UpstreamLinkPolicy.check(sw, ap, [
      DeviceId.parse(sw.id.toString()).value
    ]);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('loop');
  });

  it('[DEV-182] refuses a loop closed further up the chain', () => {
    const router = makeDevice('Router');
    const cpe = makeDevice('CPE');

    const result = UpstreamLinkPolicy.check(router, cpe, [
      DeviceId.create(),
      DeviceId.create(),
      DeviceId.parse(router.id.toString()).value
    ]);

    expect(result.isFailure).toBe(true);
  });
});
