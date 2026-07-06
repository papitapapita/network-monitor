// Source: src/presentation/http/validation/location.schemas.ts

import {
  createLocationSchema,
  listLocationsSchema,
  getLocationByIdSchema,
  updateLocationSchema
} from '../../../../src/presentation/http/validation/location.schemas';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** A UUID v4 that satisfies the UUID_REGEX used in the schema. */
const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/** Minimal valid body for createLocationSchema. */
const validCreateBody = {
  name: 'Torre Norte',
  type: 'TOWER'
} as const;

// ---------------------------------------------------------------------------

describe('createLocationSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a minimal valid body with only required fields', () => {
      const result = createLocationSchema.safeParse({
        body: validCreateBody
      });

      expect(result.success).toBe(true);
    });

    it('should accept a fully populated body with all optional fields', () => {
      const result = createLocationSchema.safeParse({
        body: {
          name: 'DataCenter Sul',
          type: 'DATACENTER',
          municipality: 'São Paulo',
          neighborhood: 'Centro',
          address: 'Av. Paulista, 1000',
          latitude: -23.561684,
          longitude: -46.655981,
          altitude: 760
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept when both latitude and longitude are omitted', () => {
      const result = createLocationSchema.safeParse({
        body: { name: 'POP Site Alpha', type: 'POINT_OF_PRESENCE' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept when both latitude and longitude are provided', () => {
      const result = createLocationSchema.safeParse({
        body: {
          ...validCreateBody,
          latitude: 6.2442,
          longitude: -75.5812
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept altitude when latitude and longitude are also provided', () => {
      const result = createLocationSchema.safeParse({
        body: {
          ...validCreateBody,
          latitude: 4.6097,
          longitude: -74.0817,
          altitude: 2600
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept altitude when latitude and longitude are omitted', () => {
      // altitude has no coordinate dependency rule in the schema
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, altitude: 1500 }
      });

      expect(result.success).toBe(true);
    });

    it('should trim whitespace from name before validation', () => {
      const result = createLocationSchema.safeParse({
        body: { name: '  Torre Norte  ', type: 'TOWER' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept all valid location type values', () => {
      const validTypes = [
        'TOWER',
        'DATACENTER',
        'POINT_OF_PRESENCE',
        'OFFICE',
        'CUSTOMER_PREMISES',
        'OTHER'
      ] as const;

      for (const type of validTypes) {
        const result = createLocationSchema.safeParse({
          body: { name: 'Location', type }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept null latitude and longitude (treated as absent)', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, latitude: null, longitude: null }
      });

      expect(result.success).toBe(true);
    });

    it('should accept latitude and longitude at their exact boundary values', () => {
      const boundaries = [
        { latitude: -90, longitude: -180 },
        { latitude: 90, longitude: 180 },
        { latitude: 0, longitude: 0 }
      ];

      for (const { latitude, longitude } of boundaries) {
        const result = createLocationSchema.safeParse({
          body: { ...validCreateBody, latitude, longitude }
        });
        expect(result.success).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('missing required fields', () => {
    it('should fail when name is missing', () => {
      const result = createLocationSchema.safeParse({
        body: { type: 'TOWER' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when type is missing', () => {
      const result = createLocationSchema.safeParse({
        body: { name: 'Torre Norte' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when body is an empty object', () => {
      const result = createLocationSchema.safeParse({ body: {} });

      expect(result.success).toBe(false);
    });

    it('should fail when body itself is missing', () => {
      const result = createLocationSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('name field validation', () => {
    it('should fail when name is an empty string', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, name: '' }
      });

      expect(result.success).toBe(false);
    });

    it('should parse whitespace-only name to an empty string (Zod v4 trim is a transform, not a validator)', () => {
      // In Zod v4, .trim() is a post-parse transform: it converts the output
      // value but does NOT cause a validation failure on its own. A name of
      // '   ' passes .min(1) because min checks the original string length (3).
      // The resulting data.body.name will be '' after the transform.
      // Domain-level rejection of empty-after-trim names is enforced by the
      // use case (CreateLocationUseCase.beforeExecute), not the HTTP schema.
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, name: '   ' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe('');
      }
    });

    it('should fail when name exceeds 150 characters', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, name: 'A'.repeat(151) }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes('name')
        );
        expect(nameError).toBeDefined();
        expect(nameError!.message).toMatch(/150/);
      }
    });

    it('should accept a name of exactly 150 characters', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, name: 'A'.repeat(150) }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('type field validation', () => {
    it('should fail when type is an invalid enum value', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, type: 'INVALID_TYPE' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const typeError = result.error.issues.find((i) =>
          i.path.includes('type')
        );
        expect(typeError).toBeDefined();
        expect(typeError!.message).toMatch(/TOWER/);
      }
    });

    it('should fail when type is an empty string', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, type: '' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when type is lowercase', () => {
      // The schema uses z.enum which is case-sensitive
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, type: 'tower' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('coordinate coherence refinement', () => {
    it('should fail when only latitude is provided (longitude absent)', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, latitude: -23.561684 }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const coordError = result.error.issues.find((i) =>
          i.path.includes('latitude')
        );
        expect(coordError).toBeDefined();
        expect(coordError!.message).toMatch(/longitude/i);
      }
    });

    it('should fail when only longitude is provided (latitude absent)', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, longitude: -46.655981 }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const coordError = result.error.issues.find((i) =>
          i.path.includes('latitude')
        );
        expect(coordError).toBeDefined();
      }
    });

    it('should fail when latitude is provided but longitude is explicitly null', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, latitude: 10.0, longitude: null }
      });

      // latitude is a number (not null) while longitude is null — mismatched
      expect(result.success).toBe(false);
    });

    it('should fail when longitude is provided but latitude is explicitly null', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, latitude: null, longitude: 10.0 }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('latitude range validation', () => {
    it('should fail when latitude is below -90', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, latitude: -90.001, longitude: 0 }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const latError = result.error.issues.find((i) =>
          i.path.includes('latitude')
        );
        expect(latError).toBeDefined();
        expect(latError!.message).toMatch(/-90/);
      }
    });

    it('should fail when latitude exceeds 90', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, latitude: 90.001, longitude: 0 }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('longitude range validation', () => {
    it('should fail when longitude is below -180', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, latitude: 0, longitude: -180.001 }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const lonError = result.error.issues.find((i) =>
          i.path.includes('longitude')
        );
        expect(lonError).toBeDefined();
        expect(lonError!.message).toMatch(/-180/);
      }
    });

    it('should fail when longitude exceeds 180', () => {
      const result = createLocationSchema.safeParse({
        body: { ...validCreateBody, latitude: 0, longitude: 180.001 }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('altitude validation', () => {
    it('should fail when altitude is Infinity', () => {
      // Zod v4 rejects Infinity with code "invalid_type" (finite check).
      // The custom message passed to .finite() is not surfaced by Zod v4;
      // we only assert that the issue is reported on the altitude path.
      const result = createLocationSchema.safeParse({
        body: {
          ...validCreateBody,
          latitude: 0,
          longitude: 0,
          altitude: Infinity
        }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const altError = result.error.issues.find((i) =>
          i.path.includes('altitude')
        );
        expect(altError).toBeDefined();
      }
    });

    it('should fail when altitude is -Infinity', () => {
      const result = createLocationSchema.safeParse({
        body: {
          ...validCreateBody,
          latitude: 0,
          longitude: 0,
          altitude: -Infinity
        }
      });

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('listLocationsSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept an empty query object (all params optional)', () => {
      const result = listLocationsSchema.safeParse({ query: {} });

      expect(result.success).toBe(true);
    });

    it('should accept valid limit and offset as numeric strings', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '20', offset: '0' }
      });

      expect(result.success).toBe(true);
    });

    it('should transform limit from string to number', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '50' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.limit).toBe(50);
        expect(typeof result.data.query.limit).toBe('number');
      }
    });

    it('should transform offset from string to number', () => {
      const result = listLocationsSchema.safeParse({
        query: { offset: '10' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.offset).toBe(10);
        expect(typeof result.data.query.offset).toBe('number');
      }
    });

    it('should accept limit at its minimum boundary of 1', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '1' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept limit at its maximum boundary of 100', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '100' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept offset of 0', () => {
      const result = listLocationsSchema.safeParse({
        query: { offset: '0' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a valid type filter', () => {
      const result = listLocationsSchema.safeParse({
        query: { type: 'TOWER' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept all valid location types as filter', () => {
      const validTypes = [
        'TOWER',
        'DATACENTER',
        'POINT_OF_PRESENCE',
        'OFFICE',
        'CUSTOMER_PREMISES',
        'OTHER'
      ] as const;

      for (const type of validTypes) {
        const result = listLocationsSchema.safeParse({
          query: { type }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept limit, offset, and type together', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '10', offset: '5', type: 'TOWER' }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('limit validation', () => {
    it('should fail when limit is 0 (below minimum of 1)', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '0' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const limitError = result.error.issues.find((i) =>
          i.path.includes('limit')
        );
        expect(limitError).toBeDefined();
        expect(limitError!.message).toMatch(/1/);
      }
    });

    it('should fail when limit is 101 (above maximum of 100)', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '101' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const limitError = result.error.issues.find((i) =>
          i.path.includes('limit')
        );
        expect(limitError).toBeDefined();
        expect(limitError!.message).toMatch(/100/);
      }
    });

    it('should fail when limit is a non-numeric string', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: 'abc' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const limitError = result.error.issues.find((i) =>
          i.path.includes('limit')
        );
        expect(limitError).toBeDefined();
        expect(limitError!.message).toMatch(/integer/i);
      }
    });

    it('should fail when limit is a decimal string', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '10.5' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when limit is a negative number string', () => {
      const result = listLocationsSchema.safeParse({
        query: { limit: '-1' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('offset validation', () => {
    it('should fail when offset is a non-numeric string', () => {
      const result = listLocationsSchema.safeParse({
        query: { offset: 'xyz' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const offsetError = result.error.issues.find((i) =>
          i.path.includes('offset')
        );
        expect(offsetError).toBeDefined();
        expect(offsetError!.message).toMatch(/integer/i);
      }
    });

    it('should fail when offset is a decimal string', () => {
      const result = listLocationsSchema.safeParse({
        query: { offset: '2.5' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('type filter validation', () => {
    it('should fail when type is an invalid enum value', () => {
      const result = listLocationsSchema.safeParse({
        query: { type: 'INVALID_TYPE' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const typeError = result.error.issues.find((i) =>
          i.path.includes('type')
        );
        expect(typeError).toBeDefined();
        expect(typeError!.message).toMatch(/TOWER/);
      }
    });

    it('should fail when type is lowercase', () => {
      const result = listLocationsSchema.safeParse({
        query: { type: 'tower' }
      });

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('getLocationByIdSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a valid UUID v4', () => {
      const result = getLocationByIdSchema.safeParse({
        params: { id: VALID_UUID }
      });

      expect(result.success).toBe(true);
    });

    it('should accept another valid UUID v4 in a different variant', () => {
      const result = getLocationByIdSchema.safeParse({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a UUID v4 with uppercase hex digits', () => {
      // The regex uses the /i flag so uppercase is valid
      const result = getLocationByIdSchema.safeParse({
        params: { id: 'F47AC10B-58CC-4372-A567-0E02B2C3D479' }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('invalid id values', () => {
    it('should fail when id is a random non-UUID string', () => {
      const result = getLocationByIdSchema.safeParse({
        params: { id: 'not-a-uuid' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const idError = result.error.issues.find((i) =>
          i.path.includes('id')
        );
        expect(idError).toBeDefined();
        expect(idError!.message).toMatch(/UUID v4/i);
      }
    });

    it('should fail when id is a UUID v1 (version digit is not 4)', () => {
      // UUID v1: version segment is "1xxx"
      const result = getLocationByIdSchema.safeParse({
        params: { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is a UUID v3', () => {
      const result = getLocationByIdSchema.safeParse({
        params: { id: '6fa459ea-ee8a-3ca4-894e-db77e160355e' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is a UUID v5', () => {
      const result = getLocationByIdSchema.safeParse({
        params: { id: '886313e1-3b8a-5372-9b90-0c9aee199e5d' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is an empty string', () => {
      const result = getLocationByIdSchema.safeParse({
        params: { id: '' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is a UUID without hyphens', () => {
      const result = getLocationByIdSchema.safeParse({
        params: { id: 'f47ac10b58cc4372a5670e02b2c3d479' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when params is missing the id field', () => {
      const result = getLocationByIdSchema.safeParse({ params: {} });

      expect(result.success).toBe(false);
    });

    it('should fail when params itself is missing', () => {
      const result = getLocationByIdSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('updateLocationSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path — params', () => {
    it('should accept a valid UUID v4 in params.id', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: {}
      });

      expect(result.success).toBe(true);
    });

    it('should accept a UUID v4 with uppercase hex digits (case-insensitive regex)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: 'F47AC10B-58CC-4372-A567-0E02B2C3D479' },
        body: {}
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('happy path — body', () => {
    it('should accept an empty body (all fields optional)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: {}
      });

      expect(result.success).toBe(true);
    });

    it('should accept a body with only name', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { name: 'Torre Norte Revised' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a fully populated body with all updatable fields', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: {
          name: 'DataCenter Sul',
          type: 'DATACENTER',
          municipality: 'São Paulo',
          neighborhood: 'Centro',
          address: 'Av. Paulista, 1000',
          latitude: -23.561684,
          longitude: -46.655981,
          altitude: 760
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept when both latitude and longitude are provided', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: 6.2442, longitude: -75.5812 }
      });

      expect(result.success).toBe(true);
    });

    it('should accept when both latitude and longitude are null (coordinate clear)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: null, longitude: null }
      });

      expect(result.success).toBe(true);
    });

    it('should accept null for nullable address fields', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: {
          municipality: null,
          neighborhood: null,
          address: null
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept all valid location type values', () => {
      const validTypes = [
        'TOWER',
        'DATACENTER',
        'POINT_OF_PRESENCE',
        'OFFICE',
        'CUSTOMER_PREMISES',
        'OTHER'
      ] as const;

      for (const type of validTypes) {
        const result = updateLocationSchema.safeParse({
          params: { id: VALID_UUID },
          body: { type }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept latitude and longitude at their exact boundary values', () => {
      const boundaries = [
        { latitude: -90, longitude: -180 },
        { latitude: 90, longitude: 180 },
        { latitude: 0, longitude: 0 }
      ];

      for (const { latitude, longitude } of boundaries) {
        const result = updateLocationSchema.safeParse({
          params: { id: VALID_UUID },
          body: { latitude, longitude }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should trim whitespace from name', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { name: '  Torre Norte Revised  ' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe('Torre Norte Revised');
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('params.id validation', () => {
    it('should fail when id is not a valid UUID v4', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: 'not-a-uuid' },
        body: {}
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const idError = result.error.issues.find((i) =>
          i.path.includes('id')
        );
        expect(idError).toBeDefined();
        expect(idError!.message).toMatch(/UUID v4/i);
      }
    });

    it('should fail when id is a UUID v1 (version digit is not 4)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
        body: {}
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is an empty string', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: '' },
        body: {}
      });

      expect(result.success).toBe(false);
    });

    it('should fail when params is missing', () => {
      const result = updateLocationSchema.safeParse({ body: {} });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('coordinate coherence refinement', () => {
    it('should fail when only latitude is provided (longitude absent)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: -23.561684 }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const coordError = result.error.issues.find((i) =>
          i.path.includes('latitude')
        );
        expect(coordError).toBeDefined();
        expect(coordError!.message).toMatch(/longitude/i);
      }
    });

    it('should fail when only longitude is provided (latitude absent)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { longitude: -46.655981 }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const coordError = result.error.issues.find((i) =>
          i.path.includes('latitude')
        );
        expect(coordError).toBeDefined();
      }
    });

    it('should fail when latitude is a number but longitude is null (mismatch)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: 10.0, longitude: null }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when longitude is a number but latitude is null (mismatch)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: null, longitude: 10.0 }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('body field validation', () => {
    it('should fail when name is an empty string', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { name: '' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes('name')
        );
        expect(nameError).toBeDefined();
      }
    });

    it('should fail when name exceeds 150 characters', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { name: 'A'.repeat(151) }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes('name')
        );
        expect(nameError).toBeDefined();
        expect(nameError!.message).toMatch(/150/);
      }
    });

    it('should fail when type is an invalid enum value', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { type: 'INVALID_TYPE' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const typeError = result.error.issues.find((i) =>
          i.path.includes('type')
        );
        expect(typeError).toBeDefined();
        expect(typeError!.message).toMatch(/TOWER/);
      }
    });

    it('should fail when type is lowercase (enum is case-sensitive)', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { type: 'tower' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when municipality exceeds 100 characters', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { municipality: 'M'.repeat(101) }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('municipality')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/100/);
      }
    });

    it('should fail when neighborhood exceeds 150 characters', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { neighborhood: 'N'.repeat(151) }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('neighborhood')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/150/);
      }
    });

    it('should fail when address exceeds 255 characters', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { address: 'A'.repeat(256) }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('address')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/255/);
      }
    });

    it('should fail when latitude is below -90', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: -90.001, longitude: 0 }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const latError = result.error.issues.find((i) =>
          i.path.includes('latitude')
        );
        expect(latError).toBeDefined();
        expect(latError!.message).toMatch(/-90/);
      }
    });

    it('should fail when latitude exceeds 90', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: 90.001, longitude: 0 }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when longitude is below -180', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: 0, longitude: -180.001 }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const lonError = result.error.issues.find((i) =>
          i.path.includes('longitude')
        );
        expect(lonError).toBeDefined();
        expect(lonError!.message).toMatch(/-180/);
      }
    });

    it('should fail when longitude exceeds 180', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: 0, longitude: 180.001 }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when altitude is Infinity', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: 0, longitude: 0, altitude: Infinity }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const altError = result.error.issues.find((i) =>
          i.path.includes('altitude')
        );
        expect(altError).toBeDefined();
      }
    });

    it('should fail when altitude is -Infinity', () => {
      const result = updateLocationSchema.safeParse({
        params: { id: VALID_UUID },
        body: { latitude: 0, longitude: 0, altitude: -Infinity }
      });

      expect(result.success).toBe(false);
    });
  });
});
