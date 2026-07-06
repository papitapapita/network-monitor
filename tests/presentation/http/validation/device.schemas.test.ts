// Source: src/presentation/http/validation/device.schemas.ts

import {
  createDeviceSchema,
  listDevicesSchema,
  getDeviceByIdSchema,
  updateDeviceSchema
} from '../../../../src/presentation/http/validation/device.schemas';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const MODEL_UUID = '550e8400-e29b-41d4-a716-446655440000';

/** Minimal valid body for createDeviceSchema. */
const validCreateBody = {
  deviceModelId: MODEL_UUID,
  name: 'Core-Router-01',
  ownerType: 'COMPANY'
} as const;

// ---------------------------------------------------------------------------

describe('createDeviceSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a minimal valid body with only required fields', () => {
      const result = createDeviceSchema.safeParse({ body: validCreateBody });

      expect(result.success).toBe(true);
    });

    it('should accept a fully populated body with all optional fields', () => {
      const result = createDeviceSchema.safeParse({
        body: {
          deviceModelId: MODEL_UUID,
          name: 'Core-Router-01',
          ownerType: 'COMPANY',
          status: 'ACTIVE',
          category: 'WIRELESS_CPE',
          locationId: VALID_UUID,
          serialNumber: 'SN-2024-XYZ-001',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          ipAddress: '192.168.1.1',
          description: 'Primary core router',
          installedDate: '2024-01-15T00:00:00.000Z',
          monitoringEnabled: true
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept all valid status values', () => {
      const statuses = [
        'INVENTORY',
        'ACTIVE',
        'DAMAGED'
      ] as const;

      for (const status of statuses) {
        const result = createDeviceSchema.safeParse({
          body: { ...validCreateBody, status }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid category values', () => {
      const categories = [
        'CPE',
        'WIRELESS_CPE',
        'AP',
        'ROUTERBOARD',
        'SMART_SWITCH',
        'SMART_SWITCH_POE',
        'OTHER'
      ] as const;

      for (const category of categories) {
        const result = createDeviceSchema.safeParse({
          body: { ...validCreateBody, category }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid ownerType values', () => {
      const ownerTypes = ['COMPANY', 'CLIENT'] as const;

      for (const ownerType of ownerTypes) {
        const result = createDeviceSchema.safeParse({
          body: { ...validCreateBody, ownerType }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept macAddress in colon-separated format', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, macAddress: 'AA:BB:CC:DD:EE:FF' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept macAddress in hyphen-separated format', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, macAddress: 'AA-BB-CC-DD-EE-FF' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a valid IPv4 address', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, ipAddress: '10.0.0.1' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a valid IPv6 address', () => {
      const result = createDeviceSchema.safeParse({
        body: {
          ...validCreateBody,
          ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a valid ISO 8601 installedDate', () => {
      const result = createDeviceSchema.safeParse({
        body: {
          ...validCreateBody,
          installedDate: '2024-01-15T00:00:00.000Z'
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept null for nullable optional fields', () => {
      const result = createDeviceSchema.safeParse({
        body: {
          ...validCreateBody,
          category: null,
          locationId: null,
          serialNumber: null,
          macAddress: null,
          ipAddress: null,
          description: null,
          installedDate: null
        }
      });

      expect(result.success).toBe(true);
    });

    it('should trim whitespace from name', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, name: '  Core-Router-01  ' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe('Core-Router-01');
      }
    });

    it('should accept monitoringEnabled as false', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, monitoringEnabled: false }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('missing required fields', () => {
    it('should fail when deviceModelId is missing', () => {
      const result = createDeviceSchema.safeParse({
        body: { name: 'Router', ownerType: 'COMPANY' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when name is missing', () => {
      const result = createDeviceSchema.safeParse({
        body: { deviceModelId: MODEL_UUID, ownerType: 'COMPANY' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when body is an empty object', () => {
      const result = createDeviceSchema.safeParse({ body: {} });

      expect(result.success).toBe(false);
    });

    it('should fail when body itself is missing', () => {
      const result = createDeviceSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceModelId validation', () => {
    it('should fail when deviceModelId is not a valid UUID v4', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, deviceModelId: 'not-a-uuid' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('deviceModelId')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/UUID v4/i);
      }
    });

    it('should fail when deviceModelId is an empty string', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, deviceModelId: '' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when deviceModelId is a UUID v1', () => {
      const result = createDeviceSchema.safeParse({
        body: {
          ...validCreateBody,
          deviceModelId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
        }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('name field validation', () => {
    it('should fail when name is an empty string', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, name: '' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when name exceeds 150 characters', () => {
      const result = createDeviceSchema.safeParse({
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
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, name: 'A'.repeat(150) }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('ownerType validation', () => {
    it('should fail when ownerType is an invalid enum value', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, ownerType: 'UNKNOWN' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('ownerType')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/COMPANY/);
      }
    });

    it('should fail when ownerType is lowercase', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, ownerType: 'company' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('status validation', () => {
    it('should fail when status is an invalid enum value', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, status: 'RETIRED' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('status')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/INVENTORY/);
      }
    });

    it('should fail when status is lowercase', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, status: 'active' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('category validation', () => {
    it('should fail when category is an invalid enum value', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, category: 'SWITCH' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('category')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/WIRELESS_CPE/);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('macAddress validation', () => {
    it('should fail when macAddress is in an invalid format', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, macAddress: 'AABBCCDDEEFF' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('macAddress')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/AA:BB:CC:DD:EE:FF/);
      }
    });

    it('should fail when macAddress has too few octets', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, macAddress: 'AA:BB:CC:DD:EE' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when macAddress mixes colons and hyphens', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, macAddress: 'AA:BB-CC:DD-EE:FF' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('ipAddress validation', () => {
    it('should fail when ipAddress is not a valid IP', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, ipAddress: 'not-an-ip' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when ipAddress has an out-of-range IPv4 octet', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, ipAddress: '192.168.1.999' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('installedDate validation', () => {
    it('should fail when installedDate is not a valid ISO 8601 string', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, installedDate: '15/01/2024' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('installedDate')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/ISO 8601/i);
      }
    });

    it('should fail when installedDate is a plain date string without time', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, installedDate: '2024-01-15' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('serialNumber validation', () => {
    it('should fail when serialNumber exceeds 100 characters', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, serialNumber: 'X'.repeat(101) }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('serialNumber')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/100/);
      }
    });

    it('should accept a serialNumber of exactly 100 characters', () => {
      const result = createDeviceSchema.safeParse({
        body: { ...validCreateBody, serialNumber: 'X'.repeat(100) }
      });

      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------

describe('listDevicesSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept an empty query object (all params optional)', () => {
      const result = listDevicesSchema.safeParse({ query: {} });

      expect(result.success).toBe(true);
    });

    it('should accept valid limit and offset as numeric strings', () => {
      const result = listDevicesSchema.safeParse({
        query: { limit: '20', offset: '0' }
      });

      expect(result.success).toBe(true);
    });

    it('should transform limit from string to number', () => {
      const result = listDevicesSchema.safeParse({
        query: { limit: '50' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.limit).toBe(50);
        expect(typeof result.data.query.limit).toBe('number');
      }
    });

    it('should transform offset from string to number', () => {
      const result = listDevicesSchema.safeParse({
        query: { offset: '10' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.offset).toBe(10);
        expect(typeof result.data.query.offset).toBe('number');
      }
    });

    it('should accept limit at its minimum boundary of 1', () => {
      const result = listDevicesSchema.safeParse({ query: { limit: '1' } });

      expect(result.success).toBe(true);
    });

    it('should accept limit at its maximum boundary of 300', () => {
      const result = listDevicesSchema.safeParse({ query: { limit: '300' } });

      expect(result.success).toBe(true);
    });

    it('should accept offset of 0', () => {
      const result = listDevicesSchema.safeParse({ query: { offset: '0' } });

      expect(result.success).toBe(true);
    });

    it('should accept all valid status filter values', () => {
      const statuses = [
        'INVENTORY',
        'ACTIVE',
        'DAMAGED'
      ] as const;

      for (const status of statuses) {
        const result = listDevicesSchema.safeParse({ query: { status } });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid category filter values', () => {
      const categories = [
        'CPE',
        'WIRELESS_CPE',
        'AP',
        'ROUTERBOARD',
        'SMART_SWITCH',
        'SMART_SWITCH_POE',
        'OTHER'
      ] as const;

      for (const category of categories) {
        const result = listDevicesSchema.safeParse({ query: { category } });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid owner filter values', () => {
      const owners = ['COMPANY', 'CLIENT'] as const;

      for (const owner of owners) {
        const result = listDevicesSchema.safeParse({ query: { owner } });
        expect(result.success).toBe(true);
      }
    });

    it('should accept a valid UUID for locationId filter', () => {
      const result = listDevicesSchema.safeParse({
        query: { locationId: VALID_UUID }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a valid UUID for deviceModelId filter', () => {
      const result = listDevicesSchema.safeParse({
        query: { deviceModelId: MODEL_UUID }
      });

      expect(result.success).toBe(true);
    });

    it('should accept monitoringEnabled as "true" and transform to boolean true', () => {
      const result = listDevicesSchema.safeParse({
        query: { monitoringEnabled: 'true' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.monitoringEnabled).toBe(true);
        expect(typeof result.data.query.monitoringEnabled).toBe('boolean');
      }
    });

    it('should accept monitoringEnabled as "false" and transform to boolean false', () => {
      const result = listDevicesSchema.safeParse({
        query: { monitoringEnabled: 'false' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.monitoringEnabled).toBe(false);
        expect(typeof result.data.query.monitoringEnabled).toBe('boolean');
      }
    });

    it('should accept all valid sortBy values', () => {
      const sortByValues = [
        'createdAt',
        'updatedAt',
        'name',
        'status'
      ] as const;

      for (const sortBy of sortByValues) {
        const result = listDevicesSchema.safeParse({ query: { sortBy } });
        expect(result.success).toBe(true);
      }
    });

    it('should accept sortOrder ASC and DESC', () => {
      for (const sortOrder of ['ASC', 'DESC'] as const) {
        const result = listDevicesSchema.safeParse({ query: { sortOrder } });
        expect(result.success).toBe(true);
      }
    });

    it('should accept search as a free-text string', () => {
      const result = listDevicesSchema.safeParse({
        query: { search: 'Core-Router' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept all filters combined', () => {
      const result = listDevicesSchema.safeParse({
        query: {
          limit: '10',
          offset: '0',
          status: 'ACTIVE',
          category: 'WIRELESS_CPE',
          owner: 'COMPANY',
          locationId: VALID_UUID,
          deviceModelId: MODEL_UUID,
          monitoringEnabled: 'true',
          search: 'Router',
          sortBy: 'name',
          sortOrder: 'ASC'
        }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('limit validation', () => {
    it('should fail when limit is 0 (below minimum of 1)', () => {
      const result = listDevicesSchema.safeParse({ query: { limit: '0' } });

      expect(result.success).toBe(false);
      if (!result.success) {
        const limitError = result.error.issues.find((i) =>
          i.path.includes('limit')
        );
        expect(limitError).toBeDefined();
        expect(limitError!.message).toMatch(/1/);
      }
    });

    it('should fail when limit is 301 (above maximum of 300)', () => {
      const result = listDevicesSchema.safeParse({ query: { limit: '301' } });

      expect(result.success).toBe(false);
      if (!result.success) {
        const limitError = result.error.issues.find((i) =>
          i.path.includes('limit')
        );
        expect(limitError).toBeDefined();
        expect(limitError!.message).toMatch(/300/);
      }
    });

    it('should fail when limit is a non-numeric string', () => {
      const result = listDevicesSchema.safeParse({ query: { limit: 'abc' } });

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
      const result = listDevicesSchema.safeParse({ query: { limit: '10.5' } });

      expect(result.success).toBe(false);
    });

    it('should fail when limit is a negative number string', () => {
      const result = listDevicesSchema.safeParse({ query: { limit: '-1' } });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('offset validation', () => {
    it('should fail when offset is a non-numeric string', () => {
      const result = listDevicesSchema.safeParse({ query: { offset: 'xyz' } });

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
      const result = listDevicesSchema.safeParse({ query: { offset: '2.5' } });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('status filter validation', () => {
    it('should fail when status is an invalid enum value', () => {
      const result = listDevicesSchema.safeParse({
        query: { status: 'RETIRED' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('status')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/INVENTORY/);
      }
    });

    it('should fail when status is lowercase', () => {
      const result = listDevicesSchema.safeParse({
        query: { status: 'active' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('category filter validation', () => {
    it('should fail when category is an invalid enum value', () => {
      const result = listDevicesSchema.safeParse({
        query: { category: 'SWITCH' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('category')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/WIRELESS_CPE/);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('owner filter validation', () => {
    it('should fail when owner is an invalid enum value', () => {
      const result = listDevicesSchema.safeParse({
        query: { owner: 'PARTNER' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('owner')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/COMPANY/);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('locationId and deviceModelId filter validation', () => {
    it('should fail when locationId is not a valid UUID v4', () => {
      const result = listDevicesSchema.safeParse({
        query: { locationId: 'not-a-uuid' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('locationId')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/UUID v4/i);
      }
    });

    it('should fail when deviceModelId is not a valid UUID v4', () => {
      const result = listDevicesSchema.safeParse({
        query: { deviceModelId: 'bad-id' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('deviceModelId')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/UUID v4/i);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('monitoringEnabled filter validation', () => {
    it('should fail when monitoringEnabled is not "true" or "false"', () => {
      const result = listDevicesSchema.safeParse({
        query: { monitoringEnabled: 'yes' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('monitoringEnabled')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/true or false/i);
      }
    });

    it('should fail when monitoringEnabled is "1" or "0"', () => {
      for (const val of ['1', '0']) {
        const result = listDevicesSchema.safeParse({
          query: { monitoringEnabled: val }
        });
        expect(result.success).toBe(false);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('sortBy validation', () => {
    it('should fail when sortBy is an invalid value', () => {
      const result = listDevicesSchema.safeParse({
        query: { sortBy: 'unknown' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('sortOrder validation', () => {
    it('should fail when sortOrder is not ASC or DESC', () => {
      const result = listDevicesSchema.safeParse({
        query: { sortOrder: 'asc' }
      });

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('getDeviceByIdSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a valid UUID v4', () => {
      const result = getDeviceByIdSchema.safeParse({
        params: { id: VALID_UUID }
      });

      expect(result.success).toBe(true);
    });

    it('should accept another valid UUID v4 variant', () => {
      const result = getDeviceByIdSchema.safeParse({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a UUID v4 with uppercase hex digits (case-insensitive regex)', () => {
      const result = getDeviceByIdSchema.safeParse({
        params: { id: 'F47AC10B-58CC-4372-A567-0E02B2C3D479' }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('invalid id values', () => {
    it('should fail when id is a random non-UUID string', () => {
      const result = getDeviceByIdSchema.safeParse({
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
      const result = getDeviceByIdSchema.safeParse({
        params: { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is a UUID v3', () => {
      const result = getDeviceByIdSchema.safeParse({
        params: { id: '6fa459ea-ee8a-3ca4-894e-db77e160355e' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is a UUID v5', () => {
      const result = getDeviceByIdSchema.safeParse({
        params: { id: '886313e1-3b8a-5372-9b90-0c9aee199e5d' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is an empty string', () => {
      const result = getDeviceByIdSchema.safeParse({ params: { id: '' } });

      expect(result.success).toBe(false);
    });

    it('should fail when id is a UUID without hyphens', () => {
      const result = getDeviceByIdSchema.safeParse({
        params: { id: 'f47ac10b58cc4372a5670e02b2c3d479' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when params is missing the id field', () => {
      const result = getDeviceByIdSchema.safeParse({ params: {} });

      expect(result.success).toBe(false);
    });

    it('should fail when params itself is missing', () => {
      const result = getDeviceByIdSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('updateDeviceSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path — params', () => {
    it('should accept a valid UUID v4 in params.id', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: {}
      });

      expect(result.success).toBe(true);
    });

    it('should accept a UUID v4 with uppercase hex digits (case-insensitive regex)', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: 'F47AC10B-58CC-4372-A567-0E02B2C3D479' },
        body: {}
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('happy path — body', () => {
    it('should accept an empty body (all fields optional)', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: {}
      });

      expect(result.success).toBe(true);
    });

    it('should accept a fully populated body with all updatable fields', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: {
          name: 'Core-Router-Updated',
          status: 'ACTIVE',
          category: 'WIRELESS_CPE',
          ownerType: 'COMPANY',
          locationId: VALID_UUID,
          serialNumber: 'SN-UPDATED-001',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          ipAddress: '10.0.0.1',
          description: 'Updated description',
          installedDate: '2024-06-01T00:00:00.000Z',
          monitoringEnabled: true
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept null for all nullable optional fields (explicit clear)', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: {
          category: null,
          locationId: null,
          serialNumber: null,
          macAddress: null,
          ipAddress: null,
          description: null,
          installedDate: null
        }
      });

      expect(result.success).toBe(true);
    });

    it('should accept all valid status values', () => {
      const statuses = [
        'INVENTORY',
        'ACTIVE',
        'DAMAGED'
      ] as const;

      for (const status of statuses) {
        const result = updateDeviceSchema.safeParse({
          params: { id: VALID_UUID },
          body: { status }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid category values', () => {
      const categories = [
        'CPE',
        'WIRELESS_CPE',
        'AP',
        'ROUTERBOARD',
        'SMART_SWITCH',
        'SMART_SWITCH_POE',
        'OTHER'
      ] as const;

      for (const category of categories) {
        const result = updateDeviceSchema.safeParse({
          params: { id: VALID_UUID },
          body: { category }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid ownerType values', () => {
      for (const ownerType of ['COMPANY', 'CLIENT'] as const) {
        const result = updateDeviceSchema.safeParse({
          params: { id: VALID_UUID },
          body: { ownerType }
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept macAddress in colon-separated format', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { macAddress: 'AA:BB:CC:DD:EE:FF' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept macAddress in hyphen-separated format', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { macAddress: 'AA-BB-CC-DD-EE-FF' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a valid IPv4 address', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { ipAddress: '192.168.1.1' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a valid IPv6 address', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' }
      });

      expect(result.success).toBe(true);
    });

    it('should trim whitespace from name', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { name: '  Core-Router-Updated  ' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe('Core-Router-Updated');
      }
    });

    it('should accept a valid ISO 8601 installedDate', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { installedDate: '2024-06-01T00:00:00.000Z' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept monitoringEnabled as false', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { monitoringEnabled: false }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('params.id validation', () => {
    it('should fail when id is not a valid UUID v4', () => {
      const result = updateDeviceSchema.safeParse({
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

    it('should fail when id is a UUID v1', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
        body: {}
      });

      expect(result.success).toBe(false);
    });

    it('should fail when id is an empty string', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: '' },
        body: {}
      });

      expect(result.success).toBe(false);
    });

    it('should fail when params is missing', () => {
      const result = updateDeviceSchema.safeParse({ body: {} });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('body field validation', () => {
    it('should fail when name is an empty string', () => {
      const result = updateDeviceSchema.safeParse({
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
      const result = updateDeviceSchema.safeParse({
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

    it('should fail when status is an invalid enum value', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { status: 'RETIRED' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('status')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/INVENTORY/);
      }
    });

    it('should fail when category is an invalid enum value', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { category: 'SWITCH' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('category')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/WIRELESS_CPE/);
      }
    });

    it('should fail when ownerType is an invalid enum value', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { ownerType: 'UNKNOWN' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('ownerType')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/COMPANY/);
      }
    });

    it('should fail when locationId is not a valid UUID v4', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { locationId: 'not-a-uuid' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('locationId')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/UUID v4/i);
      }
    });

    it('should fail when serialNumber exceeds 100 characters', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { serialNumber: 'X'.repeat(101) }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('serialNumber')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/100/);
      }
    });

    it('should fail when macAddress is in an invalid format', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { macAddress: 'AABBCCDDEEFF' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('macAddress')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/AA:BB:CC:DD:EE:FF/);
      }
    });

    it('should fail when macAddress mixes colons and hyphens', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { macAddress: 'AA:BB-CC:DD-EE:FF' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when ipAddress is not a valid IP', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { ipAddress: 'not-an-ip' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when ipAddress has an out-of-range IPv4 octet', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { ipAddress: '192.168.1.999' }
      });

      expect(result.success).toBe(false);
    });

    it('should fail when installedDate is not a valid ISO 8601 string', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { installedDate: '15/06/2024' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) =>
          i.path.includes('installedDate')
        );
        expect(err).toBeDefined();
        expect(err!.message).toMatch(/ISO 8601/i);
      }
    });

    it('should fail when installedDate is a plain date string without time', () => {
      const result = updateDeviceSchema.safeParse({
        params: { id: VALID_UUID },
        body: { installedDate: '2024-06-01' }
      });

      expect(result.success).toBe(false);
    });
  });
});
