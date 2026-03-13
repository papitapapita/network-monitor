// Source: src/domain/shared/ids/PollingConfigurationId.ts

import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ANOTHER_VALID_UUID = '6ba7b814-9dad-41d1-80b4-00c04fd430c8';

describe('PollingConfigurationId', () => {
  // ===========================================================================
  describe('create()', () => {
    it('should generate a new PollingConfigurationId without arguments', () => {
      const id = PollingConfigurationId.create();

      expect(id).toBeInstanceOf(PollingConfigurationId);
    });

    it('should generate a non-empty UUID string', () => {
      const id = PollingConfigurationId.create();

      expect(id.toString()).toBeTruthy();
      expect(id.toString().length).toBeGreaterThan(0);
    });

    it('should generate unique IDs on each call', () => {
      const id1 = PollingConfigurationId.create();
      const id2 = PollingConfigurationId.create();

      expect(id1.toString()).not.toBe(id2.toString());
    });

    it('should produce a string that matches UUID v4 format', () => {
      const id = PollingConfigurationId.create();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(id.toString()).toMatch(uuidRegex);
    });
  });

  // ===========================================================================
  describe('parse()', () => {
    describe('happy path', () => {
      it('should return a successful Result for a valid UUID string', () => {
        const result = PollingConfigurationId.parse(VALID_UUID);

        expect(result.isSuccess).toBe(true);
      });

      it('should return a PollingConfigurationId instance', () => {
        const result = PollingConfigurationId.parse(VALID_UUID);

        expect(result.value).toBeInstanceOf(PollingConfigurationId);
      });

      it('should preserve the original UUID string as the value', () => {
        const result = PollingConfigurationId.parse(VALID_UUID);

        expect(result.value.toString()).toBe(VALID_UUID);
      });

      it('should parse a second distinct valid UUID', () => {
        const result = PollingConfigurationId.parse(ANOTHER_VALID_UUID);

        expect(result.isSuccess).toBe(true);
        expect(result.value.toString()).toBe(ANOTHER_VALID_UUID);
      });
    });

    describe('failure cases', () => {
      it('should fail for a non-UUID string', () => {
        const result = PollingConfigurationId.parse('not-a-uuid');

        expect(result.isFailure).toBe(true);
      });

      it('should fail for an empty string', () => {
        const result = PollingConfigurationId.parse('');

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a plain integer string', () => {
        const result = PollingConfigurationId.parse('12345');

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a UUID with a missing segment', () => {
        const result = PollingConfigurationId.parse('550e8400-e29b-41d4-a716');

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // ===========================================================================
  describe('equals()', () => {
    it('should return true for two IDs created from the same UUID string', () => {
      const id1 = PollingConfigurationId.parse(VALID_UUID).value;
      const id2 = PollingConfigurationId.parse(VALID_UUID).value;

      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for two IDs created from different UUID strings', () => {
      const id1 = PollingConfigurationId.parse(VALID_UUID).value;
      const id2 = PollingConfigurationId.parse(ANOTHER_VALID_UUID).value;

      expect(id1.equals(id2)).toBe(false);
    });

    it('should return false when comparing with undefined', () => {
      const id = PollingConfigurationId.parse(VALID_UUID).value;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(id.equals(undefined as any)).toBe(false);
    });
  });

  // ===========================================================================
  describe('toString()', () => {
    it('should return the UUID string from a parsed ID', () => {
      const id = PollingConfigurationId.parse(VALID_UUID).value;

      expect(id.toString()).toBe(VALID_UUID);
    });

    it('should return the UUID string from a generated ID', () => {
      const id = PollingConfigurationId.create();

      expect(typeof id.toString()).toBe('string');
    });
  });
});
