import { DiagnosisDuration } from '../../../../src/domain/wireless-monitoring/value-objects/DiagnosisDuration';

describe('[WLS-181] DiagnosisDuration', () => {
  it.each([10, 60, 300])('should accept %i seconds', (seconds) => {
    const result = DiagnosisDuration.create(seconds);

    expect(result.isSuccess).toBe(true);
    expect(result.value.seconds).toBe(seconds);
  });

  it('should reject a value below 10 seconds', () => {
    const result = DiagnosisDuration.create(9);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'Diagnosis duration must be at least 10 seconds'
    );
  });

  it('should reject a value above 300 seconds', () => {
    const result = DiagnosisDuration.create(301);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'Diagnosis duration must not exceed 300 seconds'
    );
  });

  it('should reject a non-integer', () => {
    expect(DiagnosisDuration.create(30.5).isFailure).toBe(true);
  });

  it('should reject null', () => {
    expect(
      DiagnosisDuration.create(null as unknown as number).isFailure
    ).toBe(true);
  });
});
