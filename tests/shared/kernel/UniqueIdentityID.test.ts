import { UniqueEntityID } from '../../../src/domain/shared/kernel';

describe('UniqueEntityID', () => {
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('should generate a UUID when no ID is provided', () => {
    const id = new UniqueEntityID();

    const value = id.toValue();
    expect(typeof value).toBe('string');
    expect(UUID_REGEX.test(value as string)).toBe(true);
  });

  it('should use the provided id instead of generating one', () => {
    const customId = 'my-custom-id-123';
    const id = new UniqueEntityID(customId);

    expect(id.toValue()).toBe(customId);
  });

  it('should properly convert the ID to string', () => {
    const id = new UniqueEntityID(12345);
    expect(id.toString()).toBe('12345');
  });

  it('should compare equality between two UniqueEntityID instances with the same value', () => {
    const id1 = new UniqueEntityID('abc');
    const id2 = new UniqueEntityID('abc');

    expect(id1.equals(id2)).toBe(true);
  });

  it('should return false when comparing two UniqueEntityID instances with different values', () => {
    const id1 = new UniqueEntityID('abc');
    const id2 = new UniqueEntityID('xyz');

    expect(id1.equals(id2)).toBe(false);
  });

  it('should return false when comparing with null or undefined', () => {
    const id = new UniqueEntityID('abc');

    expect(id.equals(null)).toBe(false);
    expect(id.equals(undefined)).toBe(false);
  });

  it('should call generateUUID only when no value is passed', () => {
    const spy = jest.spyOn(UniqueEntityID as any, 'generateUUID');

    new UniqueEntityID(); // should trigger generation
    expect(spy).toHaveBeenCalledTimes(1);

    new UniqueEntityID('manual'); // should NOT trigger
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('should generate different UUIDs every time', () => {
    const id1 = new UniqueEntityID().toValue();
    const id2 = new UniqueEntityID().toValue();

    expect(id1).not.toBe(id2);
    expect(UUID_REGEX.test(id1 as string)).toBe(true);
    expect(UUID_REGEX.test(id2 as string)).toBe(true);
  });
});
