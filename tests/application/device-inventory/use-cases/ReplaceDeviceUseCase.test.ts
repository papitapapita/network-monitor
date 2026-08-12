// Source: src/application/device-inventory/use-cases/ReplaceDeviceUseCase.ts

import { ReplaceDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/ReplaceDeviceUseCase';
import {
  IDeviceRepository,
  IDeviceModelRepository
} from '../../../../src/domain/device-inventory/repository';
import { IContractedServiceRepository } from '../../../../src/domain/customers/repository';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository';
import { IDeviceCredentialsRepository } from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import { IPAddress, MACAddress } from '../../../../src/domain/shared';
import {
  DeviceCategory,
  DeviceName,
  DeviceStatus,
  SerialNumber
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import {
  DeviceId,
  DeviceModelId,
  LocationId
} from '../../../../src/domain/shared/ids';
import { ReplaceDeviceRequestDTO } from '../../../../src/application/device-inventory/dtos';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OLD_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const OLD_MODEL_ID = '550e8400-e29b-41d4-a716-446655440001';
const NEW_MODEL_ID = '550e8400-e29b-41d4-a716-446655440002';
const NOW = new Date('2026-08-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  } as unknown as jest.Mocked<ILogger>;
}

function makeRepo(): jest.Mocked<IDeviceRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findByLocation: jest.fn(),
    findByDeviceModel: jest.fn(),
    findByMacAddress: jest.fn(),
    findByIpAddress: jest.fn(),
    findByStatus: jest.fn(),
    existsByMacAddress: jest.fn(),
    existsByIpAddress: jest.fn(),
    findByLocationIds: jest.fn(),
    findByFilters: jest.fn(),
    findByIdIncludingDeleted: jest.fn(),
    findDeletedBefore: jest.fn(),
    countByFilters: jest.fn()
  };
}

function makeModelRepo(): jest.Mocked<IDeviceModelRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findByVendor: jest.fn(),
    findByFilters: jest.fn(),
    countByFilters: jest.fn()
  } as unknown as jest.Mocked<IDeviceModelRepository>;
}

function makeCredentialsRepo(): jest.Mocked<IDeviceCredentialsRepository> {
  return {
    findByDeviceId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn()
  };
}

function makeContractRepo(): jest.Mocked<IContractedServiceRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    findByServicePlanId: jest.fn(),
    findByDeviceId: jest.fn(),
    findByStatus: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn()
  };
}

function makeWirelessRepo(): jest.Mocked<IWirelessDeviceConfigRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    findAll: jest.fn()
  };
}

function makeModel(isWireless: boolean) {
  return { isWireless } as never;
}

function makeOldDevice(overrides: Partial<{
  status: DeviceStatus;
  ipAddress: IPAddress | null;
  replacedByDeviceId: DeviceId | null;
  deletedAt: Date | null;
}> = {}): Device {
  return Device.reconstitute(DeviceId.parse(OLD_DEVICE_ID).value, {
    deviceModelId: DeviceModelId.parse(OLD_MODEL_ID).value,
    locationId: LocationId.create(),
    status: overrides.status ?? DeviceStatus.createActive(),
    category: DeviceCategory.create('WIRELESS_CPE').value,
    ownerType: DeviceOwnerType.CLIENT,
    name: DeviceName.reconstitute('CPE-Casa-12'),
    serialNumber: SerialNumber.create('SN-OLD').value,
    macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
    ipAddress:
      overrides.ipAddress !== undefined
        ? overrides.ipAddress
        : IPAddress.create('10.20.0.5').value,
    description: 'Original unit',
    installedDate: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: true,
    deletedAt: overrides.deletedAt ?? null,
    replacedByDeviceId: overrides.replacedByDeviceId ?? null
  });
}

function makeRequest(
  overrides: Partial<ReplaceDeviceRequestDTO> = {}
): ReplaceDeviceRequestDTO {
  return {
    id: OLD_DEVICE_ID,
    deviceModelId: NEW_MODEL_ID,
    retiredStatus: 'DAMAGED',
    serialNumber: 'SN-NEW',
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('ReplaceDeviceUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let modelRepo: jest.Mocked<IDeviceModelRepository>;
  let credentialsRepo: jest.Mocked<IDeviceCredentialsRepository>;
  let contractRepo: jest.Mocked<IContractedServiceRepository>;
  let wirelessRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: ReplaceDeviceUseCase;

  beforeEach(() => {
    repo = makeRepo();
    modelRepo = makeModelRepo();
    credentialsRepo = makeCredentialsRepo();
    contractRepo = makeContractRepo();
    wirelessRepo = makeWirelessRepo();
    logger = makeLogger();
    useCase = new ReplaceDeviceUseCase(
      repo,
      modelRepo,
      credentialsRepo,
      contractRepo,
      wirelessRepo,
      logger
    );

    repo.findById.mockResolvedValue(Result.ok(makeOldDevice()));
    repo.save.mockImplementation((device) =>
      Promise.resolve(Result.ok(device))
    );
    modelRepo.findById.mockResolvedValue(Result.ok(makeModel(true)));
    credentialsRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
    credentialsRepo.save.mockResolvedValue(Result.ok(undefined));
    credentialsRepo.delete.mockResolvedValue(Result.ok(undefined));
    contractRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
    wirelessRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
    wirelessRepo.delete.mockResolvedValue(Result.ok(undefined));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('[DEV-078] beforeExecute — validation', () => {
    it('should require an id', async () => {
      const result = await useCase.execute(makeRequest({ id: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should require a deviceModelId', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceModelId: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceModelId is required');
    });

    it('should require a retiredStatus', async () => {
      const result = await useCase.execute(
        makeRequest({ retiredStatus: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('retiredStatus is required');
    });

    it.each(['INVENTORY', 'DAMAGED', 'DECOMMISSIONED'])(
      'should accept %s as a retiredStatus',
      async (retiredStatus) => {
        const result = await useCase.execute(
          makeRequest({ retiredStatus })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.retiredDevice.status).toBe(retiredStatus);
      }
    );

    it.each(['ACTIVE', 'COMMISSIONING'])(
      'should refuse %s as a retiredStatus — a replaced unit leaves service',
      async (retiredStatus) => {
        const result = await useCase.execute(
          makeRequest({ retiredStatus })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('must be one of');
      }
    );

    it('should refuse an unrecognised retiredStatus', async () => {
      const result = await useCase.execute(
        makeRequest({ retiredStatus: 'BROKEN' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device status');
    });

    it('should require an identifier on the replacement', async () => {
      const result = await useCase.execute(
        makeRequest({ serialNumber: undefined, macAddress: undefined })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'at least a serial number or MAC address'
      );
    });

    it('should accept a MAC address alone as the identifier', async () => {
      const result = await useCase.execute(
        makeRequest({
          serialNumber: undefined,
          macAddress: '11:22:33:44:55:66'
        })
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  // =========================================================================
  describe('executeImpl — lookups', () => {
    it('should fail when the device does not exist', async () => {
      repo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
    });

    it('[DEV-066] should fail when the replacement model does not exist', async () => {
      modelRepo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device model not found');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('[DEV-083] should refuse to replace a soft-deleted device', async () => {
      // findById hides tombstones, so a deleted device reads as absent.
      repo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
    });

    it('[DEV-082] should refuse to replace a device that was already replaced', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(
          makeOldDevice({ replacedByDeviceId: DeviceId.create() })
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already been replaced');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('[DEV-079] executeImpl — IP handover', () => {
    it('should clear the IP from the retired unit', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.retiredDevice.ipAddress).toBeNull();
    });

    it('should give the released IP to the replacement', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.newDevice.ipAddress).toBe('10.20.0.5');
    });

    // Order matters: both rows are live, and the partial unique index on
    // ip_address would reject the pair if the new row landed first.
    it('should save the retired unit before the replacement', async () => {
      await useCase.execute(makeRequest());

      const [first, second] = repo.save.mock.calls.map((c) => c[0]);
      expect(first.id.toString()).toBe(OLD_DEVICE_ID);
      expect(second.id.toString()).not.toBe(OLD_DEVICE_ID);
    });

    it('should cope with a retired unit that had no IP', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(
          makeOldDevice({
            status: DeviceStatus.createInventory(),
            ipAddress: null
          })
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.newDevice.ipAddress).toBeNull();
    });

    it('should commission a replacement that inherited an address', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.newDevice.status).toBe('COMMISSIONING');
    });

    it('should shelve a replacement that inherited no address', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(
          makeOldDevice({
            status: DeviceStatus.createInventory(),
            ipAddress: null
          })
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.newDevice.status).toBe('INVENTORY');
    });
  });

  // =========================================================================
  describe('executeImpl — lineage', () => {
    it('should link the replacement back to the unit it succeeds', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.newDevice.replacesDeviceId).toBe(
        OLD_DEVICE_ID
      );
      expect(result.value.newDevice.replacedAt).not.toBeNull();
    });

    it('should build the replacement on the new model', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.newDevice.deviceModelId).toBe(NEW_MODEL_ID);
      expect(result.value.retiredDevice.deviceModelId).toBe(
        OLD_MODEL_ID
      );
    });

    it('should inherit location, category and owner from the retired unit', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.newDevice.locationId).toBe(
        result.value.retiredDevice.locationId
      );
      expect(result.value.newDevice.category).toBe('WIRELESS_CPE');
      expect(result.value.newDevice.ownerType).toBe('CLIENT');
    });

    it('should default the replacement name to the retired unit name', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.newDevice.name).toBe('CPE-Casa-12');
    });

    it('should use an explicit name when one is supplied', async () => {
      const result = await useCase.execute(
        makeRequest({ name: 'CPE-Casa-12-v2' })
      );

      expect(result.value.newDevice.name).toBe('CPE-Casa-12-v2');
    });
  });

  // =========================================================================
  describe('[DEV-080] executeImpl — credential and contract handover', () => {
    it('should move credentials onto the replacement', async () => {
      const creds = { httpUsername: 'ubnt' } as never;
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.ok(creds)
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.credentialsTransferred).toBe(true);
      expect(credentialsRepo.save).toHaveBeenCalledTimes(1);
      const [savedTo, savedCreds] = credentialsRepo.save.mock.calls[0];
      expect(savedTo.toString()).not.toBe(OLD_DEVICE_ID);
      expect(savedCreds).toBe(creds);
    });

    // The old row is the only copy until the write lands.
    it('should delete the old credentials only after the copy succeeds', async () => {
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.ok({ httpUsername: 'ubnt' } as never)
      );
      credentialsRepo.save.mockResolvedValue(
        Result.fail('encryption key missing')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(credentialsRepo.delete).not.toHaveBeenCalled();
    });

    it('should report no transfer when the unit had no credentials', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.credentialsTransferred).toBe(false);
      expect(credentialsRepo.save).not.toHaveBeenCalled();
    });

    it('should re-point the contracted service at the replacement', async () => {
      const assignDevice = jest.fn().mockReturnValue(Result.ok());
      contractRepo.findByDeviceId.mockResolvedValue(
        Result.ok({ assignDevice } as never)
      );
      contractRepo.save.mockResolvedValue(Result.ok({} as never));

      const result = await useCase.execute(makeRequest());

      expect(result.value.contractedServiceTransferred).toBe(true);
      expect(assignDevice).toHaveBeenCalledTimes(1);
      expect(
        assignDevice.mock.calls[0][0].toString()
      ).not.toBe(OLD_DEVICE_ID);
      expect(contractRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should fail loudly when the contract cannot be re-pointed', async () => {
      contractRepo.findByDeviceId.mockResolvedValue(
        Result.ok({
          assignDevice: jest.fn().mockReturnValue(Result.ok())
        } as never)
      );
      contractRepo.save.mockResolvedValue(
        Result.fail('unique violation')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'contracted service could not be re-pointed'
      );
    });

    it('should report no transfer when the unit had no contract', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.contractedServiceTransferred).toBe(false);
    });
  });

  // =========================================================================
  describe('[DEV-081] executeImpl — wireless config on a model mismatch', () => {
    it('should remove the wireless config when the replacement has no radio', async () => {
      wirelessRepo.findByDeviceId.mockResolvedValue(
        Result.ok({} as never)
      );
      modelRepo.findById.mockResolvedValue(
        Result.ok(makeModel(false))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.wirelessConfigRemoved).toBe(true);
      expect(wirelessRepo.delete).toHaveBeenCalledTimes(1);
    });

    it('should keep the config when the replacement is also wireless', async () => {
      wirelessRepo.findByDeviceId.mockResolvedValue(
        Result.ok({} as never)
      );
      modelRepo.findById.mockResolvedValue(
        Result.ok(makeModel(true))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.wirelessConfigRemoved).toBe(false);
      expect(wirelessRepo.delete).not.toHaveBeenCalled();
    });

    it('should report nothing removed when there was no config', async () => {
      modelRepo.findById.mockResolvedValue(
        Result.ok(makeModel(false))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.wirelessConfigRemoved).toBe(false);
      expect(wirelessRepo.delete).not.toHaveBeenCalled();
    });

    it('should not fail the replacement when the config removal errors', async () => {
      wirelessRepo.findByDeviceId.mockResolvedValue(
        Result.ok({} as never)
      );
      modelRepo.findById.mockResolvedValue(
        Result.ok(makeModel(false))
      );
      wirelessRepo.delete.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.wirelessConfigRemoved).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — retired unit state', () => {
    it('should stop monitoring on the retired unit', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.retiredDevice.monitoringEnabled).toBe(
        false
      );
    });

    it('should stamp replacedAt on the retired unit', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.retiredDevice.replacedAt).not.toBeNull();
    });

    it('should not create the replacement when retiring the old unit fails to save', async () => {
      repo.save.mockResolvedValueOnce(Result.fail('Write conflict'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Write conflict');
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });
});
