// Source: src/domain/shared/ids/TechnicianId.ts

import {
  TechnicianId,
  UniqueEntityID
} from '../../../../src/domain/shared';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('TechnicianId', () => {
  describe('create()', () => {
    it('should return a TechnicianId that is also a UniqueEntityID', () => {
      const id = TechnicianId.create();

      expect(id).toBeInstanceOf(TechnicianId);
      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should generate a valid UUID v4', () => {
      expect(TechnicianId.create().toValue()).toMatch(UUID_V4_REGEX);
    });

    it('should generate a distinct value on every call', () => {
      expect(TechnicianId.create().toValue()).not.toBe(
        TechnicianId.create().toValue()
      );
    });
  });

  describe('parse()', () => {
    it('should succeed for a valid UUID v4', () => {
      const result = TechnicianId.parse(VALID_UUID);

      expect(result.isSuccess).toBe(true);
      expect(result.value.toValue()).toBe(VALID_UUID);
    });

    it('should fail for a malformed UUID', () => {
      expect(TechnicianId.parse('not-a-uuid').isFailure).toBe(true);
    });

    it('should fail for an empty string', () => {
      expect(TechnicianId.parse('').isFailure).toBe(true);
    });

    it('should round-trip a generated id', () => {
      const original = TechnicianId.create();
      const parsed = TechnicianId.parse(original.toValue());

      expect(parsed.isSuccess).toBe(true);
      expect(parsed.value.equals(original)).toBe(true);
    });
  });

  describe('equals()', () => {
    it('should be true for two ids with the same value', () => {
      const a = TechnicianId.parse(VALID_UUID).value;
      const b = TechnicianId.parse(VALID_UUID).value;

      expect(a.equals(b)).toBe(true);
    });

    it('should be false for different values', () => {
      expect(
        TechnicianId.create().equals(TechnicianId.create())
      ).toBe(false);
    });

    it('should be false against undefined', () => {
      expect(
        TechnicianId.create().equals(
          undefined as unknown as UniqueEntityID
        )
      ).toBe(false);
    });
  });
});
