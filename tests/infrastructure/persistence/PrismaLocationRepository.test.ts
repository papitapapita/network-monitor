// Source: src/infrastructure/persistence/PrismaLocationRepository.ts

import { PrismaLocationRepository } from '../../../src/infrastructure/persistence/PrismaLocationRepository';
import { LocationMapper } from '../../../src/infrastructure/mappers/LocationMapper';
import { Location } from '../../../src/domain/device-inventory/aggregates';
import { LocationId } from '../../../src/domain/shared/ids';
import { LocationType } from '../../../src/domain/device-inventory/enums';
import { Result, EventDispatcher } from '../../../src/domain/shared/core';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// Mock LocationMapper so we can control toDomain / toPersistence in isolation.
jest.mock('../../../src/infrastructure/mappers/LocationMapper');

// ---------------------------------------------------------------------------
// Typed alias for the mocked LocationMapper
// ---------------------------------------------------------------------------

const MockedLocationMapper = LocationMapper as jest.Mocked<typeof LocationMapper>;

// ---------------------------------------------------------------------------
// Helpers — fake Prisma client and fake Location domain objects
// ---------------------------------------------------------------------------

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';

function makeFakePrismaClient(): {
  location: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
} {
  return {
    location: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  };
}

function makeFakePrismaRow(id = VALID_UUID_1): Record<string, unknown> {
  return {
    id,
    name: 'Tower Alpha',
    type: 'TOWER',
    municipality: 'Medellín',
    neighborhood: null,
    address: null,
    latitude: null,
    longitude: null,
    altitude: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };
}

function makeFakeLocation(id = VALID_UUID_1): Location {
  const locationId = LocationId.parse(id).value;
  return Location.reconstitute(locationId, {
    name: 'Tower Alpha',
    type: LocationType.TOWER,
    address: null,
    coordinates: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  });
}

function makeFakePersistenceData(id = VALID_UUID_1): Record<string, unknown> {
  return {
    id,
    name: 'Tower Alpha',
    type: 'TOWER',
    municipality: 'Medellín',
    neighborhood: null,
    address: null,
    latitude: null,
    longitude: null,
    altitude: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };
}

// ---------------------------------------------------------------------------

describe('PrismaLocationRepository', () => {
  let prisma: ReturnType<typeof makeFakePrismaClient>;
  let repository: PrismaLocationRepository;
  let fakeLocation: Location;
  let fakeLocationId: LocationId;
  let fakePersistenceData: Record<string, unknown>;
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = makeFakePrismaClient();
    repository = new PrismaLocationRepository(prisma as never);

    fakeLocation = makeFakeLocation();
    fakeLocationId = LocationId.parse(VALID_UUID_1).value;
    fakePersistenceData = makeFakePersistenceData();

    // Spy on the static EventDispatcher method so we can verify it is called
    // without replacing the real implementation that other tests rely on.
    dispatchSpy = jest
      .spyOn(EventDispatcher, 'dispatchEventsForAggregate')
      .mockImplementation(() => undefined);

    // Default: toPersistence returns well-formed data
    MockedLocationMapper.toPersistence.mockReturnValue(fakePersistenceData as never);
    // Default: toDomain returns the fakeLocation wrapped in Result.ok
    MockedLocationMapper.toDomain.mockReturnValue(Result.ok(fakeLocation));
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  // =========================================================================
  describe('save()', () => {
    describe('success', () => {
      it('should call LocationMapper.toPersistence with the location', async () => {
        prisma.location.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeLocation);

        expect(MockedLocationMapper.toPersistence).toHaveBeenCalledWith(fakeLocation);
      });

      it('should call prisma.location.upsert with the persistence data', async () => {
        prisma.location.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeLocation);

        expect(prisma.location.upsert).toHaveBeenCalledTimes(1);
        expect(prisma.location.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: fakePersistenceData.id },
            create: fakePersistenceData
          })
        );
      });

      it('should include all mutable fields in the update clause', async () => {
        prisma.location.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeLocation);

        const upsertCall = prisma.location.upsert.mock.calls[0][0] as Record<
          string,
          Record<string, unknown>
        >;
        expect(upsertCall.update).toEqual(
          expect.objectContaining({
            name: fakePersistenceData.name,
            type: fakePersistenceData.type,
            municipality: fakePersistenceData.municipality,
            neighborhood: fakePersistenceData.neighborhood,
            address: fakePersistenceData.address,
            latitude: fakePersistenceData.latitude,
            longitude: fakePersistenceData.longitude,
            altitude: fakePersistenceData.altitude,
            updatedAt: fakePersistenceData.updatedAt
          })
        );
      });

      it('should call EventDispatcher.dispatchEventsForAggregate with the location id', async () => {
        prisma.location.upsert.mockResolvedValue(fakePersistenceData);

        await repository.save(fakeLocation);

        expect(dispatchSpy).toHaveBeenCalledWith(fakeLocation.id);
      });

      it('should return a successful Result containing the original location', async () => {
        prisma.location.upsert.mockResolvedValue(fakePersistenceData);

        const result = await repository.save(fakeLocation);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(fakeLocation);
      });
    });

    describe('Prisma P2002 unique constraint error', () => {
      it('should return a failed Result without throwing', async () => {
        prisma.location.upsert.mockRejectedValue(
          new Error('Unique constraint failed on the fields: (`name`) P2002')
        );

        const result = await repository.save(fakeLocation);

        expect(result.isFailure).toBe(true);
      });

      it('should include a descriptive unique-constraint message in the error', async () => {
        prisma.location.upsert.mockRejectedValue(
          new Error('Unique constraint failed P2002')
        );

        const result = await repository.save(fakeLocation);

        expect(result.error).toContain('unique values already exists');
      });

      it('should not dispatch events when the upsert fails', async () => {
        prisma.location.upsert.mockRejectedValue(new Error('P2002 violation'));

        await repository.save(fakeLocation);

        expect(dispatchSpy).not.toHaveBeenCalled();
      });
    });

    describe('generic database error', () => {
      it('should return a failed Result containing the error message', async () => {
        prisma.location.upsert.mockRejectedValue(
          new Error('Connection refused')
        );

        const result = await repository.save(fakeLocation);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Connection refused');
      });

      it('should prefix the error with "Database error saving location"', async () => {
        prisma.location.upsert.mockRejectedValue(
          new Error('timeout exceeded')
        );

        const result = await repository.save(fakeLocation);

        expect(result.error).toContain('Database error saving location');
      });

      it('should handle non-Error throwables gracefully', async () => {
        prisma.location.upsert.mockRejectedValue('unexpected string error');

        const result = await repository.save(fakeLocation);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('unexpected string error');
      });
    });
  });

  // =========================================================================
  describe('findById()', () => {
    describe('record found — mapping succeeds', () => {
      it('should call prisma.location.findUnique with the stringified id', async () => {
        prisma.location.findUnique.mockResolvedValue(makeFakePrismaRow());

        await repository.findById(fakeLocationId);

        expect(prisma.location.findUnique).toHaveBeenCalledWith({
          where: { id: fakeLocationId.toString() }
        });
      });

      it('should call LocationMapper.toDomain with the raw row', async () => {
        const rawRow = makeFakePrismaRow();
        prisma.location.findUnique.mockResolvedValue(rawRow);

        await repository.findById(fakeLocationId);

        expect(MockedLocationMapper.toDomain).toHaveBeenCalledWith(rawRow);
      });

      it('should return a successful Result containing the mapped Location', async () => {
        prisma.location.findUnique.mockResolvedValue(makeFakePrismaRow());

        const result = await repository.findById(fakeLocationId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(fakeLocation);
      });
    });

    describe('record not found', () => {
      it('should return a successful Result with null when findUnique returns null', async () => {
        prisma.location.findUnique.mockResolvedValue(null);

        const result = await repository.findById(fakeLocationId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });

      it('should not call LocationMapper.toDomain when record is not found', async () => {
        prisma.location.findUnique.mockResolvedValue(null);

        await repository.findById(fakeLocationId);

        expect(MockedLocationMapper.toDomain).not.toHaveBeenCalled();
      });
    });

    describe('mapping failure', () => {
      it('should return a failed Result when LocationMapper.toDomain fails', async () => {
        prisma.location.findUnique.mockResolvedValue(makeFakePrismaRow());
        MockedLocationMapper.toDomain.mockReturnValue(
          Result.fail('Invalid location ID: bad-uuid')
        );

        const result = await repository.findById(fakeLocationId);

        expect(result.isFailure).toBe(true);
      });

      it('should include "Failed to map location" prefix in the error', async () => {
        prisma.location.findUnique.mockResolvedValue(makeFakePrismaRow());
        MockedLocationMapper.toDomain.mockReturnValue(
          Result.fail('mapping went wrong')
        );

        const result = await repository.findById(fakeLocationId);

        expect(result.error).toContain('Failed to map location');
        expect(result.error).toContain('mapping went wrong');
      });
    });

    describe('database error', () => {
      it('should return a failed Result when Prisma throws', async () => {
        prisma.location.findUnique.mockRejectedValue(new Error('DB timeout'));

        const result = await repository.findById(fakeLocationId);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('DB timeout');
      });

      it('should prefix the error with "Database error finding location"', async () => {
        prisma.location.findUnique.mockRejectedValue(
          new Error('network failure')
        );

        const result = await repository.findById(fakeLocationId);

        expect(result.error).toContain('Database error finding location');
      });
    });
  });

  // =========================================================================
  describe('findAll()', () => {
    describe('success — returns mapped list', () => {
      it('should call prisma.location.findMany with orderBy name asc', async () => {
        prisma.location.findMany.mockResolvedValue([makeFakePrismaRow()]);

        await repository.findAll();

        expect(prisma.location.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ orderBy: { name: 'asc' } })
        );
      });

      it('should pass limit as "take" to findMany', async () => {
        prisma.location.findMany.mockResolvedValue([]);

        await repository.findAll(10);

        expect(prisma.location.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 10 })
        );
      });

      it('should pass offset as "skip" to findMany', async () => {
        prisma.location.findMany.mockResolvedValue([]);

        await repository.findAll(10, 20);

        expect(prisma.location.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 20 })
        );
      });

      it('should call findMany without take/skip when no params are given', async () => {
        prisma.location.findMany.mockResolvedValue([]);

        await repository.findAll();

        const call = prisma.location.findMany.mock.calls[0][0] as Record<
          string,
          unknown
        >;
        expect(call.take).toBeUndefined();
        expect(call.skip).toBeUndefined();
      });

      it('should return a successful Result containing an array of Locations', async () => {
        const location2 = makeFakeLocation(VALID_UUID_2);
        prisma.location.findMany.mockResolvedValue([
          makeFakePrismaRow(VALID_UUID_1),
          makeFakePrismaRow(VALID_UUID_2)
        ]);
        MockedLocationMapper.toDomain
          .mockReturnValueOnce(Result.ok(fakeLocation))
          .mockReturnValueOnce(Result.ok(location2));

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toBe(fakeLocation);
        expect(result.value[1]).toBe(location2);
      });

      it('should return a successful Result with an empty array when there are no records', async () => {
        prisma.location.findMany.mockResolvedValue([]);

        const result = await repository.findAll();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(0);
      });
    });

    describe('mapping failure mid-list', () => {
      it('should return a failed Result as soon as one record fails to map', async () => {
        prisma.location.findMany.mockResolvedValue([
          makeFakePrismaRow(VALID_UUID_1),
          makeFakePrismaRow(VALID_UUID_2)
        ]);
        MockedLocationMapper.toDomain
          .mockReturnValueOnce(Result.ok(fakeLocation))
          .mockReturnValueOnce(Result.fail('corrupt record'));

        const result = await repository.findAll();

        expect(result.isFailure).toBe(true);
      });

      it('should include "Failed to map location" prefix in the error', async () => {
        prisma.location.findMany.mockResolvedValue([makeFakePrismaRow()]);
        MockedLocationMapper.toDomain.mockReturnValue(
          Result.fail('bad data integrity')
        );

        const result = await repository.findAll();

        expect(result.error).toContain('Failed to map location');
        expect(result.error).toContain('bad data integrity');
      });
    });

    describe('database error', () => {
      it('should return a failed Result when findMany throws', async () => {
        prisma.location.findMany.mockRejectedValue(
          new Error('connection lost')
        );

        const result = await repository.findAll();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('connection lost');
      });

      it('should prefix the error with "Database error finding all locations"', async () => {
        prisma.location.findMany.mockRejectedValue(new Error('io error'));

        const result = await repository.findAll();

        expect(result.error).toContain('Database error finding all locations');
      });
    });
  });

  // =========================================================================
  describe('findByType()', () => {
    describe('success — returns filtered list', () => {
      it('should call prisma.location.findMany with the given type in the where clause', async () => {
        prisma.location.findMany.mockResolvedValue([makeFakePrismaRow()]);

        await repository.findByType(LocationType.TOWER);

        expect(prisma.location.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { type: LocationType.TOWER },
            orderBy: { name: 'asc' }
          })
        );
      });

      it('should return a successful Result with the mapped locations', async () => {
        prisma.location.findMany.mockResolvedValue([makeFakePrismaRow()]);
        MockedLocationMapper.toDomain.mockReturnValue(Result.ok(fakeLocation));

        const result = await repository.findByType(LocationType.TOWER);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toBe(fakeLocation);
      });

      it('should return a successful Result with an empty array when no matching records exist', async () => {
        prisma.location.findMany.mockResolvedValue([]);

        const result = await repository.findByType(LocationType.DATACENTER);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(0);
      });

      it('should work correctly for every LocationType value', async () => {
        const allTypes: LocationType[] = [
          LocationType.TOWER,
          LocationType.DATACENTER,
          LocationType.POINT_OF_PRESENCE,
          LocationType.OFFICE,
          LocationType.CUSTOMER_PREMISES,
          LocationType.OTHER
        ];

        for (const type of allTypes) {
          jest.clearAllMocks();
          prisma.location.findMany.mockResolvedValue([]);

          const result = await repository.findByType(type);

          expect(result.isSuccess).toBe(true);
          expect(prisma.location.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { type } })
          );
        }
      });
    });

    describe('mapping failure', () => {
      it('should return a failed Result when LocationMapper.toDomain fails for any record', async () => {
        prisma.location.findMany.mockResolvedValue([makeFakePrismaRow()]);
        MockedLocationMapper.toDomain.mockReturnValue(
          Result.fail('corrupt type record')
        );

        const result = await repository.findByType(LocationType.TOWER);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Failed to map location');
        expect(result.error).toContain('corrupt type record');
      });
    });

    describe('database error', () => {
      it('should return a failed Result when findMany throws', async () => {
        prisma.location.findMany.mockRejectedValue(
          new Error('query timeout')
        );

        const result = await repository.findByType(LocationType.OFFICE);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('query timeout');
      });

      it('should prefix the error with "Database error finding locations by type"', async () => {
        prisma.location.findMany.mockRejectedValue(new Error('io error'));

        const result = await repository.findByType(LocationType.OTHER);

        expect(result.error).toContain(
          'Database error finding locations by type'
        );
      });
    });
  });

  // =========================================================================
  describe('delete()', () => {
    describe('success', () => {
      it('should call prisma.location.delete with the stringified id', async () => {
        prisma.location.delete.mockResolvedValue(makeFakePrismaRow());

        await repository.delete(fakeLocationId);

        expect(prisma.location.delete).toHaveBeenCalledWith({
          where: { id: fakeLocationId.toString() }
        });
      });

      it('should return a successful Result<void>', async () => {
        prisma.location.delete.mockResolvedValue(makeFakePrismaRow());

        const result = await repository.delete(fakeLocationId);

        expect(result.isSuccess).toBe(true);
      });
    });

    describe('P2025 — record not found', () => {
      it('should return a failed Result when Prisma throws a P2025 error', async () => {
        prisma.location.delete.mockRejectedValue(
          new Error('Record to delete does not exist P2025')
        );

        const result = await repository.delete(fakeLocationId);

        expect(result.isFailure).toBe(true);
      });

      it('should return the message "Location not found" for P2025 errors', async () => {
        prisma.location.delete.mockRejectedValue(
          new Error('P2025: Record not found')
        );

        const result = await repository.delete(fakeLocationId);

        expect(result.error).toBe('Location not found');
      });
    });

    describe('generic database error', () => {
      it('should return a failed Result for any other Prisma error', async () => {
        prisma.location.delete.mockRejectedValue(
          new Error('foreign key constraint violation')
        );

        const result = await repository.delete(fakeLocationId);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('foreign key constraint violation');
      });

      it('should prefix the error with "Database error deleting location"', async () => {
        prisma.location.delete.mockRejectedValue(new Error('disk full'));

        const result = await repository.delete(fakeLocationId);

        expect(result.error).toContain('Database error deleting location');
      });
    });
  });

  // =========================================================================
  describe('exists()', () => {
    describe('record exists', () => {
      it('should call prisma.location.count with the stringified id', async () => {
        prisma.location.count.mockResolvedValue(1);

        await repository.exists(fakeLocationId);

        expect(prisma.location.count).toHaveBeenCalledWith({
          where: { id: fakeLocationId.toString() }
        });
      });

      it('should return a successful Result with true when count > 0', async () => {
        prisma.location.count.mockResolvedValue(1);

        const result = await repository.exists(fakeLocationId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(true);
      });
    });

    describe('record does not exist', () => {
      it('should return a successful Result with false when count === 0', async () => {
        prisma.location.count.mockResolvedValue(0);

        const result = await repository.exists(fakeLocationId);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(false);
      });
    });

    describe('database error', () => {
      it('should return a failed Result when prisma.location.count throws', async () => {
        prisma.location.count.mockRejectedValue(
          new Error('connection pool exhausted')
        );

        const result = await repository.exists(fakeLocationId);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('connection pool exhausted');
      });

      it('should prefix the error with "Database error checking location existence"', async () => {
        prisma.location.count.mockRejectedValue(new Error('socket hang up'));

        const result = await repository.exists(fakeLocationId);

        expect(result.error).toContain(
          'Database error checking location existence'
        );
      });
    });
  });

  // =========================================================================
  describe('count()', () => {
    describe('success', () => {
      it('should call prisma.location.count with no where-clause arguments', async () => {
        prisma.location.count.mockResolvedValue(42);

        await repository.count();

        expect(prisma.location.count).toHaveBeenCalledWith();
      });

      it('should return a successful Result containing the count number', async () => {
        prisma.location.count.mockResolvedValue(42);

        const result = await repository.count();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(42);
      });

      it('should return zero when there are no locations', async () => {
        prisma.location.count.mockResolvedValue(0);

        const result = await repository.count();

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });
    });

    describe('database error', () => {
      it('should return a failed Result when prisma.location.count throws', async () => {
        prisma.location.count.mockRejectedValue(
          new Error('replica unavailable')
        );

        const result = await repository.count();

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('replica unavailable');
      });

      it('should prefix the error with "Database error counting locations"', async () => {
        prisma.location.count.mockRejectedValue(new Error('timeout'));

        const result = await repository.count();

        expect(result.error).toContain('Database error counting locations');
      });
    });
  });
});
