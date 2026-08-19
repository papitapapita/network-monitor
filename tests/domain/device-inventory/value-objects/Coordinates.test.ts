// Source: src/domain/device-inventory/value-objects/Coordinates.ts

import {
  Coordinates,
  CoordinatesProps
} from '../../../../src/domain/device-inventory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validProps(
  overrides: Partial<CoordinatesProps> = {}
): CoordinatesProps {
  return { latitude: 6.2442, longitude: -75.5812, ...overrides };
}

// ---------------------------------------------------------------------------
describe('Coordinates', () => {
  // -------------------------------------------------------------------------
  describe('[DEV-093] create()', () => {
    describe('when given valid minimal coordinates (no altitude)', () => {
      it('should return a successful Result', () => {
        const result = Coordinates.create(validProps());

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should return a Coordinates instance', () => {
        const result = Coordinates.create(validProps());

        expect(result.value).toBeInstanceOf(Coordinates);
      });

      it('should expose the correct latitude and longitude', () => {
        const result = Coordinates.create(
          validProps({ latitude: 51.5074, longitude: -0.1278 })
        );

        expect(result.value.latitude).toBe(51.5074);
        expect(result.value.longitude).toBe(-0.1278);
      });

      it('should leave altitude undefined when not provided', () => {
        const result = Coordinates.create(validProps());

        expect(result.value.altitude).toBeUndefined();
      });
    });

    describe('when given valid coordinates with altitude', () => {
      it('should return a successful Result and expose altitude', () => {
        const result = Coordinates.create(
          validProps({ altitude: 1495 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.altitude).toBe(1495);
      });

      it('should accept zero altitude', () => {
        const result = Coordinates.create(
          validProps({ altitude: 0 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.altitude).toBe(0);
      });

      it('should accept negative altitude (below sea level)', () => {
        const result = Coordinates.create(
          validProps({ altitude: -420 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.altitude).toBe(-420);
      });

      it('should accept a very large positive altitude', () => {
        const result = Coordinates.create(
          validProps({ altitude: 8849 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.altitude).toBe(8849);
      });
    });

    // -----------------------------------------------------------------------
    describe('latitude validation', () => {
      it('should fail when latitude is null', () => {
        const result = Coordinates.create(
          validProps({ latitude: null as unknown as number })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should fail when latitude is undefined', () => {
        const result = Coordinates.create(
          validProps({ latitude: undefined as unknown as number })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should fail when latitude is NaN', () => {
        const result = Coordinates.create(
          validProps({ latitude: NaN })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should fail when latitude is Infinity', () => {
        const result = Coordinates.create(
          validProps({ latitude: Infinity })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should fail when latitude is -Infinity', () => {
        const result = Coordinates.create(
          validProps({ latitude: -Infinity })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should fail when latitude is a string', () => {
        const result = Coordinates.create(
          validProps({ latitude: '6.24' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should fail when latitude exceeds 90', () => {
        const result = Coordinates.create(
          validProps({ latitude: 90.0001 })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should fail when latitude is below -90', () => {
        const result = Coordinates.create(
          validProps({ latitude: -90.0001 })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('latitude');
      });

      it('should accept latitude at the boundary value of 90', () => {
        const result = Coordinates.create(
          validProps({ latitude: 90 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.latitude).toBe(90);
      });

      it('should accept latitude at the boundary value of -90', () => {
        const result = Coordinates.create(
          validProps({ latitude: -90 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.latitude).toBe(-90);
      });

      it('should accept latitude of 0', () => {
        const result = Coordinates.create(
          validProps({ latitude: 0 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.latitude).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('longitude validation', () => {
      it('should fail when longitude is null', () => {
        const result = Coordinates.create(
          validProps({ longitude: null as unknown as number })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should fail when longitude is undefined', () => {
        const result = Coordinates.create(
          validProps({ longitude: undefined as unknown as number })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should fail when longitude is NaN', () => {
        const result = Coordinates.create(
          validProps({ longitude: NaN })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should fail when longitude is Infinity', () => {
        const result = Coordinates.create(
          validProps({ longitude: Infinity })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should fail when longitude is -Infinity', () => {
        const result = Coordinates.create(
          validProps({ longitude: -Infinity })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should fail when longitude is a string', () => {
        const result = Coordinates.create(
          validProps({ longitude: '-75.58' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should fail when longitude exceeds 180', () => {
        const result = Coordinates.create(
          validProps({ longitude: 180.0001 })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should fail when longitude is below -180', () => {
        const result = Coordinates.create(
          validProps({ longitude: -180.0001 })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('longitude');
      });

      it('should accept longitude at the boundary value of 180', () => {
        const result = Coordinates.create(
          validProps({ longitude: 180 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.longitude).toBe(180);
      });

      it('should accept longitude at the boundary value of -180', () => {
        const result = Coordinates.create(
          validProps({ longitude: -180 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.longitude).toBe(-180);
      });

      it('should accept longitude of 0', () => {
        const result = Coordinates.create(
          validProps({ longitude: 0 })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.longitude).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('altitude validation', () => {
      it('should fail when altitude is NaN', () => {
        const result = Coordinates.create(
          validProps({ altitude: NaN })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('altitude');
      });

      it('should fail when altitude is Infinity', () => {
        const result = Coordinates.create(
          validProps({ altitude: Infinity })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('altitude');
      });

      it('should fail when altitude is -Infinity', () => {
        const result = Coordinates.create(
          validProps({ altitude: -Infinity })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('altitude');
      });

      it('should fail when altitude is a string', () => {
        const result = Coordinates.create(
          validProps({ altitude: '1500' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('altitude');
      });

      it('should accept null altitude (treated as absent)', () => {
        const result = Coordinates.create(
          validProps({
            altitude: null as unknown as number | undefined
          })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.hasAltitude()).toBe(false);
      });

      it('should accept undefined altitude', () => {
        const result = Coordinates.create(
          validProps({ altitude: undefined })
        );

        expect(result.isSuccess).toBe(true);
        expect(result.value.hasAltitude()).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('null/undefined props object', () => {
      it('should fail when the props object itself is null', () => {
        const result = Coordinates.create(
          null as unknown as CoordinatesProps
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('coordinates');
      });

      it('should fail when the props object itself is undefined', () => {
        const result = Coordinates.create(
          undefined as unknown as CoordinatesProps
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('coordinates');
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('reconstitute()', () => {
    it('should create a Coordinates instance without validation', () => {
      const coords = Coordinates.reconstitute({
        latitude: 6.2442,
        longitude: -75.5812,
        altitude: 1495
      });

      expect(coords).toBeInstanceOf(Coordinates);
      expect(coords.latitude).toBe(6.2442);
      expect(coords.longitude).toBe(-75.5812);
      expect(coords.altitude).toBe(1495);
    });

    it('should reconstitute coordinates without altitude', () => {
      const coords = Coordinates.reconstitute({
        latitude: 40.7128,
        longitude: -74.006
      });

      expect(coords).toBeInstanceOf(Coordinates);
      expect(coords.latitude).toBe(40.7128);
      expect(coords.longitude).toBe(-74.006);
      expect(coords.altitude).toBeUndefined();
    });

    it('should return the exact values it was given (no rounding)', () => {
      const props: CoordinatesProps = {
        latitude: 48.856613,
        longitude: 2.352222,
        altitude: 35.5
      };
      const coords = Coordinates.reconstitute(props);

      expect(coords.latitude).toBe(props.latitude);
      expect(coords.longitude).toBe(props.longitude);
      expect(coords.altitude).toBe(props.altitude);
    });
  });

  // -------------------------------------------------------------------------
  describe('hasAltitude()', () => {
    it('should return false when altitude is not provided', () => {
      const coords = Coordinates.create(validProps()).value;

      expect(coords.hasAltitude()).toBe(false);
    });

    it('should return false when altitude is undefined', () => {
      const coords = Coordinates.create(
        validProps({ altitude: undefined })
      ).value;

      expect(coords.hasAltitude()).toBe(false);
    });

    it('should return true when altitude has a positive value', () => {
      const coords = Coordinates.create(
        validProps({ altitude: 1495 })
      ).value;

      expect(coords.hasAltitude()).toBe(true);
    });

    it('should return true when altitude is zero', () => {
      const coords = Coordinates.create(
        validProps({ altitude: 0 })
      ).value;

      expect(coords.hasAltitude()).toBe(true);
    });

    it('should return true when altitude is negative', () => {
      const coords = Coordinates.create(
        validProps({ altitude: -30 })
      ).value;

      expect(coords.hasAltitude()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should return "lat, lon" when there is no altitude', () => {
      const coords = Coordinates.create(
        validProps({ latitude: 6.2442, longitude: -75.5812 })
      ).value;

      expect(coords.toString()).toBe('6.2442, -75.5812');
    });

    it('should return "lat, lon, altm" when altitude is present', () => {
      const coords = Coordinates.create(
        validProps({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: 1495
        })
      ).value;

      expect(coords.toString()).toBe('6.2442, -75.5812, 1495m');
    });

    it('should include negative altitude in string representation', () => {
      const coords = Coordinates.create(
        validProps({ latitude: 0, longitude: 0, altitude: -420 })
      ).value;

      expect(coords.toString()).toBe('0, 0, -420m');
    });

    it('should include zero altitude in string representation', () => {
      const coords = Coordinates.create(
        validProps({ latitude: 0, longitude: 0, altitude: 0 })
      ).value;

      expect(coords.toString()).toBe('0, 0, 0m');
    });

    it('should return consistent results across multiple calls', () => {
      const coords = Coordinates.create(
        validProps({
          latitude: 51.5074,
          longitude: -0.1278,
          altitude: 15
        })
      ).value;

      expect(coords.toString()).toBe(coords.toString());
    });

    it('should handle boundary latitude/longitude values in string', () => {
      const coords = Coordinates.create({
        latitude: -90,
        longitude: 180
      }).value;

      expect(coords.toString()).toBe('-90, 180');
    });
  });

  // -------------------------------------------------------------------------
  describe('equals() — ValueObject structural equality', () => {
    it('should return true for two instances with identical props', () => {
      const a = Coordinates.create(
        validProps({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: 1495
        })
      ).value;
      const b = Coordinates.create(
        validProps({
          latitude: 6.2442,
          longitude: -75.5812,
          altitude: 1495
        })
      ).value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return false when latitude differs', () => {
      const a = Coordinates.create(
        validProps({ latitude: 6.2442, longitude: -75.5812 })
      ).value;
      const b = Coordinates.create(
        validProps({ latitude: 6.2443, longitude: -75.5812 })
      ).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when longitude differs', () => {
      const a = Coordinates.create(
        validProps({ longitude: -75.5812 })
      ).value;
      const b = Coordinates.create(
        validProps({ longitude: -75.5813 })
      ).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when altitude differs', () => {
      const a = Coordinates.create(
        validProps({ altitude: 1000 })
      ).value;
      const b = Coordinates.create(
        validProps({ altitude: 2000 })
      ).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when one has altitude and the other does not', () => {
      const a = Coordinates.create(
        validProps({ altitude: 1000 })
      ).value;
      const b = Coordinates.create(validProps()).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const a = Coordinates.create(validProps()).value;

      expect(a.equals(null as unknown as Coordinates)).toBe(false);
    });

    it('should return false when compared to undefined', () => {
      const a = Coordinates.create(validProps()).value;

      expect(a.equals(undefined as unknown as Coordinates)).toBe(
        false
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should freeze the internal props object', () => {
      const coords = Coordinates.create(validProps()).value;

      expect(() => {
        // @ts-expect-error — testing runtime immutability
        coords._props.latitude = 99;
      }).toThrow();
    });

    it('should freeze the Coordinates instance itself', () => {
      const coords = Coordinates.create(validProps()).value;

      expect(Object.isFrozen(coords)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('real-world scenarios', () => {
    it('should represent Medellín, Colombia coordinates', () => {
      const result = Coordinates.create({
        latitude: 6.2442,
        longitude: -75.5812,
        altitude: 1495
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.toString()).toBe('6.2442, -75.5812, 1495m');
    });

    it('should represent coordinates on the Prime Meridian and Equator', () => {
      const result = Coordinates.create({
        latitude: 0,
        longitude: 0
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.latitude).toBe(0);
      expect(result.value.longitude).toBe(0);
      expect(result.value.hasAltitude()).toBe(false);
    });

    it('should represent the North Pole coordinates', () => {
      const result = Coordinates.create({
        latitude: 90,
        longitude: 0
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.latitude).toBe(90);
    });

    it('should represent the South Pole coordinates', () => {
      const result = Coordinates.create({
        latitude: -90,
        longitude: 0
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.latitude).toBe(-90);
    });

    it('should represent coordinates with high decimal precision', () => {
      const result = Coordinates.create({
        latitude: 40.712776,
        longitude: -74.005974
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.latitude).toBe(40.712776);
      expect(result.value.longitude).toBe(-74.005974);
    });
  });
});
