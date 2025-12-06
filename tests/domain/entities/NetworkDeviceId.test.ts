import { NetworkDeviceId } from '../../../src/domain/entities/NetworkDeviceId';
import { UniqueEntityID } from '../../../src/domain/shared/kernel';

describe('NetworkDeviceId', () => {
  it('should create a new UUID when no id is provided', () => {
    const deviceId = new NetworkDeviceId();
    const value = deviceId.toValue();

    expect(deviceId).toBeInstanceOf(NetworkDeviceId);
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(10); // UUID formatting expected
  });

  it('should accept a provided string UUID', () => {
    const rawId = '550e8400-e29b-41d4-a716-446655440000';
    const deviceId = new NetworkDeviceId(rawId);

    expect(deviceId.toValue()).toBe(rawId);
  });

  it('should accept a numeric ID', () => {
    const rawId = 12345;
    const deviceId = new NetworkDeviceId(rawId);

    expect(deviceId.toValue()).toBe(rawId);
  });

  it('create() should instantiate correctly', () => {
    const id = 'device-test-id';
    const deviceId = NetworkDeviceId.create(id);

    expect(deviceId).toBeInstanceOf(NetworkDeviceId);
    expect(deviceId.toValue()).toBe(id);
  });

  it('should be compatible with UniqueEntityID (identity comparison)', () => {
    const idA = new NetworkDeviceId('id-test');
    const idB = new UniqueEntityID('id-test');

    expect(idA.equals(idB)).toBe(true);
  });

  it('should not be equal when ID values differ', () => {
    const idA = new NetworkDeviceId('id-one');
    const idB = new NetworkDeviceId('id-two');

    expect(idA.equals(idB)).toBe(false);
  });
});
