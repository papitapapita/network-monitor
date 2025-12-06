import { UUID } from '../../../src/domain';
import { validate as validateUuid } from 'uuid';

describe('UUID Value Object', () => {
  it('should generate a valid UUID when no value is provided', () => {
    const result = UUID.create();

    expect(result.isSuccess).toBe(true);
    const uuid = result.value;
    expect(validateUuid(uuid.value)).toBe(true);
  });

  it('should create a valid UUID when a proper UUID string is provided', () => {
    const rawUuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = UUID.create(rawUuid);

    expect(result.isSuccess).toBe(true);
    expect(result.value.value).toBe(rawUuid);
  });

  it('should fail if an invalid UUID string is provided', () => {
    const result = UUID.create('not-a-uuid');

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('Invalid UUID format');
  });

  it('should return the UUID string via toString()', () => {
    const rawUuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = UUID.create(rawUuid);
    const uuid = result.value;

    expect(uuid.toString()).toBe(rawUuid);
  });

  it('should return the raw value via toValue()', () => {
    const rawUuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = UUID.create(rawUuid);
    const uuid = result.value;

    expect(uuid.toValue()).toBe(rawUuid);
  });

  it('equals() should return true when comparing two UUIDs with same value', () => {
    const uuid1 = UUID.create(
      '550e8400-e29b-41d4-a716-446655440000'
    ).value;
    const uuid2 = UUID.create(
      '550e8400-e29b-41d4-a716-446655440000'
    ).value;

    expect(uuid1.equals(uuid2)).toBe(true);
  });

  it('equals() should return false when comparing different UUIDs', () => {
    const uuid1 = UUID.create(
      '550e8400-e29b-41d4-a716-446655440000'
    ).value;
    const uuid2 = UUID.create(
      '11111111-1111-4111-8111-111111111111'
    ).value;

    expect(uuid1.equals(uuid2)).toBe(false);
  });

  it('equals() should return false when comparing with undefined', () => {
    const uuid1 = UUID.create().value;

    expect(uuid1.equals(undefined)).toBe(false);
  });

  it('isValid() should validate UUID format correctly', () => {
    expect(UUID.isValid('550e8400-e29b-41d4-a716-446655440000')).toBe(
      true
    );
    expect(UUID.isValid('invalid')).toBe(false);
  });
});
