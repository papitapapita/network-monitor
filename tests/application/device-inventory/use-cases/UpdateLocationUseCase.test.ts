// Source: src/application/device-inventory/use-cases/UpdateLocationUseCase.ts

import { UpdateLocationUseCase } from '../../../../src/application/device-inventory/use-cases';
import { ILocationRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Location } from '../../../../src/domain/device-inventory/aggregates';
import {
  Address,
  Coordinates,
  LocationType
} from '../../../../src/domain/device-inventory/value-objects';
import { LocationId } from '../../../../src/domain/shared/ids';
import { UpdateLocationRequestDTO } from '../../../../src/application/device-inventory/dtos';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_LOCATION_ID = '550e8400-e29b-41d4-a716-446655440000';
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

function makeRepo(): jest.Mocked<ILocationRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByType: jest.fn(),
    findAllWithCoordinates: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn()
  };
}

/**
 * Builds a Location reconstituted from persistence with sensible defaults.
 */
function makePersistedLocation(
  overrides: {
    name?: string;
    type?: string;
    municipality?: string | null;
    neighborhood?: string | null;
    address?: string | null;
    coordinates?: Coordinates | null;
  } = {}
): Location {
  const id = LocationId.parse(VALID_LOCATION_ID).value;
  const street = overrides.address ?? 'Carrera 80 # 75-32';
  const municipality = overrides.municipality ?? 'Medellín';
  const neighborhood = overrides.neighborhood ?? 'Robledo';
  const addressVO =
    street === null || municipality === null || neighborhood === null
      ? null
      : Address.reconstitute({ street, municipality, neighborhood });

  return Location.reconstitute(id, {
    name: overrides.name ?? 'Torre Norte',
    type: LocationType.reconstitute(
      overrides.type ?? LocationType.TOWER
    ),
    address: addressVO,
    coordinates: overrides.hasOwnProperty('coordinates')
      ? overrides.coordinates
      : null,
    createdAt: NOW,
    updatedAt: NOW
  });
}

/** Minimal valid request DTO — only the required `id` field. */
function makeRequest(
  overrides: Partial<UpdateLocationRequestDTO> = {}
): UpdateLocationRequestDTO {
  return { id: VALID_LOCATION_ID, ...overrides };
}

// ---------------------------------------------------------------------------

describe('UpdateLocationUseCase', () => {
  let repo: jest.Mocked<ILocationRepository>;
  let logger: ILogger;
  let useCase: UpdateLocationUseCase;

  beforeEach(() => {
    repo = makeRepo();
    logger = makeLogger();
    useCase = new UpdateLocationUseCase(repo, logger);

    // Default happy-path mocks
    repo.findById.mockResolvedValue(
      Result.ok(makePersistedLocation())
    );
    repo.save.mockImplementation(async (location) =>
      Result.ok(location)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('[DEV-091] [DEV-092] beforeExecute — validation', () => {
    it('should fail when id is an empty string', async () => {
      const result = await useCase.execute(makeRequest({ id: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Location ID is required');
    });

    it('should fail when id is whitespace only', async () => {
      const result = await useCase.execute(
        makeRequest({ id: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Location ID is required');
    });

    it('should fail when type is an invalid value', async () => {
      const result = await useCase.execute(
        makeRequest({ type: 'INVALID_TYPE' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('INVALID_TYPE');
    });

    it('should pass when type is a valid value (case-insensitive)', async () => {
      const result = await useCase.execute(
        makeRequest({ type: 'tower' })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when only latitude is provided (longitude missing)', async () => {
      const result = await useCase.execute(
        makeRequest({ latitude: 6.2442 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('latitude');
      expect(result.error).toContain('longitude');
    });

    it('should fail when only longitude is provided (latitude missing)', async () => {
      const result = await useCase.execute(
        makeRequest({ longitude: -75.5812 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('latitude');
      expect(result.error).toContain('longitude');
    });

    it('should pass when both latitude and longitude are provided', async () => {
      const result = await useCase.execute(
        makeRequest({ latitude: 6.2442, longitude: -75.5812 })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should pass when neither latitude nor longitude is provided', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
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
      expect(result.error).toContain('Invalid location ID');
    });

    it('should fail when location is not found (findById returns null)', async () => {
      repo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Location not found');
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
  describe('[DEV-090] executeImpl — name update', () => {
    it('should succeed when name is provided', async () => {
      const result = await useCase.execute(
        makeRequest({ name: 'Torre Sur' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.name).toBe('Torre Sur');
    });

    it('should fail when name exceeds 150 characters', async () => {
      const longName = 'A'.repeat(151);

      const result = await useCase.execute(
        makeRequest({ name: longName })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should not change name when name is undefined', async () => {
      const result = await useCase.execute(
        makeRequest({ name: undefined })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.name).toBe('Torre Norte');
    });
  });

  // =========================================================================
  describe('[DEV-091] executeImpl — type update', () => {
    it('should succeed when type is provided and valid', async () => {
      const result = await useCase.execute(
        makeRequest({ type: 'DATACENTER' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.type).toBe('DATACENTER');
    });

    it('should not change type when type is undefined', async () => {
      const result = await useCase.execute(
        makeRequest({ type: undefined })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.type).toBe(LocationType.TOWER);
    });
  });

  // =========================================================================
  describe('[DEV-094] executeImpl — address fields', () => {
    it('should succeed when municipality is updated', async () => {
      const result = await useCase.execute(
        makeRequest({ municipality: 'Bogotá' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.municipality).toBe('Bogotá');
    });

    it('should succeed when neighborhood is updated', async () => {
      const result = await useCase.execute(
        makeRequest({ neighborhood: 'Chapinero' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.neighborhood).toBe('Chapinero');
    });

    it('should succeed when address is updated', async () => {
      const result = await useCase.execute(
        makeRequest({ address: 'Calle 72 # 10-07' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.address).toBe('Calle 72 # 10-07');
    });

    it('should succeed when all three address fields are updated together', async () => {
      const result = await useCase.execute(
        makeRequest({
          municipality: 'Cali',
          neighborhood: 'Granada',
          address: 'Av. 6N # 25-41'
        })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.municipality).toBe('Cali');
      expect(result.value!.neighborhood).toBe('Granada');
      expect(result.value!.address).toBe('Av. 6N # 25-41');
    });

    it('should fail when municipality is cleared in isolation (address must be complete or absent)', async () => {
      const result = await useCase.execute(
        makeRequest({ municipality: null })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should succeed when all address fields are cleared to null together', async () => {
      const result = await useCase.execute(
        makeRequest({
          address: null,
          municipality: null,
          neighborhood: null
        })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.municipality).toBeNull();
      expect(result.value!.neighborhood).toBeNull();
      expect(result.value!.address).toBeNull();
    });

    it('should not call updateAddressFields when no address field is provided', async () => {
      // Only name is updated — no address fields in the request
      const result = await useCase.execute(
        makeRequest({ name: 'New Name Only' })
      );

      expect(result.isSuccess).toBe(true);
      // Address fields remain at their default values from makePersistedLocation()
      expect(result.value!.municipality).toBe('Medellín');
    });
  });

  // =========================================================================
  describe('[DEV-093] executeImpl — coordinates update', () => {
    it('should succeed when both lat and lon are provided', async () => {
      const result = await useCase.execute(
        makeRequest({ latitude: 6.2442, longitude: -75.5812 })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.latitude).toBe(6.2442);
      expect(result.value!.longitude).toBe(-75.5812);
    });

    it('should succeed when both lat and lon are null (clear coordinates)', async () => {
      repo.findById.mockResolvedValue(
        Result.ok(
          makePersistedLocation({
            coordinates: Coordinates.reconstitute({
              latitude: 6.2442,
              longitude: -75.5812
            })
          })
        )
      );

      const result = await useCase.execute(
        makeRequest({ latitude: null, longitude: null })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.latitude).toBeNull();
      expect(result.value!.longitude).toBeNull();
    });

    it('should succeed when altitude is provided alongside lat and lon', async () => {
      const result = await useCase.execute(
        makeRequest({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: 1540
        })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.altitude).toBe(1540);
    });

    it('should fail when invalid coordinates are provided (out-of-range latitude)', async () => {
      const result = await useCase.execute(
        makeRequest({ latitude: 999, longitude: -75.5812 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid coordinates');
    });

    it('should fail when invalid coordinates are provided (out-of-range longitude)', async () => {
      const result = await useCase.execute(
        makeRequest({ latitude: 6.2442, longitude: 999 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid coordinates');
    });

    it('should not update coordinates when neither lat nor lon is provided', async () => {
      // Location starts with no coordinates; they should remain null after update
      const result = await useCase.execute(
        makeRequest({ name: 'Name Only Update' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.latitude).toBeNull();
      expect(result.value!.longitude).toBeNull();
    });
  });

  // =========================================================================
  describe('executeImpl — repository save', () => {
    it('should fail when save returns a failure Result', async () => {
      repo.save.mockResolvedValue(Result.fail('DB write error'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DB write error');
    });

    it('should call repo.save exactly once on success', async () => {
      await useCase.execute(makeRequest());

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('should pass a Location instance to repo.save', async () => {
      await useCase.execute(makeRequest());

      const savedArg = repo.save.mock.calls[0][0];
      expect(savedArg).toBeInstanceOf(Location);
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should return a LocationResponseDTO with the correct id', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.id).toBe(VALID_LOCATION_ID);
    });

    it('should return the updated name when name was changed', async () => {
      const result = await useCase.execute(
        makeRequest({ name: 'Torre Central' })
      );

      expect(result.value!.name).toBe('Torre Central');
    });

    it('should return the updated type when type was changed', async () => {
      const result = await useCase.execute(
        makeRequest({ type: 'OFFICE' })
      );

      expect(result.value!.type).toBe('OFFICE');
    });

    it('should return createdAt as an ISO 8601 string', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.createdAt).toBe(
        '2024-06-01T00:00:00.000Z'
      );
    });

    it('should return null latitude and longitude when location has no coordinates', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.value!.latitude).toBeNull();
      expect(result.value!.longitude).toBeNull();
    });
  });
});
