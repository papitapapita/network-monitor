// Source: src/application/device-inventory/use-cases/ListDeviceModelsUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { ListDeviceModelsUseCase } from '../../../../src/application/device-inventory/use-cases/ListDeviceModelsUseCase';
import { IDeviceModelRepository } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { DeviceModel } from '../../../../src/domain/device-inventory/aggregates/DeviceModel';
import { DeviceModelId, VendorId } from '../../../../src/domain/shared/ids';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeDeviceModel(id: string = '550e8400-e29b-41d4-a716-446655440000'): DeviceModel {
  return DeviceModel.reconstitute(
    DeviceModelId.parse(id).value!,
    {
      vendorId: VendorId.parse(VENDOR_UUID).value!,
      vendorName: 'Mikrotik',
      vendorSlug: 'mikrotik',
      model: 'RB760iGS',
      deviceType: 'ROUTER',
      createdAt: NOW,
      updatedAt: NOW
    }
  );
}

function makeModelPage(count: number): DeviceModel[] {
  return Array.from({ length: count }, (_, i) =>
    makeDeviceModel(`550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`)
  );
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  } as any;
}

function makeRepo(): jest.Mocked<IDeviceModelRepository> {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    findByVendor: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsByVendorAndModel: jest.fn(),
    count: jest.fn()
  } as any;
}

// ---------------------------------------------------------------------------

describe('ListDeviceModelsUseCase', () => {
  let useCase: ListDeviceModelsUseCase;
  let repo: jest.Mocked<IDeviceModelRepository>;
  let logger: jest.Mocked<ILogger>;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new ListDeviceModelsUseCase(repo, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('happy path', () => {
    it('should return a paginated list of device models', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok(makeModelPage(3)));
      (repo.count as any).mockResolvedValue(Result.ok(3));

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value!.deviceModels).toHaveLength(3);
      expect(result.value!.total).toBe(3);
    });

    it('should pass limit and offset to repository', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok(makeModelPage(5)));
      (repo.count as any).mockResolvedValue(Result.ok(20));

      await useCase.execute({ limit: 5, offset: 10 });

      expect(repo.findAll).toHaveBeenCalledWith(5, 10);
    });

    it('should cap limit at 100', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok([]));
      (repo.count as any).mockResolvedValue(Result.ok(0));

      await useCase.execute({ limit: 999 });

      expect(repo.findAll).toHaveBeenCalledWith(100, 0);
    });

    it('should default limit to 20', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok([]));
      (repo.count as any).mockResolvedValue(Result.ok(0));

      await useCase.execute({});

      expect(repo.findAll).toHaveBeenCalledWith(20, 0);
    });

    it('should return hasMore=true when more pages exist', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok(makeModelPage(20)));
      (repo.count as any).mockResolvedValue(Result.ok(50));

      const result = await useCase.execute({ limit: 20, offset: 0 });

      expect(result.value!.hasMore).toBe(true);
    });

    it('should return hasMore=false on the last page', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok(makeModelPage(5)));
      (repo.count as any).mockResolvedValue(Result.ok(25));

      const result = await useCase.execute({ limit: 20, offset: 20 });

      expect(result.value!.hasMore).toBe(false);
    });
  });

  // =========================================================================
  describe('error handling', () => {
    it('should propagate findAll repository failures', async () => {
      (repo.findAll as any).mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
    });

    it('should propagate count repository failures', async () => {
      (repo.findAll as any).mockResolvedValue(Result.ok([]));
      (repo.count as any).mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
    });
  });
});
