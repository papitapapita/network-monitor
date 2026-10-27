// Source: src/infrastructure/wireless-monitoring/adapters/DeviceHardwareAdapter.ts

import { DeviceHardwareAdapter } from '../../../../src/infrastructure/wireless-monitoring/adapters/DeviceHardwareAdapter';
import {
  IDeviceRepository,
  IDeviceModelRepository
} from '../../../../src/domain/device-inventory/repository';
import {
  Device,
  DeviceModel
} from '../../../../src/domain/device-inventory/aggregates';
import {
  DeviceId,
  DeviceModelId,
  VendorId
} from '../../../../src/domain/shared/ids';
import { DeviceStatus } from '../../../../src/domain/device-inventory/value-objects';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Fixtures — only the getters the adapter reads
// ---------------------------------------------------------------------------

const deviceModelId = DeviceModelId.create();
const vendorId = VendorId.create();

function makeModel(model: string): DeviceModel {
  return {
    id: deviceModelId,
    model,
    vendorId
  } as unknown as DeviceModel;
}

function makeRepos(status = 'ACTIVE') {
  const deviceRepo = {
    findById: jest.fn().mockResolvedValue(
      Result.ok({
        deviceModelId,
        status: DeviceStatus.create(status).value
      } as unknown as Device)
    )
  } as unknown as jest.Mocked<IDeviceRepository>;
  const deviceModelRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(Result.ok(makeModel('PowerBeam 5AC ISO'))),
    findAll: jest
      .fn()
      .mockResolvedValue(Result.ok([makeModel('PowerBeam 5AC ISO')]))
  } as unknown as jest.Mocked<IDeviceModelRepository>;
  return { deviceRepo, deviceModelRepo };
}

function makeAdapter(repos: ReturnType<typeof makeRepos>) {
  return new DeviceHardwareAdapter(
    repos.deviceRepo,
    repos.deviceModelRepo
  );
}

// ---------------------------------------------------------------------------

describe('[WLS-152] DeviceHardwareAdapter', () => {
  const deviceId = DeviceId.create();

  describe('findHardware', () => {
    it('should follow device → model to the hardware it describes', async () => {
      const result =
        await makeAdapter(makeRepos()).findHardware(deviceId);

      expect(result.value).toEqual({
        inInventory: false,
        deviceModelId: deviceModelId.toString(),
        modelName: 'PowerBeam 5AC ISO',
        vendorId: vendorId.toString()
      });
    });

    it('should report a device still in INVENTORY', async () => {
      const result = await makeAdapter(
        makeRepos('INVENTORY')
      ).findHardware(deviceId);

      expect(result.value?.inInventory).toBe(true);
    });

    it.each([
      ['device', 'deviceRepo'],
      ['model', 'deviceModelRepo']
    ] as const)(
      'should resolve null when the %s is missing',
      async (_, repo) => {
        const repos = makeRepos();
        repos[repo].findById.mockResolvedValue(Result.ok(null));

        const result =
          await makeAdapter(repos).findHardware(deviceId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      }
    );

    it('should pass a repository failure through', async () => {
      const repos = makeRepos();
      repos.deviceRepo.findById.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await makeAdapter(repos).findHardware(deviceId);

      expect(result.error).toBe('db down');
    });
  });

  describe('findCatalogModels', () => {
    it('should list every catalog model as plain data', async () => {
      const result =
        await makeAdapter(makeRepos()).findCatalogModels();

      expect(result.value).toEqual([
        {
          id: deviceModelId.toString(),
          model: 'PowerBeam 5AC ISO',
          vendorId: vendorId.toString()
        }
      ]);
    });

    it('should pass a repository failure through', async () => {
      const repos = makeRepos();
      repos.deviceModelRepo.findAll.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await makeAdapter(repos).findCatalogModels();

      expect(result.error).toBe('db down');
    });
  });
});
