// Source: src/application/device-inventory/use-cases/GetLocationUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { GetLocationUseCase } from '../../../../src/application/device-inventory/use-cases/GetLocationUseCase';
import { ILocationRepository } from '../../../../src/domain/device-inventory/repository/ILocationRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Location } from '../../../../src/domain/device-inventory/aggregates/Location';
import { LocationId } from '../../../../src/domain/shared/ids';
import { LocationType } from '../../../../src/domain/device-inventory/enums/LocationType';
import { Coordinates } from '../../../../src/domain/device-inventory/value-objects';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makePersistedLocation(
  overrides: {
    id?: string;
    name?: string;
    type?: LocationType;
    coordinates?: Coordinates | null;
  } = {}
): Location {
  const idStr = overrides.id ?? VALID_UUID;
  const id = LocationId.parse(idStr).value;
  return Location.reconstitute(id, {
    name: overrides.name ?? 'Torre Norte',
    type: overrides.type ?? LocationType.TOWER,
    municipality: 'Medellín',
    neighborhood: 'Robledo',
    address: 'Carrera 80 # 75-32',
    coordinates:
      overrides.coordinates !== undefined
        ? overrides.coordinates
        : null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

// ---------------------------------------------------------------------------

describe('GetLocationUseCase', () => {
  let useCase: GetLocationUseCase;
  let mockRepository: jest.Mocked<ILocationRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
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

    useCase = new GetLocationUseCase(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — input validation', () => {
    // -----------------------------------------------------------------------
    describe('id validation', () => {
      it('should fail when id is an empty string', async () => {
        const result = await useCase.execute({ id: '' });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ID');
      });

      it('should fail when id is only whitespace', async () => {
        const result = await useCase.execute({ id: '   ' });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ID');
      });

      it('should not call repository.findById when id is empty', async () => {
        await useCase.execute({ id: '' });

        expect(mockRepository.findById).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  describe('executeImpl — successful retrieval', () => {
    // -----------------------------------------------------------------------
    describe('repository interaction', () => {
      it('should call repository.findById exactly once', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        await useCase.execute({ id: VALID_UUID });

        expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      });

      it('should call repository.findById with a LocationId matching the request id', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        await useCase.execute({ id: VALID_UUID });

        const calledWithId = (
          mockRepository.findById as jest.MockedFunction<
            typeof mockRepository.findById
          >
        ).mock.calls[0][0];
        expect(calledWithId.toString()).toBe(VALID_UUID);
      });

      it('should trim whitespace from the id before calling the repository', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        await useCase.execute({ id: `  ${VALID_UUID}  ` });

        const calledWithId = (
          mockRepository.findById as jest.MockedFunction<
            typeof mockRepository.findById
          >
        ).mock.calls[0][0];
        expect(calledWithId.toString()).toBe(VALID_UUID);
      });
    });

    // -----------------------------------------------------------------------
    describe('response DTO fields', () => {
      it('should return isSuccess true when the location is found', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.isSuccess).toBe(true);
      });

      it('should return the id from the location aggregate', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.id).toBe(VALID_UUID);
      });

      it('should return the name from the location aggregate', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation({ name: 'POP Site Beta' }))
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.name).toBe('POP Site Beta');
      });

      it('should return the type as a string from the location aggregate', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(
            makePersistedLocation({ type: LocationType.DATACENTER })
          )
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.type).toBe('DATACENTER');
      });

      it('should return createdAt as an ISO 8601 string', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.createdAt).toBe(
          '2024-01-01T00:00:00.000Z'
        );
      });

      it('should return updatedAt as an ISO 8601 string', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.updatedAt).toBe(
          '2024-01-01T00:00:00.000Z'
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('coordinates in response DTO', () => {
      it('should return null latitude when the location has no coordinates', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: null }))
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.latitude).toBeNull();
      });

      it('should return flattened latitude when the location has coordinates', async () => {
        const coords = Coordinates.reconstitute({
          latitude: 6.2442,
          longitude: -75.5812
        });
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: coords }))
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.latitude).toBe(6.2442);
      });

      it('should return flattened longitude when the location has coordinates', async () => {
        const coords = Coordinates.reconstitute({
          latitude: 6.2442,
          longitude: -75.5812
        });
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: coords }))
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.longitude).toBe(-75.5812);
      });

      it('should return altitude when the location has coordinates with altitude', async () => {
        const coords = Coordinates.reconstitute({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: 1540
        });
        mockRepository.findById.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: coords }))
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.altitude).toBe(1540);
      });
    });
  });

  // =========================================================================
  describe('executeImpl — failure paths', () => {
    // -----------------------------------------------------------------------
    describe('invalid id format', () => {
      it('should return failure when id is not a valid UUID/ULID', async () => {
        const result = await useCase.execute({
          id: 'not-a-valid-id'
        });

        expect(result.isFailure).toBe(true);
      });

      it('should not call repository.findById when the id format is invalid', async () => {
        await useCase.execute({ id: 'not-a-valid-id' });

        expect(mockRepository.findById).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('location not found', () => {
      it('should return failure when repository.findById returns null', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.isFailure).toBe(true);
      });

      it('should include the requested id in the error message when not found', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.error).toContain(VALID_UUID);
      });
    });

    // -----------------------------------------------------------------------
    describe('repository failure', () => {
      it('should return failure when repository.findById returns a failure Result', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.fail('DB timeout')
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('DB timeout');
      });
    });
  });
});
