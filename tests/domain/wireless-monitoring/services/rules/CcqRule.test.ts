// Source: src/domain/wireless-monitoring/services/rules/CcqRule.ts

import { CcqRule } from '../../../../../src/domain/wireless-monitoring/services/rules/CcqRule';
import { WirelessMetrics } from '../../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessAlertRecord } from '../../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { WirelessMetricsProps } from '../../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';
import { EvaluationContext } from '../../../../../src/domain/wireless-monitoring/services/IWirelessAlertEvaluator';
import { DeviceId } from '../../../../../src/domain/shared/ids/DeviceId';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makeNullProps(): WirelessMetricsProps {
  return {
    signalRxDbm: null, signalTxDbm: null, noiseFloorDbm: null, snrDb: null,
    ccqPercent: null, frequencyMhz: null,
    channelWidthMhz: null, throughputTxBps: null,
    throughputRxBps: null, lanStatus: null, lanSpeedMbps: null, lanDuplex: null,
    uptimeSeconds: null, cpuLoadPercent: null, memoryUsedPercent: null,
    clientsConnected: null, throughputTxPps: null,
    throughputRxPps: null, firmwareVersion: null, deviceName: null,
    remoteApMac: null, remoteApName: null, remoteApIp: null,
    distanceM: null, latencyMs: null, capacityTxKbps: null, capacityRxKbps: null,
    deviceTimeEpoch: null, macAddress: null, deviceModel: null, ssid: null,
  };
}

function makeMetrics(overrides: Partial<WirelessMetricsProps> = {}): WirelessMetrics {
  return WirelessMetrics.create({ ...makeNullProps(), ...overrides }).value;
}

function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    deviceName: 'CPE-001',
    deviceModel: null,
    linkCapacityKbps: null,
    clientsProvisionedLimit: null,
    previousMetrics: null,
    collectedAt: new Date(),
    ...overrides,
  };
}

function makeActiveAlert(metric: string, severity: 'WARNING' | 'CRITICAL' = 'WARNING'): WirelessAlertRecord {
  return WirelessAlertRecord.open(DeviceId.parse(DEVICE_UUID).value, metric, severity, -70, -72, 'test').value;
}

function activeMap(...entries: Array<[string, 'WARNING' | 'CRITICAL']>): Map<string, WirelessAlertRecord> {
  const m = new Map<string, WirelessAlertRecord>();
  for (const [metric, sev] of entries) {
    m.set(`${metric}:${sev}`, makeActiveAlert(metric, sev));
  }
  return m;
}

describe('CcqRule', () => {
  let rule: CcqRule;

  beforeEach(() => {
    rule = new CcqRule();
  });

  describe('device model guard', () => {
    it('should return [] when deviceModel is null', () => {
      const metrics = makeMetrics({ ccqPercent: 60 });
      const result = rule.evaluate(metrics, makeContext({ deviceModel: null }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when deviceModel is an AC-series device (LiteBeam AC)', () => {
      const metrics = makeMetrics({ ccqPercent: 60 });
      const result = rule.evaluate(metrics, makeContext({ deviceModel: 'LiteBeam AC' }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when deviceModel is an AC-series device (NanoBeam AC)', () => {
      const metrics = makeMetrics({ ccqPercent: 60 });
      const result = rule.evaluate(metrics, makeContext({ deviceModel: 'NanoBeam AC' }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should evaluate when deviceModel matches M-series pattern (Rocket M5)', () => {
      const metrics = makeMetrics({ ccqPercent: 60 });
      const result = rule.evaluate(metrics, makeContext({ deviceModel: 'Rocket M5' }), new Map());
      const decision = result.find(d => d.action === 'OPEN' && d.severity === 'WARNING');
      expect(decision).toBeDefined();
    });

    it('should evaluate when deviceModel matches M-series pattern (NanoStation M2)', () => {
      const metrics = makeMetrics({ ccqPercent: 60 });
      const result = rule.evaluate(metrics, makeContext({ deviceModel: 'NanoStation M2' }), new Map());
      const decision = result.find(d => d.action === 'OPEN' && d.severity === 'WARNING');
      expect(decision).toBeDefined();
    });

    it('should evaluate when deviceModel matches M900 pattern', () => {
      const metrics = makeMetrics({ ccqPercent: 60 });
      const result = rule.evaluate(metrics, makeContext({ deviceModel: 'Bullet M900' }), new Map());
      expect(result.some(d => d.action === 'OPEN')).toBe(true);
    });
  });

  describe('ccq_percent — M-series device', () => {
    const mSeriesContext = makeContext({ deviceModel: 'Rocket M5' });

    it('should return [] when ccqPercent is null', () => {
      const metrics = makeMetrics({ ccqPercent: null });
      const result = rule.evaluate(metrics, mSeriesContext, new Map());
      expect(result).toHaveLength(0);
    });

    it('should emit OPEN WARNING when ccqPercent is below 75% and no active alert', () => {
      const metrics = makeMetrics({ ccqPercent: 70 });
      const result = rule.evaluate(metrics, mSeriesContext, new Map());
      const decision = result.find(d => d.severity === 'WARNING' && d.action === 'OPEN');
      expect(decision).toBeDefined();
      expect(decision!.metric).toBe('ccq_percent');
      expect(decision!.currentValue).toBe(70);
      expect(decision!.threshold).toBe(75);
    });

    it('should emit OPEN CRITICAL when ccqPercent is below 50% and no active alert', () => {
      const metrics = makeMetrics({ ccqPercent: 40 });
      const result = rule.evaluate(metrics, mSeriesContext, new Map());
      const decision = result.find(d => d.severity === 'CRITICAL' && d.action === 'OPEN');
      expect(decision).toBeDefined();
      expect(decision!.threshold).toBe(50);
    });

    it('should emit CLEAR WARNING when ccqPercent recovers above 78% and active WARNING alert exists', () => {
      const metrics = makeMetrics({ ccqPercent: 80 });
      const alerts = activeMap(['ccq_percent', 'WARNING']);
      const result = rule.evaluate(metrics, mSeriesContext, alerts);
      const decision = result.find(d => d.severity === 'WARNING');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should emit CLEAR CRITICAL when ccqPercent recovers above 55% and active CRITICAL alert exists', () => {
      const metrics = makeMetrics({ ccqPercent: 60 });
      const alerts = activeMap(['ccq_percent', 'CRITICAL']);
      const result = rule.evaluate(metrics, mSeriesContext, alerts);
      const decision = result.find(d => d.severity === 'CRITICAL');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN WARNING when alert is already active and breach continues', () => {
      const metrics = makeMetrics({ ccqPercent: 65 });
      const alerts = activeMap(['ccq_percent', 'WARNING']);
      const result = rule.evaluate(metrics, mSeriesContext, alerts);
      const opens = result.filter(d => d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should not emit CLEAR when ccqPercent is in WARNING hysteresis band (75 to 78)', () => {
      const metrics = makeMetrics({ ccqPercent: 76 });
      const alerts = activeMap(['ccq_percent', 'WARNING']);
      const result = rule.evaluate(metrics, mSeriesContext, alerts);
      expect(result).toHaveLength(0);
    });

    it('should not emit OPEN when ccqPercent is exactly at 75% (boundary is exclusive)', () => {
      const metrics = makeMetrics({ ccqPercent: 75 });
      const result = rule.evaluate(metrics, mSeriesContext, new Map());
      const opens = result.filter(d => d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });
  });
});
