// Source: src/application/device-inventory/use-cases/SwapDeviceHardwareUseCase.ts

import { SwapDeviceHardwareUseCase } from '../../../../src/application/device-inventory/use-cases/SwapDeviceHardwareUseCase';
import {
  IDeviceHardwareSwapRepository,
  IDeviceModelRepository,
  IDeviceRepository
} from '../../../../src/domain/device-inventory/repository';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository';
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
import { SwapDeviceHardwareRequestDTO } from '../../../../src/application/device-inventory/dtos';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BIG_ID = '550e8400-e29b-41d4-a716-446655440000';
const SMALL_ID = '550e8400-e29b-41d4-a716-446655440001';
const BIG_MODEL_ID = '550e8400-e29b-41d4-a716-446655440010';
const SMALL_MODEL_ID = '550e8400-e29b-41d4-a716-446655440011';
const NOW = new Date('2026-09-01T00:00:00.000Z');

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

function makeSwapRepo(): jest.Mocked<IDeviceHardwareSwapRepository> {
  return { saveHardwareSwap: jest.fn() };
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

function makeWirelessRepo(): jest.Mocked<IWirelessDeviceConfigRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    findByDeviceId: jest.fn(),
    findAllDue: jest.fn(),
    findByParentApDeviceId: jest.fn(),
    findAll: jest.fn()
  };
}

function makeModel(isWireless: boolean) {
  return { isWireless } as never;
}

function makeUnit(
  id: string,
  modelId: string,
  name: string,
  serial: string,
  mac: string,
  ip: string,
  overrides: Partial<{ status: DeviceStatus }> = {}
): Device {
  return Device.reconstitute(DeviceId.parse(id).value, {
    deviceModelId: DeviceModelId.parse(modelId).value,
    locationId: LocationId.create(),
    status: overrides.status ?? DeviceStatus.createActive(),
    category: DeviceCategory.create('ACCESS_POINT').value,
    ownerType: DeviceOwnerType.COMPANY,
    name: DeviceName.reconstitute(name),
    serialNumber: SerialNumber.create(serial).value,
    macAddress: MACAddress.create(mac).value,
    ipAddress: IPAddress.create(ip).value,
    description: null,
    installedDate: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: true,
    deletedAt: null,
    deletedBy: null,
    replacedAt: null,
    replacesDeviceId: null,
    replacedByDeviceId: null
  });
}

function makeBig(): Device {
  return makeUnit(
    BIG_ID,
    BIG_MODEL_ID,
    'Site-A',
    'SN-BIG',
    'AA:AA:AA:AA:AA:AA',
    '10.0.0.1'
  );
}

function makeSmall(): Device {
  return makeUnit(
    SMALL_ID,
    SMALL_MODEL_ID,
    'Site-B',
    'SN-SMALL',
    'BB:BB:BB:BB:BB:BB',
    '10.0.0.2'
  );
}

function makeRequest(
  overrides: Partial<SwapDeviceHardwareRequestDTO> = {}
): SwapDeviceHardwareRequestDTO {
  return { id: BIG_ID, otherDeviceId: SMALL_ID, ...overrides };
}

// ---------------------------------------------------------------------------

describe('SwapDeviceHardwareUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let swapRepo: jest.Mocked<IDeviceHardwareSwapRepository>;
  let modelRepo: jest.Mocked<IDeviceModelRepository>;
  let wirelessRepo: jest.Mocked<IWirelessDeviceConfigRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: SwapDeviceHardwareUseCase;

  beforeEach(() => {
    repo = makeRepo();
    swapRepo = makeSwapRepo();
    modelRepo = makeModelRepo();
    wirelessRepo = makeWirelessRepo();
    logger = makeLogger();
    useCase = new SwapDeviceHardwareUseCase(
      repo,
      swapRepo,
      modelRepo,
      wirelessRepo,
      logger
    );

    repo.findById.mockImplementation((id) =>
      Promise.resolve(
        Result.ok(
          id.toString() === BIG_ID
            ? makeBig()
            : id.toString() === SMALL_ID
              ? makeSmall()
              : null
        )
      )
    );
    swapRepo.saveHardwareSwap.mockResolvedValue(Result.ok(undefined));
    modelRepo.findById.mockResolvedValue(Result.ok(makeModel(true)));
    wirelessRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — validation', () => {
    it('should require an id', async () => {
      const result = await useCase.execute(makeRequest({ id: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should require an otherDeviceId', async () => {
      const result = await useCase.execute(
        makeRequest({ otherDeviceId: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('otherDeviceId is required');
    });

    it('should refuse a malformed id', async () => {
      const result = await useCase.execute(
        makeRequest({ id: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
      expect(swapRepo.saveHardwareSwap).not.toHaveBeenCalled();
    });

    it('should refuse a malformed otherDeviceId', async () => {
      const result = await useCase.execute(
        makeRequest({ otherDeviceId: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
      expect(swapRepo.saveHardwareSwap).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — lookups', () => {
    it('should fail when the first device does not exist', async () => {
      repo.findById.mockImplementation((id) =>
        Promise.resolve(
          Result.ok(id.toString() === SMALL_ID ? makeSmall() : null)
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
      expect(swapRepo.saveHardwareSwap).not.toHaveBeenCalled();
    });

    it('should fail when the other device does not exist', async () => {
      repo.findById.mockImplementation((id) =>
        Promise.resolve(
          Result.ok(id.toString() === BIG_ID ? makeBig() : null)
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
      expect(swapRepo.saveHardwareSwap).not.toHaveBeenCalled();
    });

    it('should surface a repository failure on lookup', async () => {
      repo.findById.mockResolvedValue(Result.fail('db down'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('db down');
    });
  });

  // =========================================================================
  describe('executeImpl — wireless config must keep a radio', () => {
    it('should refuse when a device with a wireless config would receive a model with no radio', async () => {
      wirelessRepo.findByDeviceId.mockImplementation((id) =>
        Promise.resolve(
          Result.ok(id.toString() === BIG_ID ? ({} as never) : null)
        )
      );
      modelRepo.findById.mockResolvedValue(
        Result.ok(makeModel(false))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Cannot swap hardware');
      expect(result.error).toContain('Site-A');
      expect(swapRepo.saveHardwareSwap).not.toHaveBeenCalled();
    });

    it('should check the model the device would receive, not the one it holds', async () => {
      wirelessRepo.findByDeviceId.mockImplementation((id) =>
        Promise.resolve(
          Result.ok(id.toString() === BIG_ID ? ({} as never) : null)
        )
      );

      await useCase.execute(makeRequest());

      expect(modelRepo.findById).toHaveBeenCalledTimes(1);
      expect(modelRepo.findById.mock.calls[0][0].toString()).toBe(
        SMALL_MODEL_ID
      );
    });

    it('should allow the swap when the incoming model has a radio', async () => {
      wirelessRepo.findByDeviceId.mockResolvedValue(
        Result.ok({} as never)
      );
      modelRepo.findById.mockResolvedValue(
        Result.ok(makeModel(true))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(swapRepo.saveHardwareSwap).toHaveBeenCalledTimes(1);
    });

    it('should not look anything up when a device holds no wireless config', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(modelRepo.findById).not.toHaveBeenCalled();
    });

    it('should skip the radio check entirely when both models are the same', async () => {
      repo.findById.mockImplementation((id) =>
        Promise.resolve(
          Result.ok(
            id.toString() === BIG_ID
              ? makeBig()
              : makeUnit(
                  SMALL_ID,
                  BIG_MODEL_ID,
                  'Site-B',
                  'SN-SMALL',
                  'BB:BB:BB:BB:BB:BB',
                  '10.0.0.2'
                )
          )
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(wirelessRepo.findByDeviceId).not.toHaveBeenCalled();
      expect(modelRepo.findById).not.toHaveBeenCalled();
    });

    it('should surface a wireless repository failure', async () => {
      wirelessRepo.findByDeviceId.mockResolvedValue(
        Result.fail('wireless db down')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('wireless db down');
      expect(swapRepo.saveHardwareSwap).not.toHaveBeenCalled();
    });

    it('should surface a model repository failure', async () => {
      wirelessRepo.findByDeviceId.mockResolvedValue(
        Result.ok({} as never)
      );
      modelRepo.findById.mockResolvedValue(
        Result.fail('model db down')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('model db down');
      expect(swapRepo.saveHardwareSwap).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — domain and persistence', () => {
    it('should surface a domain refusal without saving', async () => {
      const result = await useCase.execute(
        makeRequest({ otherDeviceId: BIG_ID })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('with itself');
      expect(swapRepo.saveHardwareSwap).not.toHaveBeenCalled();
    });

    it('should surface a failure from saveHardwareSwap and return no DTOs', async () => {
      swapRepo.saveHardwareSwap.mockResolvedValue(
        Result.fail(
          'MAC address is already assigned to another device'
        )
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already assigned');
    });

    it('should hand both mutated aggregates to saveHardwareSwap in one call', async () => {
      await useCase.execute(makeRequest());

      expect(swapRepo.saveHardwareSwap).toHaveBeenCalledTimes(1);
      const [first, second] = swapRepo.saveHardwareSwap.mock.calls[0];
      expect(first.id.toString()).toBe(BIG_ID);
      expect(second.id.toString()).toBe(SMALL_ID);
      expect(first.serialNumber?.value).toBe('SN-SMALL');
      expect(second.serialNumber?.value).toBe('SN-BIG');
    });

    it('should never use the single-device save', async () => {
      await useCase.execute(makeRequest());

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return both devices with swapped hardware identity', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.device.id).toBe(BIG_ID);
      expect(result.value.device.serialNumber).toBe('SN-SMALL');
      expect(result.value.device.macAddress).toBe(
        'BB:BB:BB:BB:BB:BB'
      );
      expect(result.value.device.deviceModelId).toBe(SMALL_MODEL_ID);
      expect(result.value.otherDevice.id).toBe(SMALL_ID);
      expect(result.value.otherDevice.serialNumber).toBe('SN-BIG');
      expect(result.value.otherDevice.macAddress).toBe(
        'AA:AA:AA:AA:AA:AA'
      );
      expect(result.value.otherDevice.deviceModelId).toBe(
        BIG_MODEL_ID
      );
    });

    it('should leave IP, name and status with each record', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value.device.ipAddress).toBe('10.0.0.1');
      expect(result.value.device.name).toBe('Site-A');
      expect(result.value.device.status).toBe('ACTIVE');
      expect(result.value.otherDevice.ipAddress).toBe('10.0.0.2');
      expect(result.value.otherDevice.name).toBe('Site-B');
      expect(result.value.otherDevice.status).toBe('ACTIVE');
    });
  });
});
