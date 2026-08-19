// Source: src/application/device-inventory/use-cases/CreateLocationUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { CreateLocationUseCase } from '../../../../src/application/device-inventory/use-cases/CreateLocationUseCase';
import { ILocationRepository } from '../../../../src/domain/device-inventory/repository/ILocationRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { CreateLocationRequestDTO } from '../../../../src/application/device-inventory/dtos/CreateLocationRequestDTO';
import { Location } from '../../../../src/domain/device-inventory/aggregates/Location';
import { LocationId } from '../../../../src/domain/shared/ids';
import {
  Address,
  Coordinates,
  LocationType
} from '../../../../src/domain/device-inventory/value-objects';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makePersistedLocation(
  overrides: {
    name?: string;
    type?: string;
    coordinates?: Coordinates | null;
  } = {}
): Location {
  const id = LocationId.parse(VALID_UUID).value;
  return Location.reconstitute(id, {
    name: overrides.name ?? 'Torre Norte',
    type: LocationType.reconstitute(
      overrides.type ?? LocationType.TOWER
    ),
    address: Address.reconstitute({
      street: 'Carrera 80 # 75-32',
      municipality: 'Medellín',
      neighborhood: 'Robledo'
    }),
    coordinates:
      overrides.coordinates !== undefined
        ? overrides.coordinates
        : null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

function makeMinimalDTO(
  overrides: Partial<CreateLocationRequestDTO> = {}
): CreateLocationRequestDTO {
  return {
    name: 'Torre Norte',
    type: 'TOWER',
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('CreateLocationUseCase', () => {
  let useCase: CreateLocationUseCase;
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

    useCase = new CreateLocationUseCase(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — input validation', () => {
    // -----------------------------------------------------------------------
    describe('[DEV-099] name validation', () => {
      it('should fail when name is an empty string', async () => {
        const result = await useCase.execute(
          makeMinimalDTO({ name: '' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is only whitespace', async () => {
        const result = await useCase.execute(
          makeMinimalDTO({ name: '   ' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should not call repository.save when name is empty', async () => {
        await useCase.execute(makeMinimalDTO({ name: '' }));

        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-091] type validation', () => {
      it('[DEV-099] should fail when type is an empty string', async () => {
        const result = await useCase.execute(
          makeMinimalDTO({ type: '' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('type');
      });

      it('should fail when type is not a valid LocationType value', async () => {
        const result = await useCase.execute(
          makeMinimalDTO({ type: 'INVALID_TYPE' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('INVALID_TYPE');
      });

      it('should accept a lowercase valid type string (case-insensitive)', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute(
          makeMinimalDTO({ type: 'tower' })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should accept all valid LocationType values', async () => {
        const validTypes = [
          LocationType.TOWER,
          LocationType.DATACENTER,
          LocationType.POINT_OF_PRESENCE,
          LocationType.OFFICE,
          LocationType.CUSTOMER_PREMISES,
          LocationType.OTHER
        ];

        for (const type of validTypes) {
          mockRepository.save.mockResolvedValue(
            Result.ok(makePersistedLocation({ type }))
          );

          const dto =
            type === LocationType.CUSTOMER_PREMISES
              ? makeMinimalDTO({
                  type,
                  address: 'Carrera 80 # 75-32',
                  municipality: 'Medellín',
                  neighborhood: 'Robledo'
                })
              : makeMinimalDTO({ type });

          const result = await useCase.execute(dto);

          expect(result.isSuccess).toBe(true);
        }
      });

      it('should not call repository.save when type is invalid', async () => {
        await useCase.execute(
          makeMinimalDTO({ type: 'INVALID_TYPE' })
        );

        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-092] coordinates coherence validation', () => {
      it('should fail when only latitude is provided', async () => {
        const result = await useCase.execute(
          makeMinimalDTO({ latitude: -23.561684 })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should fail when only longitude is provided', async () => {
        const result = await useCase.execute(
          makeMinimalDTO({ longitude: -46.655981 })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should pass when both latitude and longitude are provided', async () => {
        const coords = Coordinates.reconstitute({
          latitude: -23.561684,
          longitude: -46.655981
        });
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: coords }))
        );

        const result = await useCase.execute(
          makeMinimalDTO({
            latitude: -23.561684,
            longitude: -46.655981
          })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should pass when neither latitude nor longitude is provided', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute(makeMinimalDTO());

        expect(result.isSuccess).toBe(true);
      });

      it('should not call repository.save when only one coordinate is provided', async () => {
        await useCase.execute(
          makeMinimalDTO({ latitude: -23.561684 })
        );

        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  describe('executeImpl — successful creation', () => {
    // -----------------------------------------------------------------------
    describe('repository interaction', () => {
      it('should call repository.save exactly once', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        await useCase.execute(makeMinimalDTO());

        expect(mockRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should pass a Location instance to repository.save', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        await useCase.execute(makeMinimalDTO());

        const savedArg = (
          mockRepository.save as jest.MockedFunction<
            typeof mockRepository.save
          >
        ).mock.calls[0][0];
        expect(savedArg).toBeInstanceOf(Location);
      });

      it('should pass a Location with the trimmed name to repository.save', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation({ name: 'Torre Norte' }))
        );

        await useCase.execute(
          makeMinimalDTO({ name: '  Torre Norte  ' })
        );

        const savedArg = (
          mockRepository.save as jest.MockedFunction<
            typeof mockRepository.save
          >
        ).mock.calls[0][0];
        expect(savedArg.name).toBe('Torre Norte');
      });
    });

    // -----------------------------------------------------------------------
    describe('response DTO fields', () => {
      it('should return isSuccess true on successful creation', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute(makeMinimalDTO());

        expect(result.isSuccess).toBe(true);
      });

      it('should return the id from the persisted location aggregate', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute(makeMinimalDTO());

        expect(result.value.id).toBe(VALID_UUID);
      });

      it('should return the name from the persisted location aggregate', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation({ name: 'Torre Norte' }))
        );

        const result = await useCase.execute(
          makeMinimalDTO({ name: 'Torre Norte' })
        );

        expect(result.value.name).toBe('Torre Norte');
      });

      it('should return the type as a string in the response DTO', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(
            makePersistedLocation({ type: LocationType.DATACENTER })
          )
        );

        const result = await useCase.execute(
          makeMinimalDTO({ type: 'DATACENTER' })
        );

        expect(result.value.type).toBe('DATACENTER');
      });

      it('should return createdAt as an ISO 8601 string', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute(makeMinimalDTO());

        expect(result.value.createdAt).toBe(
          '2024-01-01T00:00:00.000Z'
        );
      });

      it('should return updatedAt as an ISO 8601 string', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation())
        );

        const result = await useCase.execute(makeMinimalDTO());

        expect(result.value.updatedAt).toBe(
          '2024-01-01T00:00:00.000Z'
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-093] coordinates in response DTO', () => {
      it('should return null latitude when no coordinates are provided', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: null }))
        );

        const result = await useCase.execute(makeMinimalDTO());

        expect(result.value.latitude).toBeNull();
      });

      it('should return null longitude when no coordinates are provided', async () => {
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: null }))
        );

        const result = await useCase.execute(makeMinimalDTO());

        expect(result.value.longitude).toBeNull();
      });

      it('should return flattened latitude when coordinates are provided', async () => {
        const coords = Coordinates.reconstitute({
          latitude: 6.2442,
          longitude: -75.5812
        });
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: coords }))
        );

        const result = await useCase.execute(
          makeMinimalDTO({ latitude: 6.2442, longitude: -75.5812 })
        );

        expect(result.value.latitude).toBe(6.2442);
      });

      it('should return flattened longitude when coordinates are provided', async () => {
        const coords = Coordinates.reconstitute({
          latitude: 6.2442,
          longitude: -75.5812
        });
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: coords }))
        );

        const result = await useCase.execute(
          makeMinimalDTO({ latitude: 6.2442, longitude: -75.5812 })
        );

        expect(result.value.longitude).toBe(-75.5812);
      });

      it('should return altitude when all three coordinate fields are provided', async () => {
        const coords = Coordinates.reconstitute({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: 1540
        });
        mockRepository.save.mockResolvedValue(
          Result.ok(makePersistedLocation({ coordinates: coords }))
        );

        const result = await useCase.execute(
          makeMinimalDTO({
            latitude: 6.2442,
            longitude: -75.5812,
            altitude: 1540
          })
        );

        expect(result.value.altitude).toBe(1540);
      });
    });
  });

  // =========================================================================
  describe('executeImpl — failure paths', () => {
    it('should return failure when repository.save returns a failure Result', async () => {
      mockRepository.save.mockResolvedValue(
        Result.fail('DB connection error')
      );

      const result = await useCase.execute(makeMinimalDTO());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB connection error');
    });

    it('[DEV-090] should return failure when name exceeds 150 characters', async () => {
      const longName = 'A'.repeat(151);

      const result = await useCase.execute(
        makeMinimalDTO({ name: longName })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should return failure when Coordinates.create fails due to out-of-range latitude', async () => {
      const result = await useCase.execute(
        makeMinimalDTO({ latitude: 999, longitude: -46.655981 })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should return failure when Coordinates.create fails due to out-of-range longitude', async () => {
      const result = await useCase.execute(
        makeMinimalDTO({ latitude: -23.561684, longitude: 999 })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should not call repository.save when Coordinates.create fails', async () => {
      await useCase.execute(
        makeMinimalDTO({ latitude: 999, longitude: -46.655981 })
      );

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should not call repository.save when Location.create fails', async () => {
      const longName = 'A'.repeat(151);
      await useCase.execute(makeMinimalDTO({ name: longName }));

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });
});
