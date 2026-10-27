// Source: src/infrastructure/wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter.ts

import { WirelessDeviceRepositoryAdapter } from '../../../../src/infrastructure/wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { PrismaDeviceRepository } from '../../../../src/infrastructure/persistence/PrismaDeviceRepository';
import { UpstreamAssignment } from '../../../../src/application/device-inventory/services';
import {
  Device,
  DeviceEligibilityService,
  DeviceName,
  DeviceStatus,
  SerialNumber
} from '../../../../src/domain/device-inventory';
import {
  DeviceId,
  DeviceModelId,
  IPAddress,
  LocationId,
  Result
} from '../../../../src/domain/shared';

function makeDevice(name: string): Device {
  return Device.create({
    deviceModelId: DeviceModelId.create(),
    name: DeviceName.create(name).value,
    status: DeviceStatus.createActive(),
    ownerType: null,
    category: null,
    locationId: LocationId.create(),
    serialNumber: SerialNumber.create(`SN-${name}`).value,
    macAddress: null,
    ipAddress: IPAddress.create('10.0.0.1').value,
    description: null,
    installedDate: null,
    monitoringEnabled: false
  }).value;
}

describe('[WLS-012] [DEV-180] WirelessDeviceRepositoryAdapter — upstream', () => {
  let cpe: Device;
  let ap: Device;
  let repo: {
    findById: jest.Mock;
    findUpstreamChain: jest.Mock;
    save: jest.Mock;
  };
  let adapter: WirelessDeviceRepositoryAdapter;

  beforeEach(() => {
    cpe = makeDevice('CPE');
    ap = makeDevice('AP');
    repo = {
      findById: jest.fn(async (id: DeviceId) =>
        Result.ok([cpe, ap].find((d) => d.id.equals(id)) ?? null)
      ),
      findUpstreamChain: jest.fn().mockResolvedValue(Result.ok([])),
      save: jest.fn(async (d: Device) => Result.ok(d))
    };
    const devices = repo as unknown as PrismaDeviceRepository;
    adapter = new WirelessDeviceRepositoryAdapter(
      devices,
      new DeviceEligibilityService(),
      new UpstreamAssignment(devices)
    );
  });

  it('reads the declared upstream', async () => {
    cpe.setUpstream(ap.id);

    expect((await adapter.findUpstreamId(cpe.id)).value).toBe(ap.id);
  });

  it('declares the reported AP when no upstream is set', async () => {
    const result = await adapter.declareUpstreamIfUnset(
      cpe.id,
      ap.id
    );

    expect(result.value).toBe(true);
    expect(cpe.upstreamDeviceId?.toString()).toBe(ap.id.toString());
    expect(repo.save).toHaveBeenCalledWith(cpe);
  });

  it('never overwrites a declared upstream', async () => {
    const declared = DeviceId.create();
    cpe.setUpstream(declared);

    const result = await adapter.declareUpstreamIfUnset(
      cpe.id,
      ap.id
    );

    expect(result.value).toBe(false);
    expect(cpe.upstreamDeviceId).toBe(declared);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('leaves it undeclared when the link rules refuse the AP', async () => {
    repo.findUpstreamChain.mockResolvedValue(Result.ok([cpe.id]));

    const result = await adapter.declareUpstreamIfUnset(
      cpe.id,
      ap.id
    );

    expect(result.value).toBe(false);
    expect(cpe.upstreamDeviceId).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('declares nothing for a device that no longer exists', async () => {
    const result = await adapter.declareUpstreamIfUnset(
      DeviceId.create(),
      ap.id
    );

    expect(result.value).toBe(false);
  });

  it('passes a failed save through', async () => {
    repo.save.mockResolvedValue(Result.fail('db down'));

    const result = await adapter.declareUpstreamIfUnset(
      cpe.id,
      ap.id
    );

    expect(result.error).toBe('db down');
  });
});
