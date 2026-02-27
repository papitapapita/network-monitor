import { ValueObject } from '../../../src/domain/device-inventory';

interface FullNameProps {
  first: string;
  last: string;
}

// Concrete ValueObject for testing
class FullName extends ValueObject<FullNameProps> {
  get first() {
    return this._props.first;
  }

  get last() {
    return this._props.last;
  }
}

describe('ValueObject Base Class', () => {
  it('should store _props as an immutable (frozen) object', () => {
    const vo = new FullName({ first: 'John', last: 'Doe' });

    expect(Object.isFrozen(vo['_props'])).toBe(true);
  });

  it('should throw when trying to mutate properties', () => {
    const vo = new FullName({ first: 'Jane', last: 'Doe' });

    // @ts-expect-error Testing immutability
    expect(() => (vo['_props'].first = 'Hacked')).toThrow();
  });

  it('should consider two value objects with identical _props as equal', () => {
    const vo1 = new FullName({ first: 'John', last: 'Doe' });
    const vo2 = new FullName({ first: 'John', last: 'Doe' });

    expect(vo1.equals(vo2)).toBe(true);
  });

  it('should return false when _props differ', () => {
    const vo1 = new FullName({ first: 'John', last: 'Doe' });
    const vo2 = new FullName({ first: 'John', last: 'Smith' });

    expect(vo1.equals(vo2)).toBe(false);
  });

  it('should return false when comparing with null or undefined', () => {
    const vo = new FullName({ first: 'John', last: 'Doe' });

    expect(vo.equals(null as any)).toBe(false);
    expect(vo.equals(undefined)).toBe(false);
  });

  it('should return false when comparing with an object that is not a ValueObject', () => {
    const vo = new FullName({ first: 'John', last: 'Doe' });

    const fake = { _props: { first: 'John', last: 'Doe' } };

    expect(vo.equals(fake as any)).toBe(false);
  });

  it('should perform structural comparison (deep equality)', () => {
    class Address extends ValueObject<{
      city: string;
      meta: { zip: number };
    }> {}

    const vo1 = new Address({ city: 'NY', meta: { zip: 123 } });
    const vo2 = new Address({ city: 'NY', meta: { zip: 123 } });

    expect(vo1.equals(vo2)).toBe(true);
  });

  it('should return false when nested _props differ', () => {
    class Address extends ValueObject<{
      city: string;
      meta: { zip: number };
    }> {}

    const vo1 = new Address({ city: 'NY', meta: { zip: 123 } });
    const vo2 = new Address({ city: 'NY', meta: { zip: 456 } });

    expect(vo1.equals(vo2)).toBe(false);
  });

  it('should freeze the entire ValueObject instance', () => {
    const vo = new FullName({ first: 'John', last: 'Doe' });

    expect(Object.isFrozen(vo)).toBe(true);
  });
});
