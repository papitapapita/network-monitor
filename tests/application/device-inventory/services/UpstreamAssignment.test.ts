// Source: src/application/device-inventory/services/UpstreamAssignment.ts

import { UpstreamAssignment } from '../../../../src/application/device-inventory/services';
import {
  Device,
  DeviceName,
  DeviceStatus,
  IDeviceRepository,
  SerialNumber
} from '../../../../src/domain/device-inventory';
import {
  DeviceId,
  DeviceModelId,
  IPAddress,
  LocationId,
  Result
} from '../../../../src/domain/shared';

function makeDevice(
  name: string,
  status: DeviceStatus = DeviceStatus.createActive()
): Device {
  return Device.create({
    deviceModelId: DeviceModelId.create(),
    name: DeviceName.create(name).value,
    status,
    ownerType: null,
    category: null,
    locationId: LocationId.create(),
    serialNumber: SerialNumber.create(`SN-${name}`).value,
    macAddress: null,
    ipAddress: status.isActive()
      ? IPAddress.create('10.0.0.1').value
      : null,
    description: null,
    installedDate: null,
    monitoringEnabled: false
  }).value;
}

function makeRepo(
  devices: Device[],
  chain: DeviceId[] = []
): jest.Mocked<
  Pick<IDeviceRepository, 'findById' | 'findUpstreamChain'>
> {
  return {
    findById: jest.fn(async (id: DeviceId) =>
      Result.ok(devices.find((d) => d.id.equals(id)) ?? null)
    ),
    findUpstreamChain: jest.fn().mockResolvedValue(Result.ok(chain))
  };
}

function makeAssignment(
  repo: ReturnType<typeof makeRepo>
): UpstreamAssignment {
  return new UpstreamAssignment(repo as unknown as IDeviceRepository);
}

describe('UpstreamAssignment', () => {
  it('[DEV-180] resolves an upstream the policy accepts', async () => {
    const cpe = makeDevice('CPE');
    const ap = makeDevice('AP');
    const repo = makeRepo([ap]);

    const result = await makeAssignment(repo).resolve(
      cpe,
      ap.id.toString()
    );

    expect(result.value.toString()).toBe(ap.id.toString());
    expect(repo.findUpstreamChain.mock.calls[0][0].toString()).toBe(
      ap.id.toString()
    );
  });

  it('refuses a malformed id', async () => {
    const result = await makeAssignment(makeRepo([])).resolve(
      makeDevice('CPE'),
      'nope'
    );

    expect(result.error).toContain('Invalid upstreamDeviceId');
  });

  it('refuses an unknown upstream', async () => {
    const result = await makeAssignment(makeRepo([])).resolve(
      makeDevice('CPE'),
      '550e8400-e29b-41d4-a716-446655440099'
    );

    expect(result.error).toContain('Upstream device not found');
  });

  it('[DEV-181] refuses the device itself without reading anything', async () => {
    const cpe = makeDevice('CPE');
    const repo = makeRepo([cpe]);

    const result = await makeAssignment(repo).resolve(
      cpe,
      cpe.id.toString()
    );

    expect(result.error).toContain('its own upstream');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('[DEV-182] refuses an upstream whose chain contains the device', async () => {
    const sw = makeDevice('Switch');
    const ap = makeDevice('AP');
    const repo = makeRepo([ap], [sw.id]);

    const result = await makeAssignment(repo).resolve(
      sw,
      ap.id.toString()
    );

    expect(result.error).toContain('loop');
  });

  it('[DEV-183] refuses an upstream that is not on the network', async () => {
    const ap = makeDevice('AP', DeviceStatus.createInventory());

    const result = await makeAssignment(makeRepo([ap])).resolve(
      makeDevice('CPE'),
      ap.id.toString()
    );

    expect(result.error).toContain('must be ACTIVE or COMMISSIONING');
  });

  it('passes a failed chain read through', async () => {
    const ap = makeDevice('AP');
    const repo = makeRepo([ap]);
    repo.findUpstreamChain.mockResolvedValue(Result.fail('db down'));

    const result = await makeAssignment(repo).resolve(
      makeDevice('CPE'),
      ap.id.toString()
    );

    expect(result.error).toBe('db down');
  });
});
