// Source: src/application/device-inventory/use-cases/ListLocationsUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { ListLocationsUseCase } from '../../../../src/application/device-inventory/use-cases/ListLocationsUseCase';
import { ILocationRepository } from '../../../../src/domain/device-inventory/repository/ILocationRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Location } from '../../../../src/domain/device-inventory/aggregates/Location';
import { LocationId } from '../../../../src/domain/shared/ids';
import { LocationType } from '../../../../src/domain/device-inventory/value-objects';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _uuidCounter = 0;
const BASE_UUID = '550e8400-e29b-41d4-a716-44665544';

function makePersistedLocation(
  overrides: {
    name?: string;
    type?: string;
  } = {}
): Location {
  _uuidCounter++;
  const suffix = String(_uuidCounter).padStart(4, '0');
  const id = LocationId.parse(`${BASE_UUID}${suffix}`).value;
  return Location.reconstitute(id, {
    name: overrides.name ?? `Location ${_uuidCounter}`,
    type: LocationType.reconstitute(
      overrides.type ?? LocationType.TOWER
    ),
    address: null,
    coordinates: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z')
  });
}

function makeLocations(count: number, type?: string): Location[] {
  return Array.from({ length: count }, () =>
    makePersistedLocation({ type })
  );
}

// ---------------------------------------------------------------------------

describe('ListLocationsUseCase', () => {
  let useCase: ListLocationsUseCase;
  let mockRepository: jest.Mocked<ILocationRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    _uuidCounter = 0;

    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByType: jest.fn(),
      findAllWithCoordinates: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      count: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    } as any;

    useCase = new ListLocationsUseCase(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('executeImpl — unfiltered listing', () => {
    // -----------------------------------------------------------------------
    describe('pagination defaults', () => {
      it('should call repository.findAll with default limit 20 when limit is not provided', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({});

        const [calledLimit] = (
          mockRepository.findAll as jest.MockedFunction<
            typeof mockRepository.findAll
          >
        ).mock.calls[0];
        expect(calledLimit).toBe(20);
      });

      it('should call repository.findAll with default offset 0 when offset is not provided', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({});

        const [, calledOffset] = (
          mockRepository.findAll as jest.MockedFunction<
            typeof mockRepository.findAll
          >
        ).mock.calls[0];
        expect(calledOffset).toBe(0);
      });

      it('should cap limit at 100 when a higher value is requested', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({ limit: 500 });

        const [calledLimit] = (
          mockRepository.findAll as jest.MockedFunction<
            typeof mockRepository.findAll
          >
        ).mock.calls[0];
        expect(calledLimit).toBe(100);
      });

      it('should pass the provided limit when it is within bounds', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({ limit: 50 });

        const [calledLimit] = (
          mockRepository.findAll as jest.MockedFunction<
            typeof mockRepository.findAll
          >
        ).mock.calls[0];
        expect(calledLimit).toBe(50);
      });

      it('should pass the provided offset', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({ offset: 40 });

        const [, calledOffset] = (
          mockRepository.findAll as jest.MockedFunction<
            typeof mockRepository.findAll
          >
        ).mock.calls[0];
        expect(calledOffset).toBe(40);
      });
    });

    // -----------------------------------------------------------------------
    describe('repository interaction', () => {
      it('should call repository.findAll and repository.count when no type filter is provided', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({});

        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
        expect(mockRepository.count).toHaveBeenCalledTimes(1);
      });

      it('should NOT call repository.findByType when no type filter is provided', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        await useCase.execute({});

        expect(mockRepository.findByType).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('response DTO — unfiltered', () => {
      it('should return isSuccess true on a successful unfiltered list', async () => {
        mockRepository.findAll.mockResolvedValue(
          Result.ok(makeLocations(3))
        );
        mockRepository.count.mockResolvedValue(Result.ok(3));

        const result = await useCase.execute({});

        expect(result.isSuccess).toBe(true);
      });

      it('should return the number of locations in the locations array', async () => {
        mockRepository.findAll.mockResolvedValue(
          Result.ok(makeLocations(3))
        );
        mockRepository.count.mockResolvedValue(Result.ok(10));

        const result = await useCase.execute({});

        expect(result.value.locations).toHaveLength(3);
      });

      it('should return the total from repository.count', async () => {
        mockRepository.findAll.mockResolvedValue(
          Result.ok(makeLocations(3))
        );
        mockRepository.count.mockResolvedValue(Result.ok(42));

        const result = await useCase.execute({});

        expect(result.value.total).toBe(42);
      });

      it('should return the resolved limit in the response DTO', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute({ limit: 50 });

        expect(result.value.limit).toBe(50);
      });

      it('should return the offset in the response DTO', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute({ offset: 20 });

        expect(result.value.offset).toBe(20);
      });

      it('should set hasMore true when there are more results beyond the current page', async () => {
        mockRepository.findAll.mockResolvedValue(
          Result.ok(makeLocations(20))
        );
        mockRepository.count.mockResolvedValue(Result.ok(100));

        const result = await useCase.execute({
          limit: 20,
          offset: 0
        });

        expect(result.value.hasMore).toBe(true);
      });

      it('should set hasMore false when the current page exhausts all results', async () => {
        mockRepository.findAll.mockResolvedValue(
          Result.ok(makeLocations(5))
        );
        mockRepository.count.mockResolvedValue(Result.ok(5));

        const result = await useCase.execute({
          limit: 20,
          offset: 0
        });

        expect(result.value.hasMore).toBe(false);
      });

      it('should return an empty locations array when there are no results', async () => {
        mockRepository.findAll.mockResolvedValue(Result.ok([]));
        mockRepository.count.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute({});

        expect(result.value.locations).toEqual([]);
      });
    });
  });

  // =========================================================================
  describe('executeImpl — type-filtered listing', () => {
    // -----------------------------------------------------------------------
    describe('repository interaction', () => {
      it('should call repository.findByType and NOT findAll when a type filter is provided', async () => {
        mockRepository.findByType.mockResolvedValue(
          Result.ok(makeLocations(2, LocationType.TOWER))
        );

        await useCase.execute({ type: 'TOWER' });

        expect(mockRepository.findByType).toHaveBeenCalledTimes(1);
        expect(mockRepository.findAll).not.toHaveBeenCalled();
      });

      it('should call repository.findByType with the correct LocationType', async () => {
        mockRepository.findByType.mockResolvedValue(Result.ok([]));

        await useCase.execute({ type: 'DATACENTER' });

        const calledType = (
          mockRepository.findByType as jest.MockedFunction<
            typeof mockRepository.findByType
          >
        ).mock.calls[0][0];
        expect(calledType.value).toBe(LocationType.DATACENTER);
      });

      it('should accept a lowercase type string (case-insensitive)', async () => {
        mockRepository.findByType.mockResolvedValue(Result.ok([]));

        const result = await useCase.execute({ type: 'tower' });

        expect(result.isSuccess).toBe(true);
        expect(mockRepository.findByType).toHaveBeenCalled();
      });

      it('should NOT call repository.count when a type filter is provided', async () => {
        mockRepository.findByType.mockResolvedValue(Result.ok([]));

        await useCase.execute({ type: 'TOWER' });

        expect(mockRepository.count).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('in-memory pagination for type-filtered results', () => {
      it('should return only the first page of results when offset is 0', async () => {
        mockRepository.findByType.mockResolvedValue(
          Result.ok(makeLocations(10, LocationType.TOWER))
        );

        const result = await useCase.execute({
          type: 'TOWER',
          limit: 3,
          offset: 0
        });

        expect(result.value.locations).toHaveLength(3);
      });

      it('should skip results according to the offset', async () => {
        const allLocations = makeLocations(10, LocationType.TOWER);
        mockRepository.findByType.mockResolvedValue(
          Result.ok(allLocations)
        );

        const result = await useCase.execute({
          type: 'TOWER',
          limit: 3,
          offset: 3
        });

        expect(result.value.locations).toHaveLength(3);
        expect(result.value.locations[0].name).toBe(
          allLocations[3].name
        );
      });

      it('should return fewer items than limit on the last page', async () => {
        mockRepository.findByType.mockResolvedValue(
          Result.ok(makeLocations(5, LocationType.TOWER))
        );

        const result = await useCase.execute({
          type: 'TOWER',
          limit: 3,
          offset: 3
        });

        expect(result.value.locations).toHaveLength(2);
      });

      it('should return the total as the number of all matching locations before pagination', async () => {
        mockRepository.findByType.mockResolvedValue(
          Result.ok(makeLocations(10, LocationType.TOWER))
        );

        const result = await useCase.execute({
          type: 'TOWER',
          limit: 3,
          offset: 0
        });

        expect(result.value.total).toBe(10);
      });

      it('should set hasMore true when there are more pages after the current one', async () => {
        mockRepository.findByType.mockResolvedValue(
          Result.ok(makeLocations(10, LocationType.TOWER))
        );

        const result = await useCase.execute({
          type: 'TOWER',
          limit: 3,
          offset: 0
        });

        expect(result.value.hasMore).toBe(true);
      });

      it('should set hasMore false on the last page', async () => {
        mockRepository.findByType.mockResolvedValue(
          Result.ok(makeLocations(10, LocationType.TOWER))
        );

        // offset 9 + limit 3 → slice(9, 12) → 1 item, 9 + 1 = 10, not < 10
        const result = await useCase.execute({
          type: 'TOWER',
          limit: 3,
          offset: 9
        });

        expect(result.value.hasMore).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('type validation', () => {
      it('should return failure for an invalid type string', async () => {
        const result = await useCase.execute({
          type: 'INVALID_TYPE'
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('INVALID_TYPE');
      });

      it('should not call any repository method when the type string is invalid', async () => {
        await useCase.execute({ type: 'INVALID_TYPE' });

        expect(mockRepository.findByType).not.toHaveBeenCalled();
        expect(mockRepository.findAll).not.toHaveBeenCalled();
        expect(mockRepository.count).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  describe('executeImpl — failure paths', () => {
    it('should return failure when repository.findAll returns a failure Result', async () => {
      mockRepository.findAll.mockResolvedValue(
        Result.fail('DB read error')
      );

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB read error');
    });

    it('should return failure when repository.count returns a failure Result', async () => {
      mockRepository.findAll.mockResolvedValue(Result.ok([]));
      mockRepository.count.mockResolvedValue(
        Result.fail('count query failed')
      );

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('count query failed');
    });

    it('should return failure when repository.findByType returns a failure Result', async () => {
      mockRepository.findByType.mockResolvedValue(
        Result.fail('DB type query error')
      );

      const result = await useCase.execute({ type: 'TOWER' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB type query error');
    });
  });
});
