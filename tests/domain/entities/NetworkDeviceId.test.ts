import {
  Result,
  UniqueEntityID,
  NetworkDeviceId
} from '../../../src/domain';

class TestID extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<TestID> | TestID {
    const testID = new TestID(id);

    if (!testID) {
      return Result.fail<TestID>('Failed to create TestID');
    }

    return testID;
  }
}

describe('NetworkDeviceId', () => {
  it('should create a new UUID when no id is provided', () => {
    const deviceId = NetworkDeviceId.create();
    const value = deviceId.value;

    expect(value).toBeInstanceOf(NetworkDeviceId);
    expect(typeof value.toValue()).toBe('string');
    expect(value.toValue().length).toBeGreaterThan(10); // UUID formatting expected
  });

  it('should accept a provided string UUID', () => {
    const rawId = '550e8400-e29b-41d4-a716-446655440000';
    const deviceId = NetworkDeviceId.create(rawId);

    expect(deviceId.value.toValue()).toBe(rawId);
  });

  it('should not accept a numeric ID', () => {
    const rawId = 12345;
    const deviceId = NetworkDeviceId.create(
      rawId as unknown as string
    );

    expect(deviceId.isFailure).toBe(true);
  });

  it('should not be equal with UniqueEntityID (identity comparison)', () => {
    const idTest = 'c5228bee-15a8-420c-a5ca-39d209f944e5';
    const idA = NetworkDeviceId.create(idTest).value;
    const idB = TestID.create(idTest);

    expect(idA.equals(idB)).toBe(false);
  });

  it('should not be equal when ID values differ', () => {
    const idA = NetworkDeviceId.create(
      'c5228bee-15a8-420c-a5ca-39d209f944e5'
    ).value;
    const idB = NetworkDeviceId.create(
      'c5228bee-15a8-420c-a5ca-39d209f944e3'
    ).value;

    expect(idA.equals(idB)).toBe(false);
  });
});
