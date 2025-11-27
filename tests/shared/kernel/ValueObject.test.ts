import { ValueObject } from '../../../src/domain/shared/kernel/ValueObject';

interface FullNameProps {
  first: string;
  last: string;
}

// Concrete ValueObject for testing
class FullName extends ValueObject<FullNameProps> {
  get first() {
    return this.props.first;
  }

  get last() {
    return this.props.last;
  }
}

describe('ValueObject Base Class', () => {
  it('should store props as an immutable (frozen) object', () => {
    const vo = new FullName({ first: 'John', last: 'Doe' });

    expect(Object.isFrozen(vo['props'])).toBe(true);
  });

  it('should throw when trying to mutate properties', () => {
    const vo = new FullName({ first: 'Jane', last: 'Doe' });

    expect(() => (vo['props'].first = 'Hacked')).toThrow();
  });

  it('should consider two value objects with identical props as equal', () => {
    const vo1 = new FullName({ first: 'John', last: 'Doe' });
    const vo2 = new FullName({ first: 'John', last: 'Doe' });

    expect(vo1.equals(vo2)).toBe(true);
  });

  it('should return false when props differ', () => {
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

    const fake = { props: { first: 'John', last: 'Doe' } };

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

  it('should return false when nested props differ', () => {
    class Address extends ValueObject<{
      city: string;
      meta: { zip: number };
    }> {}

    const vo1 = new Address({ city: 'NY', meta: { zip: 123 } });
    const vo2 = new Address({ city: 'NY', meta: { zip: 456 } });

    expect(vo1.equals(vo2)).toBe(false);
  });
});
