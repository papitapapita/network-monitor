// Source: src/domain/wireless-monitoring/services/rules/ClientCountRule.ts

import { ClientCountRule } from '../../../../../src/domain/wireless-monitoring/services/rules/ClientCountRule';
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

function makeActiveAlertWithValue(
  metric: string,
  threshold: number,
  currentValue: number,
  severity: 'WARNING' | 'CRITICAL' = 'WARNING'
): WirelessAlertRecord {
  return WirelessAlertRecord.open(
    DeviceId.parse(DEVICE_UUID).value,
    metric,
    severity,
    threshold,
    currentValue,
    'test'
  ).value;
}

function activeMap(...entries: Array<[string, 'WARNING' | 'CRITICAL']>): Map<string, WirelessAlertRecord> {
  const m = new Map<string, WirelessAlertRecord>();
  for (const [metric, sev] of entries) {
    m.set(`${metric}:${sev}`, makeActiveAlert(metric, sev));
  }
  return m;
}

describe('[WLS-091] [WLS-092] ClientCountRule', () => {
  let rule: ClientCountRule;

  beforeEach(() => {
    rule = new ClientCountRule();
  });

  describe('clients_connected — provisioned limit', () => {
    it('should return [] when clientsConnected is null', () => {
      const metrics = makeMetrics({ clientsConnected: null });
      const result = rule.evaluate(metrics, makeContext({ clientsProvisionedLimit: 10 }), new Map());
      const decisions = result.filter(d => d.metric === 'clients_connected');
      expect(decisions).toHaveLength(0);
    });

    it('should return [] when clientsProvisionedLimit is null', () => {
      const metrics = makeMetrics({ clientsConnected: 15 });
      const result = rule.evaluate(metrics, makeContext({ clientsProvisionedLimit: null }), new Map());
      const decisions = result.filter(d => d.metric === 'clients_connected');
      expect(decisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when clientsConnected exceeds limit and no active alert', () => {
      const metrics = makeMetrics({ clientsConnected: 12 });
      const result = rule.evaluate(metrics, makeContext({ clientsProvisionedLimit: 10 }), new Map());
      const decision = result.find(d => d.metric === 'clients_connected');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(12);
      expect(decision!.threshold).toBe(10);
    });

    it('should emit CLEAR WARNING when clientsConnected is at or below limit and active alert exists', () => {
      const metrics = makeMetrics({ clientsConnected: 10 });
      const alerts = activeMap(['clients_connected', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ clientsProvisionedLimit: 10 }), alerts);
      const decision = result.find(d => d.metric === 'clients_connected');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when WARNING alert is already active and count still exceeds limit', () => {
      const metrics = makeMetrics({ clientsConnected: 15 });
      const alerts = activeMap(['clients_connected', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ clientsProvisionedLimit: 10 }), alerts);
      const opens = result.filter(d => d.metric === 'clients_connected' && d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });
  });

  describe('clients_sudden_drop — change-based', () => {
    it('should return [] when previousMetrics is null', () => {
      const metrics = makeMetrics({ clientsConnected: 2 });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: null }), new Map());
      const decisions = result.filter(d => d.metric === 'clients_sudden_drop');
      expect(decisions).toHaveLength(0);
    });

    it('should return [] when clientsConnected is null', () => {
      const prev = makeMetrics({ clientsConnected: 10 });
      const metrics = makeMetrics({ clientsConnected: null });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decisions = result.filter(d => d.metric === 'clients_sudden_drop');
      expect(decisions).toHaveLength(0);
    });

    it('should return [] when previous count is at or below 3, even if there is a ≥50% drop', () => {
      const prev = makeMetrics({ clientsConnected: 3 });
      const metrics = makeMetrics({ clientsConnected: 0 });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decisions = result.filter(d => d.metric === 'clients_sudden_drop');
      expect(decisions).toHaveLength(0);
    });

    it('should return [] when previous count is exactly 3 (boundary — not greater than)', () => {
      const prev = makeMetrics({ clientsConnected: 3 });
      const metrics = makeMetrics({ clientsConnected: 0 });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decisions = result.filter(d => d.metric === 'clients_sudden_drop');
      expect(decisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when previous > 3 and current drops below 50% of previous', () => {
      const prev = makeMetrics({ clientsConnected: 10 });
      const metrics = makeMetrics({ clientsConnected: 4 });
      // floor = round(10 * 0.5) = 5, current (4) < floor (5) → breach
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decision = result.find(d => d.metric === 'clients_sudden_drop');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(4);
    });

    it('should store Math.round(previous * 0.5) as the threshold in the OPEN decision', () => {
      const prev = makeMetrics({ clientsConnected: 10 });
      const metrics = makeMetrics({ clientsConnected: 4 });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decision = result.find(d => d.metric === 'clients_sudden_drop' && d.action === 'OPEN');
      expect(decision).toBeDefined();
      expect(decision!.threshold).toBe(Math.round(10 * 0.5));
    });

    it('should store correct threshold when previous count is odd (rounding)', () => {
      const prev = makeMetrics({ clientsConnected: 9 });
      // floor = round(9 * 0.5) = round(4.5) = 5 (JS rounds 0.5 up)
      const metrics = makeMetrics({ clientsConnected: 3 });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decision = result.find(d => d.metric === 'clients_sudden_drop' && d.action === 'OPEN');
      expect(decision).toBeDefined();
      expect(decision!.threshold).toBe(Math.round(9 * 0.5));
    });

    it('should not emit OPEN when previous is 4 and current is exactly at the 50% floor', () => {
      const prev = makeMetrics({ clientsConnected: 4 });
      // floor = round(4 * 0.5) = 2, current (2) is NOT < floor (2) → no breach
      const metrics = makeMetrics({ clientsConnected: 2 });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const opens = result.filter(d => d.metric === 'clients_sudden_drop' && d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should emit CLEAR WARNING when current count recovers to lastValue and active alert exists', () => {
      const prev = makeMetrics({ clientsConnected: 10 });
      const alertRecord = makeActiveAlertWithValue('clients_sudden_drop', 5, 3);
      const alerts = new Map<string, WirelessAlertRecord>();
      alerts.set('clients_sudden_drop:WARNING', alertRecord);
      // current (3) >= lastValue (3) → CLEAR
      const metrics = makeMetrics({ clientsConnected: 3 });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), alerts);
      const decision = result.find(d => d.metric === 'clients_sudden_drop');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when sudden drop alert is already active', () => {
      const prev = makeMetrics({ clientsConnected: 10 });
      const metrics = makeMetrics({ clientsConnected: 2 });
      const alerts = activeMap(['clients_sudden_drop', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), alerts);
      const opens = result.filter(d => d.metric === 'clients_sudden_drop' && d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });
  });
});
