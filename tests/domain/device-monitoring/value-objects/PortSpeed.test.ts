// Source: src/domain/device-monitoring/value-objects/PortSpeed.ts

import { PortSpeed } from '../../../../src/domain/device-monitoring/value-objects/PortSpeed';

describe('PortSpeed', () => {
  it.each([10, 100, 1000, 2500, 10000])(
    '[MON-142] should accept %i Mbps',
    (mbps) => {
      expect(PortSpeed.create(mbps).value.mbps).toBe(mbps);
    }
  );

  it.each([0, 50, 999, 1001, -100, 1.5, NaN])(
    '[MON-142] should refuse %p Mbps',
    (mbps) => {
      const result = PortSpeed.create(mbps);

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/must be one of/);
    }
  );

  it('should print megabits below a gigabit and gigabits from there', () => {
    expect(PortSpeed.create(100).value.toString()).toBe('100 Mbps');
    expect(PortSpeed.create(1000).value.toString()).toBe('1 Gbps');
    expect(PortSpeed.create(2500).value.toString()).toBe('2.5 Gbps');
  });

  it('should equal another of the same speed', () => {
    expect(
      PortSpeed.create(1000).value.equals(
        PortSpeed.create(1000).value
      )
    ).toBe(true);
  });
});
