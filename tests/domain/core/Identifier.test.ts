import { Identifier } from '../../../src/domain';

// Create subclasses for DDD identity comparison tests
class UserId extends Identifier<string> {}
class OrderId extends Identifier<string> {}

describe('Identifier', () => {
  it('should store and return the internal value', () => {
    const value = '123';
    const id = new Identifier(value);
    expect(id.toValue()).toBe(value);
  });

  it('should convert the identifier to a string', () => {
    const value = 42;
    const id = new Identifier(value);
    expect(id.toString()).toBe('42');
  });

  describe('equals()', () => {
    it('should return true for identifiers of the same class and same value', () => {
      const id1 = new UserId('abc');
      const id2 = new UserId('abc');

      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for identifiers with different values', () => {
      const id1 = new UserId('abc');
      const id2 = new UserId('xyz');

      expect(id1.equals(id2)).toBe(false);
    });

    it('should return false when comparing with null or undefined', () => {
      const id = new UserId('abc');

      expect(id.equals(null)).toBe(false);
      expect(id.equals(undefined)).toBe(false);
    });

    it('should return false when comparing identifiers of different classes', () => {
      const userId = new UserId('same-value');
      const orderId = new OrderId('same-value');

      expect(userId.equals(orderId)).toBe(false);
    });

    it('should return true for two base Identifier instances with the same value', () => {
      const id1 = new Identifier('xyz');
      const id2 = new Identifier('xyz');

      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for two base Identifier instances with different values', () => {
      const id1 = new Identifier('123');
      const id2 = new Identifier('456');

      expect(id1.equals(id2)).toBe(false);
    });
  });
});
