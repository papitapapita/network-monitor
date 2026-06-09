// Source: src/domain/wireless-monitoring/services/rules/FirmwareRule.ts

import { FirmwareRule } from '../../../../../src/domain/wireless-monitoring/services/rules/FirmwareRule';
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

describe('FirmwareRule', () => {
  let rule: FirmwareRule;

  beforeEach(() => {
    rule = new FirmwareRule();
  });

  describe('firmware_version_changed (change-based — auto-clears when value stabilises)', () => {
    it('should return [] when previousMetrics is null', () => {
      const metrics = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: null }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when current firmwareVersion is null', () => {
      const prev = makeMetrics({ firmwareVersion: 'WA.v8.5.0' });
      const metrics = makeMetrics({ firmwareVersion: null });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when previous firmwareVersion is null', () => {
      const prev = makeMetrics({ firmwareVersion: null });
      const metrics = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should emit OPEN WARNING when firmware version differs from previous and no active alert', () => {
      const prev = makeMetrics({ firmwareVersion: 'WA.v8.5.0' });
      const metrics = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decision = result.find(d => d.metric === 'firmware_version_changed');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(1);
      expect(decision!.threshold).toBe(0);
    });

    it('should include the old and new firmware version in the OPEN message', () => {
      const prev = makeMetrics({ firmwareVersion: 'WA.v8.5.0' });
      const metrics = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decision = result.find(d => d.metric === 'firmware_version_changed' && d.action === 'OPEN');
      expect(decision!.message).toContain('"WA.v8.5.0"');
      expect(decision!.message).toContain('"WA.v8.7.11"');
      expect(decision!.message).toContain('→');
    });

    it('should emit CLEAR WARNING when firmware version matches previous and active alert exists', () => {
      const prev = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      const metrics = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      const alerts = activeMap(['firmware_version_changed', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), alerts);
      const decision = result.find(d => d.metric === 'firmware_version_changed');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when firmware_version_changed alert is already active', () => {
      const prev = makeMetrics({ firmwareVersion: 'WA.v8.5.0' });
      const metrics = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      const alerts = activeMap(['firmware_version_changed', 'WARNING']);
      const opens = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), alerts)
        .filter(d => d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should not emit any decision when firmware is stable and no active alert', () => {
      const prev = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      const metrics = makeMetrics({ firmwareVersion: 'WA.v8.7.11' });
      expect(rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map())).toHaveLength(0);
    });
  });
});
