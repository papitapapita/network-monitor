// Source: src/application/device-inventory/use-cases/GetDeviceUseCase.ts

import { GetDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/GetDeviceUseCase';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import { DeviceName, DeviceStatus } from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import { DeviceId, DeviceModelId } from '../../../../src/domain/shared/ids';
import { GetDeviceRequestDTO } from '../../../../src/application/device-inventory/dtos';

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

function makePersistedDevice(
  overrides: { name?: string; status?: string } = {}
): Device {
  const id = DeviceId.parse(VALID_DEVICE_ID).value;
  const modelId = DeviceModelId.parse(VALID_DEVICE_MODEL)
    .value as unknown as DeviceId;
  const status = DeviceStatus.reconstitute(
    overrides.status ?? DeviceStatus.INVENTORY
  );
  const name = DeviceName.reconstitute(overrides.name ?? 'Core-Router-01');

  return Device.reconstitute(id, {
    deviceModelId: modelId as unknown as DeviceModelId,
    locationId: null,
    status,
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name,
    serialNumber: null,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false
  });
}

function makeRequest(
  overrides: Partial<GetDeviceRequestDTO> = {}
): GetDeviceRequestDTO {
  return { id: VALID_DEVICE_ID, ...overrides };
}

// ---------------------------------------------------------------------------

describe('GetDeviceUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let logger: ILogger;
  let useCase: GetDeviceUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new GetDeviceUseCase(repo, logger);

    repo.findById.mockResolvedValue(Result.ok(makePersistedDevice()));
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
      const result = await useCase.execute(makeRequest({ id: '   ' }));

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
      const result = await useCase.execute(makeRequest({ id: 'not-a-uuid' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should trim whitespace from the id before parsing', async () => {
      const result = await useCase.execute(
        makeRequest({ id: `  ${VALID_DEVICE_ID}  ` })
      );

      expect(result.isSuccess).toBe(true);
      expect(repo.findById).toHaveBeenCalledTimes(1);
      const calledWith = repo.findById.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_ID);
    });
  });

  // =========================================================================
  describe('executeImpl — device lookup', () => {
    it('should call findById with the correct DeviceId', async () => {
      await useCase.execute(makeRequest());

      expect(repo.findById).toHaveBeenCalledTimes(1);
      const calledWith = repo.findById.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(DeviceId);
      expect(calledWith.toString()).toBe(VALID_DEVICE_ID);
    });

    it('should fail when findById returns null (device not found)', async () => {
      repo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
      expect(result.error).toContain(VALID_DEVICE_ID);
    });

    it('should fail when findById returns a failure Result', async () => {
      repo.findById.mockResolvedValue(Result.fail('DB connection lost'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true when the device is found', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DeviceResponseDTO with the correct id', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.id).toBe(VALID_DEVICE_ID);
    });

    it('should return a DeviceResponseDTO with the correct name', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(makePersistedDevice({ name: 'Edge-Router-01' }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value!.name).toBe('Edge-Router-01');
    });

    it('should return a DeviceResponseDTO with the correct status', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(makePersistedDevice({ status: DeviceStatus.INVENTORY }))
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value!.status).toBe('INVENTORY');
    });

    it('should return monitoringEnabled as false for a non-monitored device', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.monitoringEnabled).toBe(false);
    });

    it('should return locationId as null when device has no location', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.locationId).toBeNull();
    });
  });
});
