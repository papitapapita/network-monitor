// Source: src/domain/shared/ids/TicketId.ts

import {
  TicketId,
  UniqueEntityID
} from '../../../../src/domain/shared';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_UUID = 'c5228bee-15a8-420c-a5ca-39d209f944e5';

describe('TicketId', () => {
  describe('create()', () => {
    it('should return a TicketId that is also a UniqueEntityID', () => {
      const id = TicketId.create();

      expect(id).toBeInstanceOf(TicketId);
      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should generate a valid UUID v4', () => {
      expect(TicketId.create().toValue()).toMatch(UUID_V4_REGEX);
    });

    it('should generate a distinct value on every call', () => {
      expect(TicketId.create().toValue()).not.toBe(
        TicketId.create().toValue()
      );
    });
  });

  describe('parse()', () => {
    it('should succeed for a valid UUID v4', () => {
      const result = TicketId.parse(VALID_UUID);

      expect(result.isSuccess).toBe(true);
      expect(result.value.toValue()).toBe(VALID_UUID);
    });

    it('should fail for a malformed UUID', () => {
      expect(TicketId.parse('not-a-uuid').isFailure).toBe(true);
    });

    it('should fail for an empty string', () => {
      expect(TicketId.parse('').isFailure).toBe(true);
    });

    it('should round-trip a generated id', () => {
      const original = TicketId.create();
      const parsed = TicketId.parse(original.toValue());

      expect(parsed.isSuccess).toBe(true);
      expect(parsed.value.equals(original)).toBe(true);
    });
  });

  describe('equals()', () => {
    it('should be true for two ids with the same value', () => {
      const a = TicketId.parse(VALID_UUID).value;
      const b = TicketId.parse(VALID_UUID).value;

      expect(a.equals(b)).toBe(true);
    });

    it('should be false for different values', () => {
      expect(TicketId.create().equals(TicketId.create())).toBe(false);
    });

    it('should be false against undefined', () => {
      expect(
        TicketId.create().equals(
          undefined as unknown as UniqueEntityID
        )
      ).toBe(false);
    });
  });
});
