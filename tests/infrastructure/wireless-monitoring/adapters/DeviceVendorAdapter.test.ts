// Source: src/infrastructure/wireless-monitoring/adapters/DeviceVendorAdapter.ts

import { DeviceVendorAdapter } from '../../../../src/infrastructure/wireless-monitoring/adapters/DeviceVendorAdapter';
import {
  IDeviceRepository,
  IDeviceModelRepository,
  IVendorRepository
} from '../../../../src/domain/device-inventory/repository';
import {
  Device,
  DeviceModel,
  Vendor
} from '../../../../src/domain/device-inventory/aggregates';
import {
  DeviceId,
  DeviceModelId,
  VendorId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Fixtures — only the getters the adapter reads
// ---------------------------------------------------------------------------

const deviceModelId = DeviceModelId.create();
const vendorId = VendorId.create();

function makeRepos() {
  const deviceRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(
        Result.ok({ deviceModelId } as unknown as Device)
      )
  } as unknown as jest.Mocked<IDeviceRepository>;
  const deviceModelRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(
        Result.ok({ vendorId } as unknown as DeviceModel)
      )
  } as unknown as jest.Mocked<IDeviceModelRepository>;
  const vendorRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(
        Result.ok({ slug: 'mimosa' } as unknown as Vendor)
      )
  } as unknown as jest.Mocked<IVendorRepository>;
  return { deviceRepo, deviceModelRepo, vendorRepo };
}

function makeAdapter(repos: ReturnType<typeof makeRepos>) {
  return new DeviceVendorAdapter(
    repos.deviceRepo,
    repos.deviceModelRepo,
    repos.vendorRepo
  );
}

// ---------------------------------------------------------------------------

describe('[WLS-053] DeviceVendorAdapter', () => {
  const deviceId = DeviceId.create();

  it('should follow device → model → vendor to the vendor slug', async () => {
    const repos = makeRepos();

    const result = await makeAdapter(repos).findVendorSlug(deviceId);

    expect(result.value).toBe('mimosa');
    expect(repos.deviceModelRepo.findById).toHaveBeenCalledWith(
      deviceModelId
    );
    expect(repos.vendorRepo.findById).toHaveBeenCalledWith(vendorId);
  });

  it.each([
    ['device', 'deviceRepo'],
    ['model', 'deviceModelRepo'],
    ['vendor', 'vendorRepo']
  ] as const)(
    'should return null when the %s is missing',
    async (_label, repo) => {
      const repos = makeRepos();
      (repos[repo].findById as jest.Mock).mockResolvedValue(
        Result.ok(null)
      );

      const result =
        await makeAdapter(repos).findVendorSlug(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    }
  );

  it.each(['deviceRepo', 'deviceModelRepo', 'vendorRepo'] as const)(
    'should fail when %s fails',
    async (repo) => {
      const repos = makeRepos();
      (repos[repo].findById as jest.Mock).mockResolvedValue(
        Result.fail('db down')
      );

      const result =
        await makeAdapter(repos).findVendorSlug(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('db down');
    }
  );
});
