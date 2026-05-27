// Source: src/application/device-inventory/use-cases/CreateDeviceUseCase.ts

import { IPAddress, MACAddress } from 'domain/shared';
import { CreateDeviceUseCase } from '../../../../src/application/device-inventory/use-cases';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import { CreateDeviceRequestDTO } from '../../../../src/application/device-inventory/dtos';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_MODEL_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_LOCATION_ID = '550e8400-e29b-41d4-a716-446655440001';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): ILogger {
  const logger: ILogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
  return logger;
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
    findByFilters: jest.fn()
  };
}

/**
 * Minimal valid request DTO — satisfies all required fields.
 * Includes a serialNumber so the INVENTORY-status invariant
 * (INVENTORY/DAMAGED must have serial or MAC) is met by default.
 */
function makeMinimalRequest(
  overrides: Partial<CreateDeviceRequestDTO> = {}
): CreateDeviceRequestDTO {
  return {
    deviceModelId: VALID_DEVICE_MODEL_ID,
    name: 'Core-Router-01',
    ownerType: 'COMPANY',
    serialNumber: 'SN-DEFAULT-001',
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('CreateDeviceUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let logger: ILogger;
  let useCase: CreateDeviceUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new CreateDeviceUseCase(repo, logger);

    // Default: no existing MAC or IP, save succeeds
    repo.existsByMacAddress.mockResolvedValue(Result.ok(false));
    repo.existsByIpAddress.mockResolvedValue(Result.ok(false));
    repo.save.mockImplementation(async (device) => Result.ok(device));
  });

  // =========================================================================
  describe('beforeExecute — required field validation', () => {
    it('should fail when deviceModelId is missing', async () => {
      const request = makeMinimalRequest({ deviceModelId: '' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceModelId is required');
    });

    it('should fail when deviceModelId is whitespace only', async () => {
      const request = makeMinimalRequest({ deviceModelId: '   ' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceModelId is required');
    });

    it('should fail when name is missing', async () => {
      const request = makeMinimalRequest({ name: '' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device name is required');
    });

    it('should fail when name is whitespace only', async () => {
      const request = makeMinimalRequest({ name: '   ' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device name is required');
    });

    it('should succeed and set ownerType to null when ownerType is empty', async () => {
      const request = makeMinimalRequest({ ownerType: '' });

      const result = await useCase.execute(request);

      expect(result.isSuccess).toBe(true);
      expect(result.value!.ownerType).toBeNull();
    });

    it('should fail when ownerType is not a valid enum value', async () => {
      const request = makeMinimalRequest({ ownerType: 'PARTNER' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid ownerType');
      expect(result.error).toContain('PARTNER');
    });

    it('should fail when an invalid status is provided', async () => {
      const request = makeMinimalRequest({ status: 'RETIRED' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('RETIRED');
    });

    it('should fail when an invalid category is provided', async () => {
      const request = makeMinimalRequest({ category: 'GATEWAY' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('GATEWAY');
    });

    it('should not call the repository when beforeExecute fails', async () => {
      const request = makeMinimalRequest({ name: '' });

      await useCase.execute(request);

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — ID parsing', () => {
    it('should fail when deviceModelId is not a valid UUID', async () => {
      const request = makeMinimalRequest({
        deviceModelId: 'not-a-uuid'
      });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid deviceModelId');
    });

    it('should fail when locationId is provided but not a valid UUID', async () => {
      const request = makeMinimalRequest({
        locationId: 'bad-location'
      });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid locationId');
    });

    it('should succeed when locationId is a valid UUID', async () => {
      const request = makeMinimalRequest({
        locationId: VALID_LOCATION_ID
      });

      const result = await useCase.execute(request);

      expect(result.isSuccess).toBe(true);
    });

    it('should succeed when locationId is omitted', async () => {
      const request = makeMinimalRequest({ locationId: undefined });

      const result = await useCase.execute(request);

      expect(result.isSuccess).toBe(true);
    });

    it('should succeed when locationId is null', async () => {
      const request = makeMinimalRequest({ locationId: null });

      const result = await useCase.execute(request);

      expect(result.isSuccess).toBe(true);
    });
  });

  // =========================================================================
  describe('executeImpl — MAC address uniqueness', () => {
    it('should fail when MAC address format is invalid', async () => {
      const request = makeMinimalRequest({ macAddress: 'not-a-mac' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not-a-mac');
    });

    it('should fail when MAC address is already in use', async () => {
      repo.existsByMacAddress.mockResolvedValue(Result.ok(true));
      const request = makeMinimalRequest({
        macAddress: 'AA:BB:CC:DD:EE:FF'
      });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already assigned');
    });

    it('should fail when MAC uniqueness check returns a repository error', async () => {
      repo.existsByMacAddress.mockResolvedValue(
        Result.fail('DB connection lost')
      );
      const request = makeMinimalRequest({
        macAddress: 'AA:BB:CC:DD:EE:FF'
      });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to check MAC address uniqueness'
      );
    });

    it('should call existsByMacAddress once with the correct value object', async () => {
      const request = makeMinimalRequest({
        macAddress: 'AA:BB:CC:DD:EE:FF'
      });

      await useCase.execute(request);

      expect(repo.existsByMacAddress).toHaveBeenCalledTimes(1);
      const calledWith = repo.existsByMacAddress.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(MACAddress);
      expect(calledWith.toString()).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should not call existsByMacAddress when macAddress is omitted', async () => {
      const request = makeMinimalRequest();

      await useCase.execute(request);

      expect(repo.existsByMacAddress).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — IP address uniqueness', () => {
    it('should fail when IP address format is invalid', async () => {
      const request = makeMinimalRequest({
        ipAddress: '999.999.999.999'
      });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when IP address is already in use', async () => {
      repo.existsByIpAddress.mockResolvedValue(Result.ok(true));
      const request = makeMinimalRequest({
        ipAddress: '192.168.1.1'
      });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already assigned');
    });

    it('should fail when IP uniqueness check returns a repository error', async () => {
      repo.existsByIpAddress.mockResolvedValue(
        Result.fail('DB timeout')
      );
      const request = makeMinimalRequest({ ipAddress: '10.0.0.1' });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to check IP address uniqueness'
      );
    });

    it('should call existsByIpAddress once with the correct value object', async () => {
      const request = makeMinimalRequest({
        ipAddress: '192.168.1.1'
      });

      await useCase.execute(request);

      expect(repo.existsByIpAddress).toHaveBeenCalledTimes(1);
      const calledWith = repo.existsByIpAddress.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(IPAddress);
      expect(calledWith.toString()).toBe('192.168.1.1');
    });

    it('should not call existsByIpAddress when ipAddress is omitted', async () => {
      const request = makeMinimalRequest();

      await useCase.execute(request);

      expect(repo.existsByIpAddress).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — installedDate parsing', () => {
    it('should fail when installedDate is not a valid date string', async () => {
      const request = makeMinimalRequest({
        installedDate: 'not-a-date'
      });

      const result = await useCase.execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid installedDate');
    });

    it('should succeed with a valid ISO 8601 installedDate', async () => {
      const request = makeMinimalRequest({
        installedDate: '2024-01-15T00:00:00.000Z'
      });

      const result = await useCase.execute(request);

      expect(result.isSuccess).toBe(true);
    });

    it('should succeed when installedDate is null', async () => {
      const request = makeMinimalRequest({ installedDate: null });

      const result = await useCase.execute(request);

      expect(result.isSuccess).toBe(true);
    });
  });

  // =========================================================================
  describe('executeImpl — repository save', () => {
    it('should fail when the repository save returns a failure', async () => {
      repo.save.mockResolvedValue(
        Result.fail('Unique constraint violated')
      );

      const result = await useCase.execute(makeMinimalRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to persist device');
    });

    it('should call repo.save exactly once on success', async () => {
      await useCase.execute(makeMinimalRequest());

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should pass a Device aggregate to repo.save', async () => {
      await useCase.execute(makeMinimalRequest());

      const savedArg = repo.save.mock.calls[0][0];
      expect(savedArg).toBeInstanceOf(Device);
    });
  });

  // =========================================================================
  describe('executeImpl — happy path: minimal request', () => {
    it('should return a successful Result', async () => {
      const result = await useCase.execute(makeMinimalRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DeviceResponseDTO with an id', async () => {
      const result = await useCase.execute(makeMinimalRequest());

      expect(result.value!.id).toBeDefined();
      expect(typeof result.value!.id).toBe('string');
    });

    it('should return a DTO with the correct name', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({ name: 'Core-Router-01' })
      );

      expect(result.value!.name).toBe('Core-Router-01');
    });

    it('should default status to INVENTORY when not provided', async () => {
      const result = await useCase.execute(makeMinimalRequest());

      expect(result.value!.status).toBe('INVENTORY');
    });

    it('should default monitoringEnabled to false when not provided', async () => {
      const result = await useCase.execute(makeMinimalRequest());

      expect(result.value!.monitoringEnabled).toBe(false);
    });

    it('should return locationId as null when not provided', async () => {
      const result = await useCase.execute(makeMinimalRequest());

      expect(result.value!.locationId).toBeNull();
    });

    it('should return category as null when not provided', async () => {
      const result = await useCase.execute(makeMinimalRequest());

      expect(result.value!.category).toBeNull();
    });
  });

  // =========================================================================
  describe('executeImpl — happy path: full request', () => {
    it('should return a DTO with the correct status when provided', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({
          status: 'ACTIVE',
          ipAddress: '192.168.1.1'
        })
      );

      expect(result.value!.status).toBe('ACTIVE');
    });

    it('should return a DTO with the correct category when provided', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({
          category: 'CPE',
          ipAddress: '192.168.1.1'
        })
      );

      expect(result.value!.category).toBe('CPE');
    });

    it('should return a DTO with the correct ownerType', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({ ownerType: 'CLIENT' })
      );

      expect(result.value!.ownerType).toBe('CLIENT');
    });

    it('should return a DTO with the correct locationId when provided', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({ locationId: VALID_LOCATION_ID })
      );

      expect(result.value!.locationId).toBe(VALID_LOCATION_ID);
    });

    it('should return a DTO with the MAC address when provided', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({ macAddress: 'AA:BB:CC:DD:EE:FF' })
      );

      expect(result.value!.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should return a DTO with the IP address when provided', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({ ipAddress: '10.0.0.1' })
      );

      expect(result.value!.ipAddress).toBe('10.0.0.1');
    });

    it('should return a DTO with monitoringEnabled true when requested', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({ monitoringEnabled: true })
      );

      expect(result.value!.monitoringEnabled).toBe(true);
    });

    it('should accept case-insensitive ownerType values', async () => {
      const result = await useCase.execute(
        makeMinimalRequest({ ownerType: 'company' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.ownerType).toBe('COMPANY');
    });
  });
});
