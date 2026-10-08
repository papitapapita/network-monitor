import { AlertThresholdOverrides } from '../../../../src/domain/wireless-monitoring/value-objects/AlertThresholdOverrides';
import { AlertThresholdOverridesProps } from '../../../../src/domain/wireless-monitoring/props/AlertThresholdsProps';

describe('AlertThresholdOverrides', () => {
  it('none is empty', () => {
    expect(AlertThresholdOverrides.none().isEmpty).toBe(true);
  });

  it('keeps only the groups that are set', () => {
    const result = AlertThresholdOverrides.create({
      maxDistanceKm: { 40: 20 },
      cpuPercent: undefined
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value.values).toEqual({
      maxDistanceKm: { 40: 20 }
    });
    expect(result.value.isEmpty).toBe(false);
  });

  it('drops groups sent as null, so a client can clear one field', () => {
    const result = AlertThresholdOverrides.create({
      cpuPercent: null
    } as unknown as AlertThresholdOverridesProps);
    expect(result.value.isEmpty).toBe(true);
  });

  it('validates each group it holds with the install rules', () => {
    const result = AlertThresholdOverrides.create({
      signalDbm: { warning: -85, critical: -80 }
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'signalDbm.warning must be higher than signalDbm.critical'
    );
  });

  it('rejects an invalid width entry', () => {
    const result = AlertThresholdOverrides.create({
      minCapacityMbps: { 45: 100 }
    });
    expect(result.isFailure).toBe(true);
  });
});
