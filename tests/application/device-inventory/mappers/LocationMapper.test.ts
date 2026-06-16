// Source: src/application/device-inventory/mappers/LocationMapper.ts

import { describe, it, expect } from '@jest/globals';
import { LocationMapper } from '../../../../src/application/device-inventory/mappers/LocationMapper';
import { Location }       from '../../../../src/domain/device-inventory/aggregates/Location';
import { LocationId }     from '../../../../src/domain/shared/ids';
import { LocationType }   from '../../../../src/domain/device-inventory/enums';
import { Coordinates }    from '../../../../src/domain/device-inventory/value-objects';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID   = '550e8400-e29b-41d4-a716-446655440000';
const BASE_DATE    = new Date('2024-01-01T00:00:00.000Z');
const UPDATED_DATE = new Date('2024-06-15T12:00:00.000Z');

function makeLocationDomain(overrides: {
  name?:         string;
  type?:         LocationType;
  municipality?: string | null;
  neighborhood?: string | null;
  address?:      string | null;
  coordinates?:  Coordinates | null;
} = {}): Location {
  const id = LocationId.parse(VALID_UUID).value;
  return Location.reconstitute(id, {
    name:         overrides.name         ?? 'Torre Norte',
    type:         overrides.type         ?? LocationType.TOWER,
    municipality: overrides.municipality !== undefined ? overrides.municipality : 'Medellín',
    neighborhood: overrides.neighborhood !== undefined ? overrides.neighborhood : 'Robledo',
    address:      overrides.address      !== undefined ? overrides.address      : 'Carrera 80 # 75-32',
    coordinates:  overrides.coordinates  !== undefined ? overrides.coordinates  : null,
    createdAt:    BASE_DATE,
    updatedAt:    UPDATED_DATE
  });
}

function makeCoordinates(lat: number, lon: number, alt?: number): Coordinates {
  return Coordinates.reconstitute({ latitude: lat, longitude: lon, altitude: alt });
}

// ---------------------------------------------------------------------------

describe('LocationMapper (application layer)', () => {
  // =========================================================================
  describe('toDTO()', () => {
    // -----------------------------------------------------------------------
    describe('id mapping', () => {
      it('should extract the id as a string from the LocationId value object', () => {
        const location = makeLocationDomain();

        const dto = LocationMapper.toDTO(location);

        expect(dto.id).toBe(VALID_UUID);
      });
    });

    // -----------------------------------------------------------------------
    describe('primitive fields', () => {
      it('should map the name field', () => {
        const location = makeLocationDomain({ name: 'POP Site Alpha' });

        const dto = LocationMapper.toDTO(location);

        expect(dto.name).toBe('POP Site Alpha');
      });

      it('should map the type as a string', () => {
        const location = makeLocationDomain({ type: LocationType.DATACENTER });

        const dto = LocationMapper.toDTO(location);

        expect(dto.type).toBe('DATACENTER');
      });
    });

    // -----------------------------------------------------------------------
    describe('LocationType string representation', () => {
      const typeMatrix: Array<[LocationType, string]> = [
        [LocationType.TOWER,              'TOWER'],
        [LocationType.DATACENTER,         'DATACENTER'],
        [LocationType.POINT_OF_PRESENCE,  'POINT_OF_PRESENCE'],
        [LocationType.OFFICE,             'OFFICE'],
        [LocationType.CUSTOMER_PREMISES,  'CUSTOMER_PREMISES'],
        [LocationType.OTHER,              'OTHER']
      ];

      for (const [domainType, expectedString] of typeMatrix) {
        it(`should map LocationType.${domainType} to the string "${expectedString}"`, () => {
          const location = makeLocationDomain({ type: domainType });

          const dto = LocationMapper.toDTO(location);

          expect(dto.type).toBe(expectedString);
        });
      }
    });

    // -----------------------------------------------------------------------
    describe('address fields', () => {
      it('should map municipality when set', () => {
        const location = makeLocationDomain({ municipality: 'Bogotá' });

        const dto = LocationMapper.toDTO(location);

        expect(dto.municipality).toBe('Bogotá');
      });

      it('should map municipality as null when the location has no municipality', () => {
        const location = makeLocationDomain({ municipality: null });

        const dto = LocationMapper.toDTO(location);

        expect(dto.municipality).toBeNull();
      });

      it('should map neighborhood when set', () => {
        const location = makeLocationDomain({ neighborhood: 'Chapinero' });

        const dto = LocationMapper.toDTO(location);

        expect(dto.neighborhood).toBe('Chapinero');
      });

      it('should map neighborhood as null when the location has no neighborhood', () => {
        const location = makeLocationDomain({ neighborhood: null });

        const dto = LocationMapper.toDTO(location);

        expect(dto.neighborhood).toBeNull();
      });

      it('should map address when set', () => {
        const location = makeLocationDomain({ address: 'Calle 26 # 69-76' });

        const dto = LocationMapper.toDTO(location);

        expect(dto.address).toBe('Calle 26 # 69-76');
      });

      it('should map address as null when the location has no address', () => {
        const location = makeLocationDomain({ address: null });

        const dto = LocationMapper.toDTO(location);

        expect(dto.address).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('coordinates — null when coordinates is null', () => {
      it('should set latitude to null when coordinates is null', () => {
        const location = makeLocationDomain({ coordinates: null });

        const dto = LocationMapper.toDTO(location);

        expect(dto.latitude).toBeNull();
      });

      it('should set longitude to null when coordinates is null', () => {
        const location = makeLocationDomain({ coordinates: null });

        const dto = LocationMapper.toDTO(location);

        expect(dto.longitude).toBeNull();
      });

      it('should set altitude to null when coordinates is null', () => {
        const location = makeLocationDomain({ coordinates: null });

        const dto = LocationMapper.toDTO(location);

        expect(dto.altitude).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('coordinates — present without altitude', () => {
      it('should flatten latitude from the Coordinates value object', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812)
        });

        const dto = LocationMapper.toDTO(location);

        expect(dto.latitude).toBe(6.2442);
      });

      it('should flatten longitude from the Coordinates value object', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812)
        });

        const dto = LocationMapper.toDTO(location);

        expect(dto.longitude).toBe(-75.5812);
      });

      it('should set altitude to null when coordinates has no altitude', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812)
        });

        const dto = LocationMapper.toDTO(location);

        expect(dto.altitude).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('coordinates — present with altitude', () => {
      it('should flatten latitude from the Coordinates value object', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812, 1540)
        });

        const dto = LocationMapper.toDTO(location);

        expect(dto.latitude).toBe(6.2442);
      });

      it('should flatten longitude from the Coordinates value object', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812, 1540)
        });

        const dto = LocationMapper.toDTO(location);

        expect(dto.longitude).toBe(-75.5812);
      });

      it('should flatten altitude from the Coordinates value object', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812, 1540)
        });

        const dto = LocationMapper.toDTO(location);

        expect(dto.altitude).toBe(1540);
      });

      it('should handle negative altitude (below sea level)', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(31.2304, 121.4737, -5)
        });

        const dto = LocationMapper.toDTO(location);

        expect(dto.altitude).toBe(-5);
      });
    });

    // -----------------------------------------------------------------------
    describe('timestamp fields', () => {
      it('should convert createdAt to an ISO 8601 string', () => {
        const location = makeLocationDomain();

        const dto = LocationMapper.toDTO(location);

        expect(dto.createdAt).toBe('2024-01-01T00:00:00.000Z');
      });

      it('should convert updatedAt to an ISO 8601 string', () => {
        const location = makeLocationDomain();

        const dto = LocationMapper.toDTO(location);

        expect(dto.updatedAt).toBe('2024-06-15T12:00:00.000Z');
      });

      it('should produce a createdAt value that round-trips through Date.parse', () => {
        const location = makeLocationDomain();

        const dto = LocationMapper.toDTO(location);

        expect(new Date(dto.createdAt).toISOString()).toBe(dto.createdAt);
      });

      it('should produce an updatedAt value that round-trips through Date.parse', () => {
        const location = makeLocationDomain();

        const dto = LocationMapper.toDTO(location);

        expect(new Date(dto.updatedAt).toISOString()).toBe(dto.updatedAt);
      });
    });
  });

  // =========================================================================
  describe('toListDTO()', () => {
    // -----------------------------------------------------------------------
    describe('locations array', () => {
      it('should map each location in the input array using toDTO', () => {
        const locations = [
          makeLocationDomain({ name: 'Site A' }),
          makeLocationDomain({ name: 'Site B' })
        ];

        const result = LocationMapper.toListDTO(locations, 10, 20, 0);

        expect(result.locations).toHaveLength(2);
      });

      it('should preserve the name of the first location', () => {
        const locations = [makeLocationDomain({ name: 'Site A' })];

        const result = LocationMapper.toListDTO(locations, 5, 20, 0);

        expect(result.locations[0].name).toBe('Site A');
      });

      it('should preserve the name of the second location', () => {
        const locations = [
          makeLocationDomain({ name: 'Site A' }),
          makeLocationDomain({ name: 'Site B' })
        ];

        const result = LocationMapper.toListDTO(locations, 10, 20, 0);

        expect(result.locations[1].name).toBe('Site B');
      });

      it('should return an empty locations array when input is empty', () => {
        const result = LocationMapper.toListDTO([], 0, 20, 0);

        expect(result.locations).toEqual([]);
      });
    });

    // -----------------------------------------------------------------------
    describe('pagination metadata', () => {
      it('should return the provided total', () => {
        const result = LocationMapper.toListDTO([], 42, 20, 0);

        expect(result.total).toBe(42);
      });

      it('should return the provided limit', () => {
        const result = LocationMapper.toListDTO([], 42, 10, 0);

        expect(result.limit).toBe(10);
      });

      it('should return the provided offset', () => {
        const result = LocationMapper.toListDTO([], 42, 20, 20);

        expect(result.offset).toBe(20);
      });

      it('should default limit to 20 when not provided', () => {
        const result = LocationMapper.toListDTO([], 5);

        expect(result.limit).toBe(20);
      });

      it('should default offset to 0 when not provided', () => {
        const result = LocationMapper.toListDTO([], 5);

        expect(result.offset).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('hasMore flag', () => {
      it('should be true when offset + count < total', () => {
        const locations = [makeLocationDomain(), makeLocationDomain()];

        const result = LocationMapper.toListDTO(locations, 10, 2, 0);

        expect(result.hasMore).toBe(true);
      });

      it('should be false when offset + count equals total', () => {
        const locations = [makeLocationDomain(), makeLocationDomain()];

        const result = LocationMapper.toListDTO(locations, 2, 2, 0);

        expect(result.hasMore).toBe(false);
      });

      it('should be false when offset + count exceeds total', () => {
        // Edge case: if somehow more items are returned than available
        const locations = [makeLocationDomain(), makeLocationDomain(), makeLocationDomain()];

        const result = LocationMapper.toListDTO(locations, 2, 3, 0);

        expect(result.hasMore).toBe(false);
      });

      it('should be true when on the first page and total is larger than the page', () => {
        const locations = [makeLocationDomain()];

        const result = LocationMapper.toListDTO(locations, 50, 20, 0);

        expect(result.hasMore).toBe(true);
      });

      it('should be false when on the last page', () => {
        const locations = [makeLocationDomain(), makeLocationDomain()];

        // offset=18, count=2, total=20 → 18+2 = 20, not less than 20
        const result = LocationMapper.toListDTO(locations, 20, 20, 18);

        expect(result.hasMore).toBe(false);
      });

      it('should be false when the result set is empty and total is 0', () => {
        const result = LocationMapper.toListDTO([], 0, 20, 0);

        expect(result.hasMore).toBe(false);
      });

      it('should be true when the result set is empty but total is non-zero and offset is behind', () => {
        // offset=0, count=0, total=5 → 0 < 5 → true
        const result = LocationMapper.toListDTO([], 5, 20, 0);

        expect(result.hasMore).toBe(true);
      });
    });
  });
});
