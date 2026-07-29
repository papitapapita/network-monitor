// Source: src/application/device-inventory/use-cases/ListDevicesUseCase.ts

import { IPAddress } from 'domain/shared';
import { ListDevicesUseCase } from './../../../../src/application/device-inventory/use-cases';
import { IDeviceRepository } from './../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from './../../../../src/domain/shared/core';
import { Device } from './../../../../src/domain/device-inventory/aggregates';
import {
  DeviceName,
  DeviceStatus,
  DeviceCategory
} from './../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from './../../../../src/domain/device-inventory/enums';
import {
  DeviceModelId,
  LocationId
} from './../../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_LOCATION_UUID = '550e8400-e29b-41d4-a716-446655440010';
const VALID_DEVICE_MODEL_UUID =
  '550e8400-e29b-41d4-a716-446655440011';

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
    findByLocationIds: jest.fn(),
    findByFilters: jest.fn()
  };
}

/**
 * Creates a minimal Device aggregate for testing list responses.
 * Device.create() emits a DeviceCreatedEvent; that is irrelevant for these tests.
 */
function makeDevice(): Device {
  const modelIdResult = DeviceModelId.parse(VALID_DEVICE_MODEL_UUID);
  const locationIdResult = LocationId.parse(VALID_LOCATION_UUID);
  const nameResult = DeviceName.create('Test Device');
  const statusResult = DeviceStatus.create('ACTIVE');
  const ipAddressResult = IPAddress.create('192.168.1.100');

  const deviceResult = Device.create({
    deviceModelId: modelIdResult.value!,
    locationId: locationIdResult.value!,
    name: nameResult.value!,
    status: statusResult.value!,
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    serialNumber: null,
    macAddress: null,
    ipAddress: ipAddressResult.value!,
    description: null,
    installedDate: null,
    monitoringEnabled: false
  });

  return deviceResult.value!;
}

function makeDevicePage(count: number): Device[] {
  return Array.from({ length: count }, () => makeDevice());
}

// ---------------------------------------------------------------------------

describe('ListDevicesUseCase', () => {
  let repo: jest.Mocked<IDeviceRepository>;
  let logger: ILogger;
  let useCase: ListDevicesUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new ListDevicesUseCase(repo, logger);
  });

  // =========================================================================
  describe('no filters — DB-level pagination path', () => {
    beforeEach(() => {
      repo.findAll.mockResolvedValue(Result.ok(makeDevicePage(5)));
      repo.count.mockResolvedValue(Result.ok(5));
    });

    it('should call findAll (not findByFilters) when no filters are supplied', async () => {
      await useCase.execute({});

      expect(repo.findAll).toHaveBeenCalledTimes(1);
      expect(repo.findByFilters).not.toHaveBeenCalled();
    });

    it('should call count when no filters are supplied', async () => {
      await useCase.execute({});

      expect(repo.count).toHaveBeenCalledTimes(1);
    });

    it('should return a successful Result', async () => {
      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
    });

    it('should return the total from the count call', async () => {
      repo.count.mockResolvedValue(Result.ok(42));
      repo.findAll.mockResolvedValue(Result.ok(makeDevicePage(20)));

      const result = await useCase.execute({ limit: 20, offset: 0 });

      expect(result.value!.total).toBe(42);
    });

    it('should pass the limit to findAll', async () => {
      await useCase.execute({ limit: 10, offset: 0 });

      expect(repo.findAll).toHaveBeenCalledWith(10, 0);
    });

    it('should pass the offset to findAll', async () => {
      await useCase.execute({ limit: 20, offset: 40 });

      expect(repo.findAll).toHaveBeenCalledWith(20, 40);
    });

    it('should use default limit of 20 when not provided', async () => {
      await useCase.execute({});

      expect(repo.findAll).toHaveBeenCalledWith(20, 0);
    });

    it('should use default offset of 0 when not provided', async () => {
      await useCase.execute({ limit: 10 });

      expect(repo.findAll).toHaveBeenCalledWith(10, 0);
    });

    it('should cap the limit at 100', async () => {
      await useCase.execute({ limit: 999 });

      expect(repo.findAll).toHaveBeenCalledWith(100, 0);
    });

    it('should set hasMore to true when more items exist beyond the current page', async () => {
      repo.findAll.mockResolvedValue(Result.ok(makeDevicePage(20)));
      repo.count.mockResolvedValue(Result.ok(50));

      const result = await useCase.execute({ limit: 20, offset: 0 });

      expect(result.value!.hasMore).toBe(true);
    });

    it('should set hasMore to false when the page covers all remaining items', async () => {
      repo.findAll.mockResolvedValue(Result.ok(makeDevicePage(10)));
      repo.count.mockResolvedValue(Result.ok(30));

      const result = await useCase.execute({ limit: 20, offset: 20 });

      expect(result.value!.hasMore).toBe(false);
    });

    it('should fail when findAll returns a repository error', async () => {
      repo.findAll.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection lost');
    });

    it('should fail when count returns a repository error', async () => {
      repo.count.mockResolvedValue(Result.fail('count query failed'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('count query failed');
    });

    it('should return devices mapped to DTOs', async () => {
      repo.findAll.mockResolvedValue(Result.ok(makeDevicePage(3)));
      repo.count.mockResolvedValue(Result.ok(3));

      const result = await useCase.execute({});

      expect(result.value!.devices).toHaveLength(3);
    });
  });

  // =========================================================================
  describe('with filters — in-memory pagination path', () => {
    beforeEach(() => {
      repo.findByFilters.mockResolvedValue(
        Result.ok(makeDevicePage(10))
      );
    });

    it('should call findByFilters (not findAll) when a status filter is provided', async () => {
      await useCase.execute({ status: 'ACTIVE' });

      expect(repo.findByFilters).toHaveBeenCalledTimes(1);
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('should not call count when filters are active', async () => {
      await useCase.execute({ status: 'ACTIVE' });

      expect(repo.count).not.toHaveBeenCalled();
    });

    it('should pass a DeviceStatus value object for the status filter', async () => {
      await useCase.execute({ status: 'ACTIVE' });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.status).toBeInstanceOf(DeviceStatus);
      expect(filters.status!.toString()).toBe('ACTIVE');
    });

    it('should pass a DeviceCategory value object for the category filter', async () => {
      await useCase.execute({ category: 'CPE' });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.category).toBeInstanceOf(DeviceCategory);
      expect(filters.category!.toString()).toBe('CPE');
    });

    it('should pass a DeviceOwnerType string for the owner filter', async () => {
      await useCase.execute({ owner: 'COMPANY' });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.owner).toBe(DeviceOwnerType.COMPANY);
    });

    it('should pass a LocationId value object for the locationId filter', async () => {
      await useCase.execute({ locationId: VALID_LOCATION_UUID });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.locationId).toBeInstanceOf(LocationId);
      expect(filters.locationId!.toString()).toBe(
        VALID_LOCATION_UUID
      );
    });

    it('should pass a DeviceModelId value object for the deviceModelId filter', async () => {
      await useCase.execute({
        deviceModelId: VALID_DEVICE_MODEL_UUID
      });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.deviceModelId).toBeInstanceOf(DeviceModelId);
      expect(filters.deviceModelId!.toString()).toBe(
        VALID_DEVICE_MODEL_UUID
      );
    });

    it('should pass monitoringEnabled through to findByFilters', async () => {
      await useCase.execute({ monitoringEnabled: true });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.monitoringEnabled).toBe(true);
    });

    it('should pass search string through to findByFilters', async () => {
      await useCase.execute({ search: 'core' });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.search).toBe('core');
    });

    it('should pass sortBy through to findByFilters', async () => {
      await useCase.execute({ status: 'ACTIVE', sortBy: 'name' });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.sortBy).toBe('name');
    });

    it('should pass sortOrder through to findByFilters', async () => {
      await useCase.execute({ status: 'ACTIVE', sortOrder: 'ASC' });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.sortOrder).toBe('ASC');
    });

    it('should not pass limit/offset inside findByFilters (uses in-memory pagination)', async () => {
      await useCase.execute({
        status: 'ACTIVE',
        limit: 5,
        offset: 10
      });

      const filters = repo.findByFilters.mock.calls[0][0];
      expect(filters.limit).toBeUndefined();
      expect(filters.offset).toBeUndefined();
    });

    it('should apply in-memory pagination using the limit and offset', async () => {
      repo.findByFilters.mockResolvedValue(
        Result.ok(makeDevicePage(30))
      );

      const result = await useCase.execute({
        status: 'ACTIVE',
        limit: 10,
        offset: 10
      });

      expect(result.value!.devices).toHaveLength(10);
    });

    it('should set total to the full result count before in-memory pagination', async () => {
      repo.findByFilters.mockResolvedValue(
        Result.ok(makeDevicePage(30))
      );

      const result = await useCase.execute({
        status: 'ACTIVE',
        limit: 10,
        offset: 0
      });

      expect(result.value!.total).toBe(30);
    });

    it('should set hasMore to true when more filtered items remain', async () => {
      repo.findByFilters.mockResolvedValue(
        Result.ok(makeDevicePage(30))
      );

      const result = await useCase.execute({
        status: 'ACTIVE',
        limit: 10,
        offset: 0
      });

      expect(result.value!.hasMore).toBe(true);
    });

    it('should set hasMore to false when all filtered items are covered', async () => {
      repo.findByFilters.mockResolvedValue(
        Result.ok(makeDevicePage(15))
      );

      const result = await useCase.execute({
        status: 'ACTIVE',
        limit: 10,
        offset: 10
      });

      expect(result.value!.hasMore).toBe(false);
    });

    it('should fail when findByFilters returns a repository error', async () => {
      repo.findByFilters.mockResolvedValue(
        Result.fail('query failed')
      );

      const result = await useCase.execute({ status: 'ACTIVE' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('query failed');
    });

    it('should return a successful Result for an empty filtered result', async () => {
      repo.findByFilters.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({
        status: 'INVENTORY'
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value!.devices).toHaveLength(0);
      expect(result.value!.total).toBe(0);
      expect(result.value!.hasMore).toBe(false);
    });
  });

  // =========================================================================
  describe('filter validation — invalid enum values', () => {
    it('should fail when an invalid status is provided', async () => {
      const result = await useCase.execute({ status: 'RETIRED' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('RETIRED');
    });

    it('should fail when an invalid category is provided', async () => {
      const result = await useCase.execute({ category: 'GATEWAY' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('GATEWAY');
    });

    it('should fail when an invalid owner type is provided', async () => {
      const result = await useCase.execute({ owner: 'PARTNER' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('PARTNER');
    });

    it('should fail when locationId is not a valid UUID', async () => {
      const result = await useCase.execute({
        locationId: 'not-a-uuid'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid locationId');
    });

    it('should fail when deviceModelId is not a valid UUID', async () => {
      const result = await useCase.execute({
        deviceModelId: 'bad-model-id'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid deviceModelId');
    });

    it('should not call the repository when filter validation fails', async () => {
      await useCase.execute({ status: 'INVALID' });

      expect(repo.findByFilters).not.toHaveBeenCalled();
      expect(repo.findAll).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('filter validation — case-insensitive enum values', () => {
    beforeEach(() => {
      repo.findByFilters.mockResolvedValue(Result.ok([]));
    });

    it('should accept lowercase status values', async () => {
      const result = await useCase.execute({ status: 'active' });

      expect(result.isSuccess).toBe(true);
    });

    it('should accept lowercase category values', async () => {
      const result = await useCase.execute({ category: 'cpe' });

      expect(result.isSuccess).toBe(true);
    });

    it('should accept lowercase owner values', async () => {
      const result = await useCase.execute({ owner: 'company' });

      expect(result.isSuccess).toBe(true);
    });
  });

  // =========================================================================
  describe('[DEV-142] pagination — no-filter path limit caps', () => {
    beforeEach(() => {
      repo.findAll.mockResolvedValue(Result.ok([]));
      repo.count.mockResolvedValue(Result.ok(0));
    });

    it('should include limit in the response', async () => {
      const result = await useCase.execute({ limit: 10, offset: 0 });

      expect(result.value!.limit).toBe(10);
    });

    it('should include offset in the response', async () => {
      const result = await useCase.execute({ limit: 10, offset: 20 });

      expect(result.value!.offset).toBe(20);
    });

    it('should cap limit at 100 and reflect the capped value in the response', async () => {
      const result = await useCase.execute({ limit: 500 });

      expect(result.value!.limit).toBe(100);
      expect(repo.findAll).toHaveBeenCalledWith(100, 0);
    });
  });
});
