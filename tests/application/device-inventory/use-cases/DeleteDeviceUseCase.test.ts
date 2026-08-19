// Source: src/application/device-inventory/use-cases/DeleteDeviceUseCase.ts

import { DeleteDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/DeleteDeviceUseCase';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import { MACAddress } from '../../../../src/domain/shared';
import {
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import {
  DeviceId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';
import { DeleteDeviceRequestDTO } from '../../../../src/application/device-inventory/dtos/DeleteDeviceRequestDTO';
import { IContractedServiceRepository } from '../../../../src/domain/customers/repository';
import { ITicketRepository } from '../../../../src/domain/tickets/repository';
import { ContractedServiceStatus } from '../../../../src/domain/customers/enums';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DEVICE_MODEL = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-06-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
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

function makeTicketRepo(): jest.Mocked<ITicketRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    findAll: jest.fn(),
    countAll: jest.fn(),
    findForTechnicianOnDate: jest.fn(),
    findActiveByOrigin: jest.fn(),
    findActiveAlertTicketForDevice: jest.fn(),
    countByTechnician: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn()
  };
}

// A contract stub is enough here: the use case only reads `status` through
// isCancelled(). Building a real ContractedService would drag in a customer
// and a service plan for no extra coverage.
function makeContract(status: string) {
  return {
    status,
    isCancelled: () => status === ContractedServiceStatus.CANCELLED
  } as never;
}

function makePersistedDevice(): Device {
  const id = DeviceId.parse(VALID_DEVICE_ID).value;
  const modelId = DeviceModelId.parse(VALID_DEVICE_MODEL)
    .value as unknown as DeviceId;
  const status = DeviceStatus.reconstitute(DeviceStatus.INVENTORY);
  const name = DeviceName.reconstitute('Core-Router-01');
  const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;

  return Device.reconstitute(id, {
    deviceModelId: modelId as unknown as DeviceModelId,
    locationId: null,
    status,
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name,
    serialNumber: null,
    macAddress,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false
  });
}

function makeRequest(
  overrides: Partial<DeleteDeviceRequestDTO> = {}
): DeleteDeviceRequestDTO {
  return { id: VALID_DEVICE_ID, ...overrides };
}

// ---------------------------------------------------------------------------

describe('DeleteDeviceUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let contractRepo: jest.Mocked<IContractedServiceRepository>;
  let ticketRepo: jest.Mocked<ITicketRepository>;
  let logger: ILogger;
  let useCase: DeleteDeviceUseCase;

  beforeEach(() => {
    repo = makeRepo();
    contractRepo = makeContractRepo();
    ticketRepo = makeTicketRepo();
    logger = makeLogger();
    useCase = new DeleteDeviceUseCase(
      repo,
      contractRepo,
      ticketRepo,
      logger
    );

    repo.findById.mockResolvedValue(Result.ok(makePersistedDevice()));
    repo.save.mockImplementation((device) =>
      Promise.resolve(Result.ok(device))
    );
    contractRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
    ticketRepo.countAll.mockResolvedValue(Result.ok(0));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — validation', () => {
    it('should fail when id is an empty string', async () => {
      const result = await useCase.execute(makeRequest({ id: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when id is whitespace only', async () => {
      const result = await useCase.execute(
        makeRequest({ id: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should not call findById when beforeExecute fails', async () => {
      await useCase.execute(makeRequest({ id: '' }));

      expect(repo.findById).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — ID parsing', () => {
    it('should fail when id is not a valid UUID', async () => {
      const result = await useCase.execute(
        makeRequest({ id: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should call findById with the correct DeviceId', async () => {
      await useCase.execute(makeRequest());

      expect(repo.findById).toHaveBeenCalledTimes(1);
      const calledWith = repo.findById.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(DeviceId);
      expect(calledWith.toString()).toBe(VALID_DEVICE_ID);
    });
  });

  // =========================================================================
  describe('[DEV-068] executeImpl — device lookup', () => {
    it('should fail when findById returns Result.ok(null)', async () => {
      repo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
      expect(result.error).toContain(VALID_DEVICE_ID);
    });

    it('should fail when findById returns a failure Result', async () => {
      repo.findById.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });
  });

  // =========================================================================
  describe('[DEV-075] executeImpl — live contracted service guard', () => {
    it.each(['PENDING', 'ACTIVE', 'SUSPENDED'])(
      'should refuse when the device carries a %s contracted service',
      async (status) => {
        contractRepo.findByDeviceId.mockResolvedValue(
          Result.ok(makeContract(status))
        );

        const result = await useCase.execute(makeRequest());

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'Cannot delete a device with a live contracted service'
        );
        expect(result.error).toContain(status);
        expect(repo.save).not.toHaveBeenCalled();
      }
    );

    it('should allow the delete when the contracted service is CANCELLED', async () => {
      contractRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeContract('CANCELLED'))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should propagate a contracted-service lookup failure', async () => {
      contractRepo.findByDeviceId.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('[DEV-076] executeImpl — open ticket guard', () => {
    it('should refuse when the device has open tickets', async () => {
      ticketRepo.countAll.mockResolvedValue(Result.ok(3));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Cannot delete a device with 3 open ticket(s)'
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should count only non-terminal tickets for this device', async () => {
      await useCase.execute(makeRequest());

      expect(ticketRepo.countAll).toHaveBeenCalledWith({
        deviceId: VALID_DEVICE_ID,
        openOnly: true
      });
    });

    it('should propagate a ticket count failure', async () => {
      ticketRepo.countAll.mockResolvedValue(Result.fail('Timed out'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Timed out');
    });
  });

  // =========================================================================
  describe('[DEV-070] [DEV-071] executeImpl — soft delete', () => {
    it('should persist the tombstone through save(), not delete()', async () => {
      await useCase.execute(makeRequest());

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('[DEV-070] should stamp deletedAt on the saved aggregate', async () => {
      await useCase.execute(makeRequest());

      const saved = repo.save.mock.calls[0][0];
      expect(saved.isDeleted()).toBe(true);
      expect(saved.deletedAt).toBeInstanceOf(Date);
    });

    it('[DEV-070] should record who deleted it', async () => {
      const actor = '11111111-1111-4111-8111-111111111111';

      await useCase.execute(makeRequest({ deletedBy: actor }));

      expect(repo.save.mock.calls[0][0].deletedBy).toBe(actor);
    });

    it('[DEV-070] should record a null actor when none is supplied', async () => {
      await useCase.execute(makeRequest());

      expect(repo.save.mock.calls[0][0].deletedBy).toBeNull();
    });

    it('[DEV-071] should turn monitoring off', async () => {
      await useCase.execute(makeRequest());

      expect(repo.save.mock.calls[0][0].monitoringEnabled).toBe(
        false
      );
    });

    it('should fail when the save fails (propagates error)', async () => {
      repo.save.mockResolvedValue(
        Result.fail('Foreign key constraint violated')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Foreign key constraint violated'
      );
    });

    it('should not save when findById fails', async () => {
      repo.findById.mockResolvedValue(Result.fail('Timed out'));

      await useCase.execute(makeRequest());

      expect(repo.save).not.toHaveBeenCalled();
    });

    it('[DEV-068] should not save when device is not found', async () => {
      repo.findById.mockResolvedValue(Result.ok(null));

      await useCase.execute(makeRequest());

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should return value as undefined', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined();
    });
  });
});
