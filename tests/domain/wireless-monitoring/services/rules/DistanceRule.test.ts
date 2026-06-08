// Source: src/domain/wireless-monitoring/services/rules/DistanceRule.ts

import { DistanceRule } from '../../../../../src/domain/wireless-monitoring/services/rules/DistanceRule';
import { WirelessMetrics } from '../../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessAlertRecord } from '../../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { WirelessMetricsProps } from '../../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';
import { EvaluationContext } from '../../../../../src/domain/wireless-monitoring/services/IWirelessAlertEvaluator';
import { DeviceId } from '../../../../../src/domain/shared/ids/DeviceId';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makeNullProps(): WirelessMetricsProps {
  return {
    signalRxDbm: null, signalTxDbm: null, noiseFloorDbm: null, snrDb: null,
    ccqPercent: null, txRateMbps: null, rxRateMbps: null, frequencyMhz: null,
    channelWidthMhz: null, txPowerDbm: null, throughputTxBps: null,
    throughputRxBps: null, lanStatus: null, lanSpeedMbps: null, lanDuplex: null,
    uptimeSeconds: null, cpuLoadPercent: null, memoryUsedPercent: null,
    clientsConnected: null, clientsProvisioned: null, throughputTxPps: null,
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
    linkCapacityBps: null,
    clientsProvisionedLimit: null,
    previousMetrics: null,
    targetFirmwareVersion: null,
    maxLinkDistanceM: null,
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

describe('DistanceRule', () => {
  let rule: DistanceRule;

  beforeEach(() => {
    rule = new DistanceRule();
  });

  describe('distance_m', () => {
    it('should return [] when maxLinkDistanceM is null in context, even if distanceM is large', () => {
      const metrics = makeMetrics({ distanceM: 99_999 });
      const result = rule.evaluate(metrics, makeContext({ maxLinkDistanceM: null }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when distanceM is null', () => {
      const metrics = makeMetrics({ distanceM: null });
      const result = rule.evaluate(metrics, makeContext({ maxLinkDistanceM: 5_000 }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should emit OPEN WARNING when distanceM exceeds maxLinkDistanceM and no active alert', () => {
      const metrics = makeMetrics({ distanceM: 6_000 });
      const result = rule.evaluate(metrics, makeContext({ maxLinkDistanceM: 5_000 }), new Map());
      const decision = result.find(d => d.metric === 'distance_m');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(6_000);
      expect(decision!.threshold).toBe(5_000);
    });

    it('should emit CLEAR WARNING when distanceM is at or below maxLinkDistanceM and active alert exists', () => {
      const metrics = makeMetrics({ distanceM: 5_000 });
      const alerts = activeMap(['distance_m', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ maxLinkDistanceM: 5_000 }), alerts);
      const decision = result.find(d => d.metric === 'distance_m');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
      expect(decision!.currentValue).toBe(5_000);
    });

    it('should emit CLEAR WARNING when distanceM is below maxLinkDistanceM and active alert exists', () => {
      const metrics = makeMetrics({ distanceM: 4_000 });
      const alerts = activeMap(['distance_m', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ maxLinkDistanceM: 5_000 }), alerts);
      const decision = result.find(d => d.metric === 'distance_m');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when WARNING alert is already active and distance still exceeds max', () => {
      const metrics = makeMetrics({ distanceM: 8_000 });
      const alerts = activeMap(['distance_m', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ maxLinkDistanceM: 5_000 }), alerts);
      const opens = result.filter(d => d.metric === 'distance_m' && d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should not emit any decision when distance is exactly at max and no active alert', () => {
      const metrics = makeMetrics({ distanceM: 5_000 });
      const result = rule.evaluate(metrics, makeContext({ maxLinkDistanceM: 5_000 }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should not emit any decision when distance is well within max and no active alert', () => {
      const metrics = makeMetrics({ distanceM: 1_000 });
      const result = rule.evaluate(metrics, makeContext({ maxLinkDistanceM: 5_000 }), new Map());
      expect(result).toHaveLength(0);
    });
  });
});
