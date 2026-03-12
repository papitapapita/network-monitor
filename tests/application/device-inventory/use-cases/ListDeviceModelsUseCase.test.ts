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
import { DeviceModelRecord } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeRecord(id: string = '550e8400-e29b-41d4-a716-446655440000'): DeviceModelRecord {
  return {
    id,
    manufacturer: 'Mikrotik',
    model: 'RB760iGS',
    deviceType: 'ROUTER',
    createdAt: NOW,
    updatedAt: NOW
  };
}

function makeRecordPage(count: number): DeviceModelRecord[] {
  return Array.from({ length: count }, (_, i) =>
    makeRecord(`550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`)
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
    count: jest.fn()
  } as any;
}

// ---------------------------------------------------------------------------

describe('ListDeviceModelsUseCase', () => {
  let useCase: ListDeviceModelsUseCase;
  let mockRepository: jest.Mocked<IDeviceModelRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockRepository = makeRepo();
    mockLogger = makeLogger();
    useCase = new ListDeviceModelsUseCase(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('executeImpl — successful listing', () => {
    // -----------------------------------------------------------------------
    describe('repository interaction', () => {
      it('should call repository.findAll exactly once', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(5)));
        mockRepository.count.mockResolvedValue(Result.ok(5));

        await useCase.execute({});

        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      });

      it('should call repository.count exactly once', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(5)));
        mockRepository.count.mockResolvedValue(Result.ok(5));

        await useCase.execute({});

        expect(mockRepository.count).toHaveBeenCalledTimes(1);
      });

      it('should pass default limit 20 to repository.findAll when not specified', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({});

        expect(mockRepository.findAll).toHaveBeenCalledWith(20, 0);
      });

      it('should pass the provided limit to repository.findAll', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({ limit: 10 });

        expect(mockRepository.findAll).toHaveBeenCalledWith(10, 0);
      });

      it('should cap the limit at 100', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({ limit: 9999 });

        expect(mockRepository.findAll).toHaveBeenCalledWith(100, 0);
      });

      it('should pass the provided offset to repository.findAll', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({ offset: 40 });

        expect(mockRepository.findAll).toHaveBeenCalledWith(20, 40);
      });
    });

    // -----------------------------------------------------------------------
    describe('response DTO', () => {
      it('should return isSuccess true', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(3)));
        mockRepository.count.mockResolvedValue(Result.ok(3));

        const result = await useCase.execute({});

        expect(result.isSuccess).toBe(true);
      });

      it('should return the total count from the repository', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(5)));
        mockRepository.count.mockResolvedValue(Result.ok(42));

        const result = await useCase.execute({});

        expect(result.value.total).toBe(42);
      });

      it('should include the applied limit in the response', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(10)));
        mockRepository.count.mockResolvedValue(Result.ok(10));

        const result = await useCase.execute({ limit: 10 });

        expect(result.value.limit).toBe(10);
      });

      it('should include the applied offset in the response', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(5)));
        mockRepository.count.mockResolvedValue(Result.ok(25));

        const result = await useCase.execute({ offset: 20 });

        expect(result.value.offset).toBe(20);
      });

      it('should set hasMore to true when more items exist', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(20)));
        mockRepository.count.mockResolvedValue(Result.ok(50));

        const result = await useCase.execute({ limit: 20, offset: 0 });

        expect(result.value.hasMore).toBe(true);
      });

      it('should set hasMore to false when current page covers all items', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(5)));
        mockRepository.count.mockResolvedValue(Result.ok(5));

        const result = await useCase.execute({});

        expect(result.value.hasMore).toBe(false);
      });

      it('should include the mapped deviceModels array', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(3)));
        mockRepository.count.mockResolvedValue(Result.ok(3));

        const result = await useCase.execute({});

        expect(result.value.deviceModels).toHaveLength(3);
      });

      it('should return an empty deviceModels array when no records exist', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute({});

        expect(result.value.deviceModels).toEqual([]);
      });
    });
  });

  // =========================================================================
  describe('executeImpl — failure paths', () => {
    describe('repository.findAll failure', () => {
      it('should return failure when repository.findAll returns a failure Result', async () => {
        mockRepository.findAll.mockResolvedValue(
          Result.fail('DB connection refused')
        );

        const result = await useCase.execute({});

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('DB connection refused');
      });

      it('should not call count when findAll fails', async () => {
        mockRepository.findAll.mockResolvedValue(
          Result.fail('DB connection refused')
        );

        await useCase.execute({});

        expect(mockRepository.count).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('repository.count failure', () => {
      it('should return failure when repository.count returns a failure Result', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok(makeRecordPage(5)));
        mockRepository.count.mockResolvedValue(Result.fail('Count query failed'));

        const result = await useCase.execute({});

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Count query failed');
      });
    });
  });
});
