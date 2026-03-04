// Source: src/domain/device-inventory/aggregates/Location.ts

import {
  Location,
  LocationProps,
  Coordinates,
  LocationType,
  LocationCreatedEvent,
  LocationUpdatedEvent
} from '../../../../src/domain/device-inventory';
import { LocationId } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_DATE = new Date('2024-01-01T00:00:00Z');

function validProps(
  overrides: Partial<LocationProps> = {}
): LocationProps {
  return {
    name: 'Main Tower',
    type: LocationType.TOWER,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides
  };
}

function makeCoords(
  lat = 6.2442,
  lon = -75.5812,
  alt?: number
): Coordinates {
  return Coordinates.create({
    latitude: lat,
    longitude: lon,
    altitude: alt
  }).value;
}

// ---------------------------------------------------------------------------
describe('Location', () => {
  // =========================================================================
  describe('create()', () => {
    describe('when given valid required-only props', () => {
      it('should return a successful Result', () => {
        const result = Location.create(validProps());

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should return a Location instance', () => {
        const result = Location.create(validProps());

        expect(result.value).toBeInstanceOf(Location);
      });

      it('should expose the provided name', () => {
        const result = Location.create(
          validProps({ name: 'DC Alpha' })
        );

        expect(result.value.name).toBe('DC Alpha');
      });

      it('should expose the provided type', () => {
        const result = Location.create(
          validProps({ type: LocationType.DATACENTER })
        );

        expect(result.value.type).toBe(LocationType.DATACENTER);
      });

      it('should default municipality to null when not provided', () => {
        const result = Location.create(validProps());

        expect(result.value.municipality).toBeNull();
      });

      it('should default neighborhood to null when not provided', () => {
        const result = Location.create(validProps());

        expect(result.value.neighborhood).toBeNull();
      });

      it('should default address to null when not provided', () => {
        const result = Location.create(validProps());

        expect(result.value.address).toBeNull();
      });

      it('should default coordinates to null when not provided', () => {
        const result = Location.create(validProps());

        expect(result.value.coordinates).toBeNull();
      });

      it('should assign a valid LocationId', () => {
        const result = Location.create(validProps());

        expect(result.value.id).toBeInstanceOf(LocationId);
        expect(result.value.id.toValue().length).toBeGreaterThan(0);
      });

      it('should set createdAt and updatedAt to the provided values', () => {
        const now = new Date('2024-03-15T08:30:00Z');
        const result = Location.create(
          validProps({ createdAt: now, updatedAt: now })
        );

        expect(result.value.createdAt).toEqual(now);
        expect(result.value.updatedAt).toEqual(now);
      });
    });

    describe('when given all optional props', () => {
      it('should expose municipality, neighborhood, address and coordinates', () => {
        const coords = makeCoords(6.2442, -75.5812, 1495);
        const result = Location.create(
          validProps({
            municipality: 'Medellín',
            neighborhood: 'El Poblado',
            address: 'Calle 10 # 43-28',
            coordinates: coords
          })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.municipality).toBe('Medellín');
        expect(result.value.neighborhood).toBe('El Poblado');
        expect(result.value.address).toBe('Calle 10 # 43-28');
        expect(result.value.coordinates).toBe(coords);
      });
    });

    // -----------------------------------------------------------------------
    describe('name validation', () => {
      it('should fail when name is null', () => {
        const result = Location.create(
          validProps({ name: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is undefined', () => {
        const result = Location.create(
          validProps({ name: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is not a string', () => {
        const result = Location.create(
          validProps({ name: 42 as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is an empty string', () => {
        const result = Location.create(validProps({ name: '' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is whitespace only', () => {
        const result = Location.create(validProps({ name: '   ' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name exceeds 150 characters', () => {
        const result = Location.create(
          validProps({ name: 'A'.repeat(151) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });

      it('should succeed when name is exactly 150 characters', () => {
        const result = Location.create(
          validProps({ name: 'A'.repeat(150) })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when name is 1 character', () => {
        const result = Location.create(validProps({ name: 'X' }));

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('type validation', () => {
      it('should fail when type is null', () => {
        const result = Location.create(
          validProps({ type: null as unknown as LocationType })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('type');
      });

      it('should fail when type is undefined', () => {
        const result = Location.create(
          validProps({ type: undefined as unknown as LocationType })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('type');
      });

      it('should accept all valid LocationType values', () => {
        const types: LocationType[] = [
          LocationType.TOWER,
          LocationType.NODE,
          LocationType.DATACENTER,
          LocationType.POP,
          LocationType.WAREHOUSE,
          LocationType.OFFICE
        ];

        for (const type of types) {
          const result = Location.create(validProps({ type }));
          expect(result.isSuccess).toBe(true);
          expect(result.value.type).toBe(type);
        }
      });
    });

    // -----------------------------------------------------------------------
    describe('municipality validation', () => {
      it('should fail when municipality exceeds 100 characters', () => {
        const result = Location.create(
          validProps({ municipality: 'A'.repeat(101) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100');
      });

      it('should succeed when municipality is exactly 100 characters', () => {
        const result = Location.create(
          validProps({ municipality: 'A'.repeat(100) })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when municipality is null', () => {
        const result = Location.create(
          validProps({ municipality: null })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.municipality).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('neighborhood validation', () => {
      it('should fail when neighborhood exceeds 150 characters', () => {
        const result = Location.create(
          validProps({ neighborhood: 'A'.repeat(151) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });

      it('should succeed when neighborhood is exactly 150 characters', () => {
        const result = Location.create(
          validProps({ neighborhood: 'A'.repeat(150) })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when neighborhood is null', () => {
        const result = Location.create(
          validProps({ neighborhood: null })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.neighborhood).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('address validation', () => {
      it('should fail when address exceeds 255 characters', () => {
        const result = Location.create(
          validProps({ address: 'A'.repeat(256) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('255');
      });

      it('should succeed when address is exactly 255 characters', () => {
        const result = Location.create(
          validProps({ address: 'A'.repeat(255) })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when address is null', () => {
        const result = Location.create(validProps({ address: null }));

        expect(result.isSuccess).toBe(true);
        expect(result.value.address).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('domain event emission', () => {
      it('should add exactly one domain event on successful creation', () => {
        const result = Location.create(validProps());

        expect(result.value.domainEvents.length).toBe(1);
      });

      it('should emit a LocationCreatedEvent', () => {
        const result = Location.create(validProps());
        const event = result.value.domainEvents[0];

        expect(event).toBeInstanceOf(LocationCreatedEvent);
      });

      it('should emit a LocationCreatedEvent with the correct aggregate ID', () => {
        const result = Location.create(validProps());
        const event = result.value
          .domainEvents[0] as LocationCreatedEvent;

        expect(event.aggregateId.toString()).toBe(
          result.value.id.toString()
        );
      });

      it('should emit a LocationCreatedEvent with the correct location name', () => {
        const result = Location.create(
          validProps({ name: 'POP Site 3' })
        );
        const event = result.value
          .domainEvents[0] as LocationCreatedEvent;

        expect(event.locationName).toBe('POP Site 3');
      });

      it('should emit a LocationCreatedEvent with the correct location type', () => {
        const result = Location.create(
          validProps({ type: LocationType.POP })
        );
        const event = result.value
          .domainEvents[0] as LocationCreatedEvent;

        expect(event.locationType).toBe(LocationType.POP);
      });

      it('should emit a LocationCreatedEvent with a recent dateTimeOccurred', () => {
        const before = new Date();
        const result = Location.create(validProps());
        const after = new Date();
        const event = result.value
          .domainEvents[0] as LocationCreatedEvent;

        expect(
          event.dateTimeOccurred.getTime()
        ).toBeGreaterThanOrEqual(before.getTime());
        expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should not emit any domain event when creation fails', () => {
        const result = Location.create(validProps({ name: '' }));

        expect(result.isFailure).toBe(true);
        // No Location instance is created, so no events exist.
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a Location instance without emitting domain events', () => {
      const id = LocationId.create();
      const location = Location.reconstitute(id, validProps());

      expect(location).toBeInstanceOf(Location);
      expect(location.domainEvents.length).toBe(0);
    });

    it('should use the provided ID', () => {
      const id = LocationId.create();
      const location = Location.reconstitute(id, validProps());

      expect(location.id).toBe(id);
    });

    it('should expose the props it was given', () => {
      const id = LocationId.create();
      const coords = makeCoords();
      const props = validProps({
        name: 'DC Reconstituted',
        type: LocationType.DATACENTER,
        municipality: 'Bogotá',
        neighborhood: 'Chapinero',
        address: 'Carrera 7 # 32-16',
        coordinates: coords
      });
      const location = Location.reconstitute(id, props);

      expect(location.name).toBe('DC Reconstituted');
      expect(location.type).toBe(LocationType.DATACENTER);
      expect(location.municipality).toBe('Bogotá');
      expect(location.neighborhood).toBe('Chapinero');
      expect(location.address).toBe('Carrera 7 # 32-16');
      expect(location.coordinates).toBe(coords);
    });

    it('should preserve the provided timestamps', () => {
      const id = LocationId.create();
      const createdAt = new Date('2023-01-01T00:00:00Z');
      const updatedAt = new Date('2023-06-01T00:00:00Z');
      const location = Location.reconstitute(
        id,
        validProps({ createdAt, updatedAt })
      );

      expect(location.createdAt).toEqual(createdAt);
      expect(location.updatedAt).toEqual(updatedAt);
    });
  });

  // =========================================================================
  describe('updateName()', () => {
    function makeLocation(name = 'Initial Name'): Location {
      return Location.create(validProps({ name })).value;
    }

    describe('happy path', () => {
      it('should return a successful Result when name is valid', () => {
        const location = makeLocation();
        const result = location.updateName('Updated Name');

        expect(result.isSuccess).toBe(true);
      });

      it('should update the name', () => {
        const location = makeLocation('Old Name');
        location.updateName('New Name');

        expect(location.name).toBe('New Name');
      });

      it('should add a LocationUpdatedEvent', () => {
        const location = makeLocation();
        location.clearEvents();
        location.updateName('Changed Name');

        const events = location.domainEvents;
        expect(events.length).toBe(1);
        expect(events[0]).toBeInstanceOf(LocationUpdatedEvent);
      });

      it('should emit a LocationUpdatedEvent with changedFields = ["name"]', () => {
        const location = makeLocation('Original');
        location.clearEvents();
        location.updateName('Changed');
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event.changedFields).toEqual(['name']);
      });

      it('should emit a LocationUpdatedEvent capturing previousValues and newValues', () => {
        const location = makeLocation('Old Name');
        location.clearEvents();
        location.updateName('New Name');
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event.previousValues).toEqual({ name: 'Old Name' });
        expect(event.newValues).toEqual({ name: 'New Name' });
      });

      it('should update updatedAt timestamp', () => {
        const location = Location.create(
          validProps({ updatedAt: BASE_DATE })
        ).value;
        const before = new Date();
        location.updateName('New Name');
        const after = new Date();

        expect(location.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(location.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    describe('no-op when name is unchanged', () => {
      it('should return a successful Result without emitting an event', () => {
        const location = makeLocation('Same Name');
        location.clearEvents();
        const result = location.updateName('Same Name');

        expect(result.isSuccess).toBe(true);
        expect(location.domainEvents.length).toBe(0);
      });
    });

    describe('validation failures', () => {
      it('should fail when name is null', () => {
        const location = makeLocation();
        const result = location.updateName(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is undefined', () => {
        const location = makeLocation();
        const result = location.updateName(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is not a string', () => {
        const location = makeLocation();
        const result = location.updateName(123 as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is an empty string', () => {
        const location = makeLocation();
        const result = location.updateName('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is whitespace only', () => {
        const location = makeLocation();
        const result = location.updateName('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name exceeds 150 characters', () => {
        const location = makeLocation();
        const result = location.updateName('A'.repeat(151));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });

      it('should succeed when name is exactly 150 characters', () => {
        const location = makeLocation();
        const result = location.updateName('A'.repeat(150));

        expect(result.isSuccess).toBe(true);
      });

      it('should not change the name when validation fails', () => {
        const location = makeLocation('Good Name');
        location.updateName('');

        expect(location.name).toBe('Good Name');
      });

      it('should not emit any event when validation fails', () => {
        const location = makeLocation();
        location.clearEvents();
        location.updateName('');

        expect(location.domainEvents.length).toBe(0);
      });
    });
  });

  // =========================================================================
  describe('updateType()', () => {
    function makeLocation(type = LocationType.TOWER): Location {
      return Location.create(validProps({ type })).value;
    }

    describe('happy path', () => {
      it('should return a successful Result when type is valid', () => {
        const location = makeLocation(LocationType.TOWER);
        const result = location.updateType(LocationType.NODE);

        expect(result.isSuccess).toBe(true);
      });

      it('should update the type', () => {
        const location = makeLocation(LocationType.TOWER);
        location.updateType(LocationType.DATACENTER);

        expect(location.type).toBe(LocationType.DATACENTER);
      });

      it('should emit a LocationUpdatedEvent with changedFields = ["type"]', () => {
        const location = makeLocation(LocationType.TOWER);
        location.clearEvents();
        location.updateType(LocationType.POP);
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event).toBeInstanceOf(LocationUpdatedEvent);
        expect(event.changedFields).toEqual(['type']);
      });

      it('should emit a LocationUpdatedEvent capturing previousValues and newValues', () => {
        const location = makeLocation(LocationType.TOWER);
        location.clearEvents();
        location.updateType(LocationType.NODE);
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event.previousValues).toEqual({
          type: LocationType.TOWER
        });
        expect(event.newValues).toEqual({ type: LocationType.NODE });
      });

      it('should update updatedAt timestamp', () => {
        const location = Location.create(
          validProps({ updatedAt: BASE_DATE })
        ).value;
        const before = new Date();
        location.updateType(LocationType.OFFICE);
        const after = new Date();

        expect(location.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(location.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    describe('no-op when type is unchanged', () => {
      it('should return a successful Result without emitting an event', () => {
        const location = makeLocation(LocationType.TOWER);
        location.clearEvents();
        const result = location.updateType(LocationType.TOWER);

        expect(result.isSuccess).toBe(true);
        expect(location.domainEvents.length).toBe(0);
      });
    });

    describe('validation failures', () => {
      it('should fail when type is null', () => {
        const location = makeLocation();
        const result = location.updateType(
          null as unknown as LocationType
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('type');
      });

      it('should fail when type is undefined', () => {
        const location = makeLocation();
        const result = location.updateType(
          undefined as unknown as LocationType
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('type');
      });

      it('should not change the type when validation fails', () => {
        const location = makeLocation(LocationType.TOWER);
        location.updateType(null as unknown as LocationType);

        expect(location.type).toBe(LocationType.TOWER);
      });
    });
  });

  // =========================================================================
  describe('updateAddressFields()', () => {
    function makeLocation(): Location {
      return Location.create(
        validProps({
          municipality: 'Initial City',
          neighborhood: 'Initial Neighborhood',
          address: 'Initial Address'
        })
      ).value;
    }

    describe('happy path', () => {
      it('should update municipality when provided and different', () => {
        const location = makeLocation();
        location.clearEvents();
        const result = location.updateAddressFields({
          municipality: 'New City'
        });

        expect(result.isSuccess).toBe(true);
        expect(location.municipality).toBe('New City');
      });

      it('should update neighborhood when provided and different', () => {
        const location = makeLocation();
        const result = location.updateAddressFields({
          neighborhood: 'New Neighborhood'
        });

        expect(result.isSuccess).toBe(true);
        expect(location.neighborhood).toBe('New Neighborhood');
      });

      it('should update address when provided and different', () => {
        const location = makeLocation();
        const result = location.updateAddressFields({
          address: 'New Address Street 123'
        });

        expect(result.isSuccess).toBe(true);
        expect(location.address).toBe('New Address Street 123');
      });

      it('should update all three fields simultaneously', () => {
        const location = makeLocation();
        location.clearEvents();
        const result = location.updateAddressFields({
          municipality: 'City A',
          neighborhood: 'Barrio B',
          address: 'Street C'
        });

        expect(result.isSuccess).toBe(true);
        expect(location.municipality).toBe('City A');
        expect(location.neighborhood).toBe('Barrio B');
        expect(location.address).toBe('Street C');
      });

      it('should set municipality to null explicitly', () => {
        const location = makeLocation();
        location.updateAddressFields({ municipality: null });

        expect(location.municipality).toBeNull();
      });

      it('should emit a LocationUpdatedEvent with the fields that changed', () => {
        const location = makeLocation();
        location.clearEvents();
        location.updateAddressFields({
          municipality: 'New City',
          neighborhood: 'New Barrio'
        });
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event).toBeInstanceOf(LocationUpdatedEvent);
        expect(event.changedFields).toContain('municipality');
        expect(event.changedFields).toContain('neighborhood');
        expect(event.changedFields).not.toContain('address');
      });

      it('should capture previousValues and newValues in the event', () => {
        const location = makeLocation();
        location.clearEvents();
        location.updateAddressFields({ municipality: 'New City' });
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event.previousValues.municipality).toBe(
          'Initial City'
        );
        expect(event.newValues.municipality).toBe('New City');
      });

      it('should update updatedAt timestamp', () => {
        const location = Location.create(
          validProps({ updatedAt: BASE_DATE })
        ).value;
        const before = new Date();
        location.updateAddressFields({ municipality: 'A' });
        const after = new Date();

        expect(location.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(location.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    describe('no-op when values are unchanged', () => {
      it('should not emit an event when all provided values are the same as current', () => {
        const location = makeLocation();
        location.clearEvents();
        const result = location.updateAddressFields({
          municipality: 'Initial City'
        });

        expect(result.isSuccess).toBe(true);
        expect(location.domainEvents.length).toBe(0);
      });

      it('should not emit an event when no fields are passed at all', () => {
        const location = makeLocation();
        location.clearEvents();
        const result = location.updateAddressFields({});

        expect(result.isSuccess).toBe(true);
        expect(location.domainEvents.length).toBe(0);
      });

      it('should not emit an event when a field is undefined (omitted)', () => {
        const location = makeLocation();
        location.clearEvents();
        const result = location.updateAddressFields({
          municipality: undefined
        });

        expect(result.isSuccess).toBe(true);
        expect(location.domainEvents.length).toBe(0);
      });
    });

    describe('validation failures', () => {
      it('should fail when municipality exceeds 100 characters', () => {
        const location = makeLocation();
        const result = location.updateAddressFields({
          municipality: 'A'.repeat(101)
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100');
      });

      it('should succeed when municipality is exactly 100 characters', () => {
        const location = makeLocation();
        const result = location.updateAddressFields({
          municipality: 'A'.repeat(100)
        });

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when neighborhood exceeds 150 characters', () => {
        const location = makeLocation();
        const result = location.updateAddressFields({
          neighborhood: 'A'.repeat(151)
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('150');
      });

      it('should succeed when neighborhood is exactly 150 characters', () => {
        const location = makeLocation();
        const result = location.updateAddressFields({
          neighborhood: 'A'.repeat(150)
        });

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when address exceeds 255 characters', () => {
        const location = makeLocation();
        const result = location.updateAddressFields({
          address: 'A'.repeat(256)
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('255');
      });

      it('should succeed when address is exactly 255 characters', () => {
        const location = makeLocation();
        const result = location.updateAddressFields({
          address: 'A'.repeat(255)
        });

        expect(result.isSuccess).toBe(true);
      });

      it('should not change any field when validation fails', () => {
        const location = makeLocation();
        location.updateAddressFields({
          municipality: 'A'.repeat(101)
        });

        expect(location.municipality).toBe('Initial City');
      });
    });
  });

  // =========================================================================
  describe('updateCoordinates()', () => {
    function makeLocation(coords?: Coordinates): Location {
      return Location.create(
        validProps({ coordinates: coords ?? null })
      ).value;
    }

    describe('happy path', () => {
      it('should return a successful Result when setting new coordinates', () => {
        const location = makeLocation();
        const result = location.updateCoordinates(makeCoords());

        expect(result.isSuccess).toBe(true);
      });

      it('should update coordinates', () => {
        const location = makeLocation();
        const newCoords = makeCoords(40.7128, -74.006);
        location.updateCoordinates(newCoords);

        expect(location.coordinates).toBe(newCoords);
      });

      it('should set coordinates to null', () => {
        const location = makeLocation(makeCoords());
        location.updateCoordinates(null);

        expect(location.coordinates).toBeNull();
      });

      it('should emit a LocationUpdatedEvent with changedFields = ["coordinates"]', () => {
        const location = makeLocation();
        location.clearEvents();
        location.updateCoordinates(makeCoords(6.2442, -75.5812));
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event).toBeInstanceOf(LocationUpdatedEvent);
        expect(event.changedFields).toEqual(['coordinates']);
      });

      it('should emit an event carrying the string representations of previous and new coords', () => {
        const oldCoords = makeCoords(6.2442, -75.5812);
        const location = makeLocation(oldCoords);
        location.clearEvents();
        const newCoords = makeCoords(40.7128, -74.006);
        location.updateCoordinates(newCoords);
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event.previousValues.coordinates).toBe(
          oldCoords.toString()
        );
        expect(event.newValues.coordinates).toBe(
          newCoords.toString()
        );
      });

      it('should emit an event with null previousValues when location had no coords', () => {
        const location = makeLocation();
        location.clearEvents();
        location.updateCoordinates(makeCoords());
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event.previousValues.coordinates).toBeNull();
      });

      it('should emit an event with null newValues when clearing coordinates', () => {
        const location = makeLocation(makeCoords());
        location.clearEvents();
        location.updateCoordinates(null);
        const event = location
          .domainEvents[0] as LocationUpdatedEvent;

        expect(event.newValues.coordinates).toBeNull();
      });

      it('should update updatedAt timestamp', () => {
        const location = Location.create(
          validProps({ updatedAt: BASE_DATE })
        ).value;
        const before = new Date();
        location.updateCoordinates(makeCoords());
        const after = new Date();

        expect(location.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(location.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    describe('no-op when coordinates are unchanged', () => {
      it('should not emit an event when coordinates are identical', () => {
        const coords = makeCoords(6.2442, -75.5812, 1495);
        const location = makeLocation(coords);
        const sameCoords = makeCoords(6.2442, -75.5812, 1495);
        location.clearEvents();
        const result = location.updateCoordinates(sameCoords);

        expect(result.isSuccess).toBe(true);
        expect(location.domainEvents.length).toBe(0);
      });

      it('should not emit an event when setting null on already-null coordinates', () => {
        const location = makeLocation(null as unknown as Coordinates);
        location.clearEvents();
        const result = location.updateCoordinates(null);

        expect(result.isSuccess).toBe(true);
        expect(location.domainEvents.length).toBe(0);
      });
    });
  });

  // =========================================================================
  describe('hasCoordinates()', () => {
    it('should return false when coordinates is null', () => {
      const location = Location.create(
        validProps({ coordinates: null })
      ).value;

      expect(location.hasCoordinates()).toBe(false);
    });

    it('should return false when coordinates is undefined', () => {
      const location = Location.create(validProps()).value;

      // Default when not provided is null (set in create), so:
      expect(location.hasCoordinates()).toBe(false);
    });

    it('should return true when coordinates is set', () => {
      const location = Location.create(
        validProps({ coordinates: makeCoords() })
      ).value;

      expect(location.hasCoordinates()).toBe(true);
    });

    it('should reflect the updated state after updateCoordinates', () => {
      const location = Location.create(validProps()).value;
      expect(location.hasCoordinates()).toBe(false);

      location.updateCoordinates(makeCoords());
      expect(location.hasCoordinates()).toBe(true);

      location.updateCoordinates(null);
      expect(location.hasCoordinates()).toBe(false);
    });
  });

  // =========================================================================
  describe('clearEvents()', () => {
    it('should remove all domain events', () => {
      const location = Location.create(validProps()).value;
      expect(location.domainEvents.length).toBe(1);

      location.clearEvents();

      expect(location.domainEvents.length).toBe(0);
    });

    it('should allow new events to accumulate after clearing', () => {
      const location = Location.create(validProps()).value;
      location.clearEvents();

      location.updateName('New Name');

      expect(location.domainEvents.length).toBe(1);
    });
  });

  // =========================================================================
  describe('real-world scenarios', () => {
    it('should represent a full ISP tower record with all fields populated', () => {
      const result = Location.create({
        name: 'Torre Norte',
        type: LocationType.TOWER,
        municipality: 'Medellín',
        neighborhood: 'Robledo',
        address: 'Carrera 80 # 75-32',
        coordinates: makeCoords(6.281, -75.598, 1540),
        createdAt: BASE_DATE,
        updatedAt: BASE_DATE
      });

      expect(result.isSuccess).toBe(true);
      const location = result.value;
      expect(location.name).toBe('Torre Norte');
      expect(location.type).toBe(LocationType.TOWER);
      expect(location.municipality).toBe('Medellín');
      expect(location.hasCoordinates()).toBe(true);
    });

    it('should allow sequential updates and accumulate matching events', () => {
      const location = Location.create(
        validProps({ name: 'Site Alpha', type: LocationType.POP })
      ).value;
      location.clearEvents();

      location.updateName('Site Alpha Prime');
      location.updateType(LocationType.NODE);
      location.updateAddressFields({ municipality: 'Cali' });
      location.updateCoordinates(makeCoords(3.4516, -76.5321));

      expect(location.domainEvents.length).toBe(4);
      expect(
        location.domainEvents.every(
          (e) => e instanceof LocationUpdatedEvent
        )
      ).toBe(true);
    });

    it('should generate a unique ID for each created location', () => {
      const a = Location.create(validProps()).value;
      const b = Location.create(validProps()).value;

      expect(a.id.toString()).not.toBe(b.id.toString());
    });
  });
});
