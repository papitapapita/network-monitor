import { AlertThresholds } from '../../../../src/domain/wireless-monitoring/value-objects/AlertThresholds';
import { AlertThresholdsProps } from '../../../../src/domain/wireless-monitoring/props/AlertThresholdsProps';

function makeProps(
  overrides: Partial<AlertThresholdsProps> = {}
): AlertThresholdsProps {
  return { ...AlertThresholds.defaults().values, ...overrides };
}

describe('AlertThresholds', () => {
  describe('defaults', () => {
    it('match the limits the rules used before they were configurable', () => {
      const t = AlertThresholds.defaults();
      expect(t.signalDbm).toEqual({ warning: -70, critical: -80 });
      expect(t.snrDb).toEqual({ warning: 15, critical: 10 });
      expect(t.ccqPercent).toEqual({ warning: 75, critical: 50 });
      expect(t.latencyMs).toEqual({ warning: 50, critical: 150 });
      expect(t.cpuPercent).toBe(80);
      expect(t.memoryPercent).toBe(85);
      expect(t.clockDriftSeconds).toBe(300);
      expect(t.saturationPercent).toBe(80);
      expect(t.clientDropPercent).toBe(50);
      expect(t.minCapacityMbps).toEqual({ 20: 50, 40: 100, 80: 200 });
      expect(t.maxDistanceKm).toEqual({ 20: 15, 40: 10, 80: 5 });
    });

    it('confirm flicker-prone alerts before opening them', () => {
      expect(AlertThresholds.defaults().confirmBeforeAlerting).toBe(
        true
      );
    });

    it('pass their own validation', () => {
      expect(
        AlertThresholds.create(AlertThresholds.defaults().values)
          .isSuccess
      ).toBe(true);
    });
  });

  describe('create', () => {
    it('accepts a custom set', () => {
      const result = AlertThresholds.create(
        makeProps({
          signalDbm: { warning: -65, critical: -75 },
          minCapacityMbps: { 40: 150 },
          maxDistanceKm: { 40: 2.5 }
        })
      );
      expect(result.isSuccess).toBe(true);
      expect(result.value.minCapacityKbpsFor(40)).toBe(150_000);
      expect(result.value.maxDistanceMFor(40)).toBe(2500);
    });

    it.each([
      [
        'signal warning not above critical',
        { signalDbm: { warning: -80, critical: -80 } },
        'signalDbm.warning must be higher than signalDbm.critical'
      ],
      [
        'SNR warning below critical',
        { snrDb: { warning: 10, critical: 15 } },
        'snrDb.warning must be higher than snrDb.critical'
      ],
      [
        'latency warning not below critical',
        { latencyMs: { warning: 150, critical: 50 } },
        'latencyMs.warning must be lower than latencyMs.critical'
      ],
      [
        'signal outside -100..-40',
        { signalDbm: { warning: -30, critical: -80 } },
        'signalDbm.warning must be a whole number from -100 to -40'
      ],
      [
        'CCQ too high to ever clear',
        { ccqPercent: { warning: 99, critical: 50 } },
        'ccqPercent.warning must be a whole number from 1 to 95'
      ],
      [
        'fractional CPU',
        { cpuPercent: 80.5 },
        'cpuPercent must be a whole number from 10 to 99'
      ],
      [
        'memory over 99',
        { memoryPercent: 100 },
        'memoryPercent must be a whole number from 10 to 99'
      ],
      [
        'clock drift under 10 s',
        { clockDriftSeconds: 5 },
        'clockDriftSeconds must be a whole number from 10 to 86400'
      ],
      [
        'saturation over 100',
        { saturationPercent: 120 },
        'saturationPercent must be a whole number from 10 to 100'
      ],
      [
        'client drop of 100 %',
        { clientDropPercent: 100 },
        'clientDropPercent must be a whole number from 10 to 90'
      ],
      [
        'unknown channel width',
        { minCapacityMbps: { 25: 50 } },
        'minCapacityMbps channel width must be one of 5, 10, 20, 30, 40, 50, 60, 80, 160 MHz'
      ],
      [
        'zero capacity',
        { minCapacityMbps: { 40: 0 } },
        'minCapacityMbps.40 must be a whole number from 1 to 10000'
      ],
      [
        'distance over 200 km',
        { maxDistanceKm: { 40: 250 } },
        'maxDistanceKm.40 must be from 0.1 to 200'
      ]
    ])('rejects %s', (_label, overrides, message) => {
      const result = AlertThresholds.create(
        makeProps(overrides as Partial<AlertThresholdsProps>)
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(message);
    });

    it('rejects a missing pair', () => {
      const result = AlertThresholds.create(
        makeProps({
          snrDb: null as unknown as AlertThresholdsProps['snrDb']
        })
      );
      expect(result.error).toBe(
        'snrDb must have a warning and a critical value'
      );
    });

    it('accepts turning confirmation off', () => {
      const result = AlertThresholds.create(
        makeProps({ confirmBeforeAlerting: false })
      );
      expect(result.value.confirmBeforeAlerting).toBe(false);
    });

    it('rejects a confirmation switch that is not true or false', () => {
      const result = AlertThresholds.create(
        makeProps({
          confirmBeforeAlerting: 'yes' as unknown as boolean
        })
      );
      expect(result.error).toBe(
        'confirmBeforeAlerting must be true or false'
      );
    });

    it('accepts an empty width table, which turns that check off', () => {
      const result = AlertThresholds.create(
        makeProps({ maxDistanceKm: {} })
      );
      expect(result.isSuccess).toBe(true);
      expect(result.value.maxDistanceMFor(20)).toBeNull();
    });
  });

  describe('channel-width lookups', () => {
    it('return null for a width with no entry', () => {
      const t = AlertThresholds.defaults();
      expect(t.minCapacityKbpsFor(30)).toBeNull();
      expect(t.maxDistanceMFor(30)).toBeNull();
    });

    it('accept widths stored with string keys, as JSON returns them', () => {
      const t = AlertThresholds.reconstitute(
        makeProps({
          minCapacityMbps: { '40': 120 } as unknown as Record<
            number,
            number
          >
        })
      );
      expect(t.minCapacityKbpsFor(40)).toBe(120_000);
    });
  });

  describe('withOverrides', () => {
    it('replaces a severity pair as a whole', () => {
      const t = AlertThresholds.defaults().withOverrides({
        signalDbm: { warning: -75, critical: -85 }
      });
      expect(t.signalDbm).toEqual({ warning: -75, critical: -85 });
      expect(t.snrDb).toEqual({ warning: 15, critical: 10 });
    });

    it('merges channel-width tables per width', () => {
      const t = AlertThresholds.defaults().withOverrides({
        maxDistanceKm: { 40: 25 }
      });
      expect(t.maxDistanceKm).toEqual({ 20: 15, 40: 25, 80: 5 });
    });

    it('leaves the base unchanged with no overrides', () => {
      const base = AlertThresholds.defaults();
      expect(base.withOverrides({}).equals(base)).toBe(true);
    });
  });
});
