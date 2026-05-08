// Source: src/presentation/http/validation/vendor.schemas.ts

import {
  createVendorSchema,
  updateVendorSchema,
  getVendorByIdSchema,
  deleteVendorSchema,
  listVendorsSchema
} from '../../../../src/presentation/http/validation/vendor.schemas';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ---------------------------------------------------------------------------

describe('createVendorSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a minimal valid body with name and slug only', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'Mikrotik', slug: 'mikrotik' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a body with a non-null description', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'Mikrotik', slug: 'mikrotik', description: 'Network gear' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept description: null', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'Mikrotik', slug: 'mikrotik', description: null }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a slug with a hyphen (e.g. "tp-link")', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'TP-Link', slug: 'tp-link' }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — name', () => {
    it('should reject when name is an empty string', () => {
      const result = createVendorSchema.safeParse({
        body: { name: '', slug: 'mikrotik' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject when name exceeds 100 characters', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'A'.repeat(101), slug: 'mikrotik' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject when name is missing from body', () => {
      const result = createVendorSchema.safeParse({
        body: { slug: 'mikrotik' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — slug', () => {
    it('should reject when slug is missing from body', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'Mikrotik' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a slug with spaces ("My Vendor")', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'My Vendor', slug: 'My Vendor' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a slug with uppercase letters ("MIKROTIK")', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'Mikrotik', slug: 'MIKROTIK' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a slug starting with a hyphen ("-mikrotik")', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'Mikrotik', slug: '-mikrotik' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — description', () => {
    it('should reject when description exceeds 500 characters', () => {
      const result = createVendorSchema.safeParse({
        body: { name: 'Mikrotik', slug: 'mikrotik', description: 'D'.repeat(501) }
      });

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('updateVendorSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a body with only name', () => {
      const result = updateVendorSchema.safeParse({
        params: { id: VALID_UUID },
        body: { name: 'Mikrotik Updated' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a body with only slug', () => {
      const result = updateVendorSchema.safeParse({
        params: { id: VALID_UUID },
        body: { slug: 'mikrotik-updated' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a body with only description', () => {
      const result = updateVendorSchema.safeParse({
        params: { id: VALID_UUID },
        body: { description: 'Updated description' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a body with all three fields', () => {
      const result = updateVendorSchema.safeParse({
        params: { id: VALID_UUID },
        body: { name: 'New Name', slug: 'new-name', description: 'desc' }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — empty body', () => {
    it('should reject when no fields are provided (refine fails)', () => {
      const result = updateVendorSchema.safeParse({
        params: { id: VALID_UUID },
        body: {}
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — invalid id param', () => {
    it('should reject when id param is not a valid UUID', () => {
      const result = updateVendorSchema.safeParse({
        params: { id: 'not-a-uuid' },
        body: { name: 'Mikrotik' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — invalid slug in body', () => {
    it('should reject a slug with invalid format in an update body', () => {
      const result = updateVendorSchema.safeParse({
        params: { id: VALID_UUID },
        body: { slug: 'INVALID SLUG' }
      });

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('getVendorByIdSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a valid UUID v4 param', () => {
      const result = getVendorByIdSchema.safeParse({
        params: { id: VALID_UUID }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors', () => {
    it('should reject a plain string that is not a UUID', () => {
      const result = getVendorByIdSchema.safeParse({
        params: { id: 'not-a-uuid' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty string', () => {
      const result = getVendorByIdSchema.safeParse({
        params: { id: '' }
      });

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('deleteVendorSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a valid UUID v4 param', () => {
      const result = deleteVendorSchema.safeParse({
        params: { id: VALID_UUID }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors', () => {
    it('should reject a plain string that is not a UUID', () => {
      const result = deleteVendorSchema.safeParse({
        params: { id: 'not-a-uuid' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty string', () => {
      const result = deleteVendorSchema.safeParse({
        params: { id: '' }
      });

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('listVendorsSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept an empty query object', () => {
      const result = listVendorsSchema.safeParse({ query: {} });

      expect(result.success).toBe(true);
    });

    it('should accept valid limit and offset strings', () => {
      const result = listVendorsSchema.safeParse({
        query: { limit: '10', offset: '0' }
      });

      expect(result.success).toBe(true);
    });

    it('should transform the limit string "10" to the number 10', () => {
      const result = listVendorsSchema.safeParse({
        query: { limit: '10' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.limit).toBe(10);
      }
    });

    it('should transform the offset string "5" to the number 5', () => {
      const result = listVendorsSchema.safeParse({
        query: { offset: '5' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.offset).toBe(5);
      }
    });

    it('should accept limit = 1 (minimum allowed)', () => {
      const result = listVendorsSchema.safeParse({
        query: { limit: '1' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept limit = 100 (maximum allowed)', () => {
      const result = listVendorsSchema.safeParse({
        query: { limit: '100' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept offset = 0', () => {
      const result = listVendorsSchema.safeParse({
        query: { offset: '0' }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — limit', () => {
    it('should reject limit = 0', () => {
      const result = listVendorsSchema.safeParse({
        query: { limit: '0' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject limit = 101 (above maximum)', () => {
      const result = listVendorsSchema.safeParse({
        query: { limit: '101' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a non-numeric limit string', () => {
      const result = listVendorsSchema.safeParse({
        query: { limit: 'abc' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — offset', () => {
    it('should reject a negative offset', () => {
      const result = listVendorsSchema.safeParse({
        query: { offset: '-1' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a non-numeric offset string', () => {
      const result = listVendorsSchema.safeParse({
        query: { offset: 'xyz' }
      });

      expect(result.success).toBe(false);
    });
  });
});
