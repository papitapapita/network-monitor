import { Result } from '../../../src/domain/shared/kernel';

describe('Result<T>', () => {
  // ---------------------------
  // Construction rules
  // ---------------------------

  it('should create a successful Result with a value', () => {
    const result = Result.ok<number>(42);

    expect(result.isSuccess).toBe(true);
    expect(result.errorValue()).toBeUndefined();
    expect(result.getValue()).toBe(42);
  });

  it('should create a successful Result with no value', () => {
    const result = Result.ok();

    expect(result.isSuccess).toBe(true);
    expect(result.errorValue()).toBeUndefined();
    expect(result.getValue()).toBeUndefined();
  });

  it('should create a failure Result with an error message', () => {
    const result = Result.fail<number>('Something went wrong');

    expect(result.isSuccess).toBe(false);
    expect(result.errorValue()).toBe('Something went wrong');
  });

  // ---------------------------
  // Invalid construction
  // ---------------------------

  it('should throw if success is true but error is provided', () => {
    expect(
      () => new (Result as any)(true, 'Invalid error', undefined)
    ).toThrow(
      'InvalidOperation: A result cannot be successful and contain an error'
    );
  });

  it('should throw if success is false but no error is provided', () => {
    expect(
      () => new (Result as any)(false, undefined, undefined)
    ).toThrow(
      'InvalidOperation: A failing result needs to contain an error message'
    );
  });

  // ---------------------------
  // getValue() and errorValue()
  // ---------------------------

  it('should throw when calling getValue() on a failure result', () => {
    const result = Result.fail('Failed');

    expect(() => result.getValue()).toThrow(
      "Can't get the value of an error result. Use 'errorValue' instead."
    );
  });

  it('should return the error message via errorValue()', () => {
    const result = Result.fail('Bad Request');

    expect(result.errorValue()).toBe('Bad Request');
  });

  // ---------------------------
  // Immutability
  // ---------------------------

  it('should be immutable (frozen)', () => {
    const result = Result.ok('immutable');

    expect(Object.isFrozen(result)).toBe(true);
  });

  // ---------------------------
  // combine()
  // ---------------------------

  it('should return the first failure when combining results', () => {
    const r1 = Result.ok();
    const r2 = Result.fail('Error at r2');
    const r3 = Result.fail('Error at r3');

    const combined = Result.combine([r1, r2, r3]);

    expect(combined.isSuccess).toBe(false);
    expect(combined.errorValue()).toBe('Error at r2');
  });

  it('should return a success when all results succeed', () => {
    const r1 = Result.ok();
    const r2 = Result.ok('value');
    const r3 = Result.ok(123);

    const combined = Result.combine([r1, r2, r3]);

    expect(combined.isSuccess).toBe(true);
    expect(combined.getValue()).toBeUndefined();
  });

  it('should return an empty success result when combining an empty array', () => {
    const combined = Result.combine([]);

    expect(combined.isSuccess).toBe(true);
  });

  // ---------------------------
  // Extra: ensure value is only for success
  // ---------------------------

  it('should store value only when result is successful', () => {
    const ok = Result.ok('Hello');
    const fail = Result.fail<string>('Oops');

    expect(ok.getValue()).toBe('Hello');
    expect(fail.errorValue()).toBe('Oops');
    expect(() => fail.getValue()).toThrow();
  });
});
