// Source: src/infrastructure/mappers/LocationMapper.ts

import { LocationMapper } from '../../../src/infrastructure/mappers/LocationMapper';
import { Location } from '../../../src/domain/device-inventory/aggregates';
import { LocationId } from '../../../src/domain/shared/ids';
import { LocationType } from '../../../src/domain/device-inventory/enums';
import { Address, Coordinates } from '../../../src/domain/device-inventory/value-objects';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');
const UPDATED_DATE = new Date('2024-06-15T12:00:00.000Z');

function makeRawLocation(
  overrides: Record<string, unknown> = {}
): Parameters<typeof LocationMapper.toDomain>[0] {
  return {
    id: VALID_UUID,
    name: 'Torre Norte',
    type: 'TOWER',
    municipality: 'Medellín',
    neighborhood: 'Robledo',
    address: 'Carrera 80 # 75-32',
    latitude: null,
    longitude: null,
    altitude: null,
    createdAt: BASE_DATE,
    updatedAt: UPDATED_DATE,
    ...overrides
  } as Parameters<typeof LocationMapper.toDomain>[0];
}

function makeLocationDomain(overrides: {
  name?: string;
  type?: LocationType;
  municipality?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  coordinates?: Coordinates | null;
} = {}): Location {
  const id = LocationId.parse(VALID_UUID).value;
  const street =
    overrides.address !== undefined ? overrides.address : 'Carrera 80 # 75-32';
  const municipality =
    overrides.municipality !== undefined ? overrides.municipality : 'Medellín';
  const neighborhood =
    overrides.neighborhood !== undefined ? overrides.neighborhood : 'Robledo';
  const addressVO =
    street === null || municipality === null || neighborhood === null
      ? null
      : Address.reconstitute({ street, municipality, neighborhood });

  return Location.reconstitute(id, {
    name: overrides.name ?? 'Torre Norte',
    type: overrides.type ?? LocationType.TOWER,
    address: addressVO,
    coordinates: overrides.coordinates !== undefined ? overrides.coordinates : null,
    createdAt: BASE_DATE,
    updatedAt: UPDATED_DATE
  });
}

function makeCoordinates(lat: number, lon: number, alt?: number): Coordinates {
  return Coordinates.reconstitute({ latitude: lat, longitude: lon, altitude: alt });
}

// ---------------------------------------------------------------------------

describe('LocationMapper', () => {
  // =========================================================================
  describe('toDomain()', () => {
    // -----------------------------------------------------------------------
    describe('happy path — raw record without coordinates', () => {
      it('should return a successful Result', () => {
        const raw = makeRawLocation();

        const result = LocationMapper.toDomain(raw);

        expect(result.isSuccess).toBe(true);
      });

      it('should return a Location instance', () => {
        const raw = makeRawLocation();

        const result = LocationMapper.toDomain(raw);

        expect(result.value).toBeInstanceOf(Location);
      });

      it('should map the id to a LocationId with the same string value', () => {
        const raw = makeRawLocation();

        const result = LocationMapper.toDomain(raw);

        expect(result.value.id.toString()).toBe(VALID_UUID);
      });

      it('should map name correctly', () => {
        const raw = makeRawLocation({ name: 'POP Site Alpha' });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.name).toBe('POP Site Alpha');
      });

      it('should map municipality correctly', () => {
        const raw = makeRawLocation({ municipality: 'Bogotá' });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.municipality).toBe('Bogotá');
      });

      it('should map neighborhood correctly', () => {
        const raw = makeRawLocation({ neighborhood: 'Chapinero' });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.neighborhood).toBe('Chapinero');
      });

      it('should map address correctly', () => {
        const raw = makeRawLocation({ address: 'Calle 26 # 69-76' });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.address).toBe('Calle 26 # 69-76');
      });

      it('should set coordinates to null when latitude and longitude are null', () => {
        const raw = makeRawLocation({ latitude: null, longitude: null });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates).toBeNull();
      });

      it('should set coordinates to null when latitude is null but longitude is not', () => {
        const raw = makeRawLocation({ latitude: null, longitude: -75.5812 });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates).toBeNull();
      });

      it('should set coordinates to null when longitude is null but latitude is not', () => {
        const raw = makeRawLocation({ latitude: 6.2442, longitude: null });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates).toBeNull();
      });

      it('should map municipality as null when it is null in raw', () => {
        const raw = makeRawLocation({ municipality: null });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.municipality).toBeNull();
      });

      it('should map municipality as null when it is undefined in raw', () => {
        const raw = makeRawLocation({ municipality: undefined });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.municipality).toBeNull();
      });

      it('should map neighborhood as null when it is null in raw', () => {
        const raw = makeRawLocation({ neighborhood: null });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.neighborhood).toBeNull();
      });

      it('should map address as null when it is null in raw', () => {
        const raw = makeRawLocation({ address: null });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.address).toBeNull();
      });

      it('should map createdAt correctly', () => {
        const raw = makeRawLocation();

        const result = LocationMapper.toDomain(raw);

        expect(result.value.createdAt).toEqual(BASE_DATE);
      });

      it('should map updatedAt correctly', () => {
        const raw = makeRawLocation();

        const result = LocationMapper.toDomain(raw);

        expect(result.value.updatedAt).toEqual(UPDATED_DATE);
      });

      it('should produce a Location with no domain events (reconstitution path)', () => {
        const raw = makeRawLocation();

        const result = LocationMapper.toDomain(raw);

        expect(result.value.domainEvents.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('happy path — raw record with coordinates', () => {
      it('should set coordinates when latitude and longitude are numeric', () => {
        const raw = makeRawLocation({ latitude: 6.2442, longitude: -75.5812 });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates).not.toBeNull();
        expect(result.value.coordinates!.latitude).toBe(6.2442);
        expect(result.value.coordinates!.longitude).toBe(-75.5812);
      });

      it('should coerce latitude and longitude from strings using Number()', () => {
        const raw = makeRawLocation({ latitude: '6.2442', longitude: '-75.5812' });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates).not.toBeNull();
        expect(result.value.coordinates!.latitude).toBe(6.2442);
        expect(result.value.coordinates!.longitude).toBe(-75.5812);
      });

      it('should set altitude when it is provided in raw', () => {
        const raw = makeRawLocation({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: 1540
        });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates!.altitude).toBe(1540);
        expect(result.value.coordinates!.hasAltitude()).toBe(true);
      });

      it('should coerce altitude from string using Number()', () => {
        const raw = makeRawLocation({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: '1540'
        });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates!.altitude).toBe(1540);
      });

      it('should set altitude to undefined when altitude is null in raw', () => {
        const raw = makeRawLocation({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: null
        });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates!.hasAltitude()).toBe(false);
      });

      it('should set altitude to undefined when altitude is undefined in raw', () => {
        const raw = makeRawLocation({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: undefined
        });

        const result = LocationMapper.toDomain(raw);

        expect(result.value.coordinates!.hasAltitude()).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('LocationType mapping from Prisma string', () => {
      const typeMatrix: Array<[string, LocationType]> = [
        ['TOWER', LocationType.TOWER],
        ['DATACENTER', LocationType.DATACENTER],
        ['POINT_OF_PRESENCE', LocationType.POINT_OF_PRESENCE],
        ['OFFICE', LocationType.OFFICE],
        ['CUSTOMER_PREMISES', LocationType.CUSTOMER_PREMISES],
        ['OTHER', LocationType.OTHER]
      ];

      for (const [prismaType, expectedDomainType] of typeMatrix) {
        it(`should map Prisma type "${prismaType}" to domain LocationType.${expectedDomainType}`, () => {
          const raw = makeRawLocation({ type: prismaType });

          const result = LocationMapper.toDomain(raw);

          expect(result.isSuccess).toBe(true);
          expect(result.value.type).toBe(expectedDomainType);
        });
      }

      it('should throw an error when the Prisma type string is unrecognised', () => {
        const raw = makeRawLocation({ type: 'ROOFTOP' });

        expect(() => LocationMapper.toDomain(raw)).toThrow(
          'Data integrity violation: unrecognised LocationType "ROOFTOP" in persistence store'
        );
      });

      it('should throw an error when the Prisma type is an empty string', () => {
        const raw = makeRawLocation({ type: '' });

        expect(() => LocationMapper.toDomain(raw)).toThrow();
      });

      it('should throw an error for lowercase Prisma type strings', () => {
        const raw = makeRawLocation({ type: 'tower' });

        expect(() => LocationMapper.toDomain(raw)).toThrow();
      });
    });

    // -----------------------------------------------------------------------
    describe('failure — invalid LocationId', () => {
      it('should return a failed Result when id is not a valid UUID', () => {
        const raw = makeRawLocation({ id: 'not-a-uuid' });

        const result = LocationMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
      });

      it('should include "Invalid location ID" in the error message', () => {
        const raw = makeRawLocation({ id: 'not-a-uuid' });

        const result = LocationMapper.toDomain(raw);

        expect(result.error).toContain('Invalid location ID');
      });

      it('should return a failed Result when id is an empty string', () => {
        const raw = makeRawLocation({ id: '' });

        const result = LocationMapper.toDomain(raw);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid location ID');
      });
    });
  });

  // =========================================================================
  describe('toPersistence()', () => {
    // -----------------------------------------------------------------------
    describe('happy path — location without coordinates', () => {
      it('should serialize id as a string', () => {
        const location = makeLocationDomain();

        const raw = LocationMapper.toPersistence(location);

        expect(raw.id).toBe(VALID_UUID);
      });

      it('should serialize name correctly', () => {
        const location = makeLocationDomain({ name: 'DC Beta' });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.name).toBe('DC Beta');
      });

      it('should serialize municipality correctly', () => {
        const location = makeLocationDomain({ municipality: 'Cali' });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.municipality).toBe('Cali');
      });

      it('should serialize null municipality as null', () => {
        const location = makeLocationDomain({ municipality: null });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.municipality).toBeNull();
      });

      it('should serialize neighborhood correctly', () => {
        const location = makeLocationDomain({ neighborhood: 'El Centro' });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.neighborhood).toBe('El Centro');
      });

      it('should serialize null neighborhood as null', () => {
        const location = makeLocationDomain({ neighborhood: null });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.neighborhood).toBeNull();
      });

      it('should serialize address correctly', () => {
        const location = makeLocationDomain({ address: 'Calle 10 # 43-28' });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.address).toBe('Calle 10 # 43-28');
      });

      it('should serialize null address as null', () => {
        const location = makeLocationDomain({ address: null });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.address).toBeNull();
      });

      it('should serialize latitude as null when coordinates is null', () => {
        const location = makeLocationDomain({ coordinates: null });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.latitude).toBeNull();
      });

      it('should serialize longitude as null when coordinates is null', () => {
        const location = makeLocationDomain({ coordinates: null });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.longitude).toBeNull();
      });

      it('should serialize altitude as null when coordinates is null', () => {
        const location = makeLocationDomain({ coordinates: null });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.altitude).toBeNull();
      });

      it('should serialize createdAt correctly', () => {
        const location = makeLocationDomain();

        const raw = LocationMapper.toPersistence(location);

        expect(raw.createdAt).toEqual(BASE_DATE);
      });

      it('should serialize updatedAt correctly', () => {
        const location = makeLocationDomain();

        const raw = LocationMapper.toPersistence(location);

        expect(raw.updatedAt).toEqual(UPDATED_DATE);
      });
    });

    // -----------------------------------------------------------------------
    describe('happy path — location with coordinates (no altitude)', () => {
      it('should serialize latitude from coordinates', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812)
        });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.latitude).toBe(6.2442);
      });

      it('should serialize longitude from coordinates', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812)
        });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.longitude).toBe(-75.5812);
      });

      it('should serialize altitude as null when coordinates has no altitude', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812)
        });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.altitude).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('happy path — location with coordinates including altitude', () => {
      it('should serialize latitude correctly', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812, 1540)
        });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.latitude).toBe(6.2442);
      });

      it('should serialize longitude correctly', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812, 1540)
        });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.longitude).toBe(-75.5812);
      });

      it('should serialize altitude correctly', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(6.2442, -75.5812, 1540)
        });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.altitude).toBe(1540);
      });

      it('should serialize negative altitude (below sea level)', () => {
        const location = makeLocationDomain({
          coordinates: makeCoordinates(31.2304, 121.4737, -5)
        });

        const raw = LocationMapper.toPersistence(location);

        expect(raw.altitude).toBe(-5);
      });
    });

    // -----------------------------------------------------------------------
    describe('LocationType mapping to Prisma string', () => {
      const typeMatrix: Array<[LocationType, string]> = [
        [LocationType.TOWER, 'TOWER'],
        [LocationType.DATACENTER, 'DATACENTER'],
        [LocationType.POINT_OF_PRESENCE, 'POINT_OF_PRESENCE'],
        [LocationType.OFFICE, 'OFFICE'],
        [LocationType.CUSTOMER_PREMISES, 'CUSTOMER_PREMISES'],
        [LocationType.OTHER, 'OTHER']
      ];

      for (const [domainType, expectedPrismaString] of typeMatrix) {
        it(`should map domain LocationType.${domainType} to Prisma string "${expectedPrismaString}"`, () => {
          const location = makeLocationDomain({ type: domainType });

          const raw = LocationMapper.toPersistence(location);

          expect(raw.type).toBe(expectedPrismaString);
        });
      }
    });
  });

  // =========================================================================
  describe('round-trip — toDomain → toPersistence', () => {
    it('should reproduce the same id, name, type, and address fields after a round-trip', () => {
      const originalRaw = makeRawLocation({
        type: 'DATACENTER',
        municipality: 'Bogotá',
        neighborhood: 'Chapinero',
        address: 'Carrera 7 # 32-16'
      });

      const domainResult = LocationMapper.toDomain(originalRaw);
      expect(domainResult.isSuccess).toBe(true);

      const serialized = LocationMapper.toPersistence(domainResult.value);

      expect(serialized.id).toBe(originalRaw.id);
      expect(serialized.name).toBe(originalRaw.name);
      expect(serialized.type).toBe(originalRaw.type);
      expect(serialized.municipality).toBe(originalRaw.municipality);
      expect(serialized.neighborhood).toBe(originalRaw.neighborhood);
      expect(serialized.address).toBe(originalRaw.address);
    });

    it('should preserve coordinate values after a round-trip', () => {
      const originalRaw = makeRawLocation({
        latitude: 4.7109,
        longitude: -74.0721,
        altitude: 2600
      });

      const domainResult = LocationMapper.toDomain(originalRaw);
      const serialized = LocationMapper.toPersistence(domainResult.value);

      expect(serialized.latitude).toBe(4.7109);
      expect(serialized.longitude).toBe(-74.0721);
      expect(serialized.altitude).toBe(2600);
    });

    it('should preserve null coordinates after a round-trip', () => {
      const originalRaw = makeRawLocation({
        latitude: null,
        longitude: null,
        altitude: null
      });

      const domainResult = LocationMapper.toDomain(originalRaw);
      const serialized = LocationMapper.toPersistence(domainResult.value);

      expect(serialized.latitude).toBeNull();
      expect(serialized.longitude).toBeNull();
      expect(serialized.altitude).toBeNull();
    });

    it('should round-trip every LocationType correctly', () => {
      const types: string[] = [
        'TOWER',
        'DATACENTER',
        'POINT_OF_PRESENCE',
        'OFFICE',
        'CUSTOMER_PREMISES',
        'OTHER'
      ];

      for (const type of types) {
        const raw = makeRawLocation({ type });
        const domainResult = LocationMapper.toDomain(raw);
        expect(domainResult.isSuccess).toBe(true);

        const serialized = LocationMapper.toPersistence(domainResult.value);
        expect(serialized.type).toBe(type);
      }
    });
  });
});
