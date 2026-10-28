// Source: src/domain/device-monitoring/value-objects/RouterHealthThresholds.ts

import { RouterHealthThresholds } from '../../../../src/domain/device-monitoring/value-objects';
import { RouterHealthThresholdsProps } from '../../../../src/domain/device-monitoring/props';

function makeProps(
  overrides: Partial<RouterHealthThresholdsProps> = {}
): RouterHealthThresholdsProps {
  return {
    cpuPercent: 90,
    minFreeMemoryPercent: 10,
    minFreeDiskPercent: 5,
    maxTemperatureC: 75,
    minVoltage: null,
    ...overrides
  };
}

describe('RouterHealthThresholds', () => {
  it('[MON-172] should default to CPU 90 %, memory 10 %, disk 5 %, 75 °C and no voltage', () => {
    expect(RouterHealthThresholds.defaults().values).toEqual(
      makeProps()
    );
  });

  it('[MON-172] should accept thresholds within range', () => {
    const result = RouterHealthThresholds.create(
      makeProps({ minVoltage: 11.5 })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.minVoltage).toBe(11.5);
  });

  it.each([
    [
      { cpuPercent: 49 },
      'cpuPercent must be a whole number from 50 to 99'
    ],
    [
      { cpuPercent: 100 },
      'cpuPercent must be a whole number from 50 to 99'
    ],
    [
      { cpuPercent: 90.5 },
      'cpuPercent must be a whole number from 50 to 99'
    ],
    [
      { minFreeMemoryPercent: 0 },
      'minFreeMemoryPercent must be a whole number from 1 to 50'
    ],
    [
      { minFreeDiskPercent: 51 },
      'minFreeDiskPercent must be a whole number from 1 to 50'
    ],
    [
      { maxTemperatureC: 39 },
      'maxTemperatureC must be a whole number from 40 to 110'
    ],
    [
      { minVoltage: 4.9 },
      'minVoltage must be null or a number from 5 to 60'
    ],
    [
      { minVoltage: 61 },
      'minVoltage must be null or a number from 5 to 60'
    ]
  ])('[MON-172] should refuse %o', (overrides, error) => {
    const result = RouterHealthThresholds.create(
      makeProps(overrides)
    );

    expect(result.error).toBe(error);
  });

  it('should not share its values', () => {
    const thresholds = RouterHealthThresholds.defaults();
    thresholds.values.cpuPercent = 10;

    expect(thresholds.cpuPercent).toBe(90);
  });
});
