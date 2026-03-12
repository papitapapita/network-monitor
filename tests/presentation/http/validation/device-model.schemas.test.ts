// Source: src/presentation/http/validation/device-model.schemas.ts

import {
  listDeviceModelsSchema,
  getDeviceModelByIdSchema
} from '../../../../src/presentation/http/validation/device-model.schemas';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** A UUID v4 that satisfies the UUID_REGEX used in the schema. */
const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ---------------------------------------------------------------------------

describe('listDeviceModelsSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept an empty query object', () => {
      const result = listDeviceModelsSchema.safeParse({ query: {} });

      expect(result.success).toBe(true);
    });

    it('should accept a valid limit', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '20' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a valid offset', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { offset: '0' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept both limit and offset together', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '10', offset: '20' }
      });

      expect(result.success).toBe(true);
    });

    it('should transform limit string to number', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '15' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.limit).toBe(15);
      }
    });

    it('should transform offset string to number', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { offset: '40' }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.offset).toBe(40);
      }
    });

    it('should accept limit = 1 (minimum)', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '1' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept limit = 100 (maximum)', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '100' }
      });

      expect(result.success).toBe(true);
    });

    it('should accept offset = 0', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { offset: '0' }
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — limit', () => {
    it('should reject limit = 0', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '0' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '101' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject non-numeric limit string', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: 'abc' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a decimal limit string', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '10.5' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a negative limit', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { limit: '-1' }
      });

      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors — offset', () => {
    it('should reject a negative offset', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { offset: '-1' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject non-numeric offset string', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { offset: 'abc' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a decimal offset string', () => {
      const result = listDeviceModelsSchema.safeParse({
        query: { offset: '5.5' }
      });

      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe('getDeviceModelByIdSchema', () => {
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('should accept a valid UUID v4 param', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: VALID_UUID }
      });

      expect(result.success).toBe(true);
    });

    it('should accept a UUID v4 with uppercase hex characters', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: 'F47AC10B-58CC-4372-A567-0E02B2C3D479' }
      });

      expect(result.success).toBe(true);
    });

    it('should pass through the id value unchanged', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: VALID_UUID }
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params.id).toBe(VALID_UUID);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('validation errors', () => {
    it('should reject a plain string that is not a UUID', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: 'not-a-uuid' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty string', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: '' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a UUID v1 (version digit is not 4)', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: '550e8400-e29b-11d4-a716-446655440000' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a UUID with missing hyphens', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: 'f47ac10b58cc4372a5670e02b2c3d479' }
      });

      expect(result.success).toBe(false);
    });

    it('should reject a UUID with extra characters', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: `${VALID_UUID}-extra` }
      });

      expect(result.success).toBe(false);
    });

    it('should include a descriptive error message for an invalid id', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: { id: 'bad-value' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message).join(' ');
        expect(messages.toLowerCase()).toContain('uuid');
      }
    });

    it('should reject when id param is missing', () => {
      const result = getDeviceModelByIdSchema.safeParse({
        params: {}
      });

      expect(result.success).toBe(false);
    });
  });
});
