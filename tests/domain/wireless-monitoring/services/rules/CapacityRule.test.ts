// Source: src/domain/wireless-monitoring/services/rules/CapacityRule.ts

import { CapacityRule } from '../../../../../src/domain/wireless-monitoring/services/rules/CapacityRule';
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

// Floor values from source: 20 MHz → 50_000 kbps, 40 MHz → 100_000 kbps, 80 MHz → 200_000 kbps

describe('CapacityRule', () => {
  let rule: CapacityRule;

  beforeEach(() => {
    rule = new CapacityRule();
  });

  describe('guard conditions', () => {
    it('should return [] when channelWidthMhz is null', () => {
      const metrics = makeMetrics({ channelWidthMhz: null, capacityTxKbps: 10_000, capacityRxKbps: 10_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when channelWidthMhz is 160 (not in the floor table)', () => {
      const metrics = makeMetrics({ channelWidthMhz: 160, capacityTxKbps: 10_000, capacityRxKbps: 10_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when capacityTxKbps is null', () => {
      const metrics = makeMetrics({ channelWidthMhz: 20, capacityTxKbps: null, capacityRxKbps: 10_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when capacityRxKbps is null', () => {
      const metrics = makeMetrics({ channelWidthMhz: 20, capacityTxKbps: 10_000, capacityRxKbps: null });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });
  });

  describe('capacity_kbps — 20 MHz channel (floor: 50_000 kbps)', () => {
    it('should return [] when only Tx is below floor and Rx is above floor', () => {
      const metrics = makeMetrics({ channelWidthMhz: 20, capacityTxKbps: 40_000, capacityRxKbps: 60_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when only Rx is below floor and Tx is above floor', () => {
      const metrics = makeMetrics({ channelWidthMhz: 20, capacityTxKbps: 60_000, capacityRxKbps: 40_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should emit OPEN WARNING when both Tx and Rx are below floor and no active alert', () => {
      const metrics = makeMetrics({ channelWidthMhz: 20, capacityTxKbps: 30_000, capacityRxKbps: 40_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(d => d.metric === 'capacity_kbps');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.threshold).toBe(50_000);
      expect(decision!.currentValue).toBe(30_000); // min(30_000, 40_000)
    });

    it('should emit CLEAR WARNING when at least one of Tx or Rx recovers above floor and active alert exists', () => {
      const metrics = makeMetrics({ channelWidthMhz: 20, capacityTxKbps: 60_000, capacityRxKbps: 40_000 });
      const alerts = activeMap(['capacity_kbps', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(d => d.metric === 'capacity_kbps');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when WARNING alert is already active and both are still below floor', () => {
      const metrics = makeMetrics({ channelWidthMhz: 20, capacityTxKbps: 10_000, capacityRxKbps: 20_000 });
      const alerts = activeMap(['capacity_kbps', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter(d => d.metric === 'capacity_kbps' && d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should not emit CLEAR when both Tx and Rx are still below floor while alert is active', () => {
      const metrics = makeMetrics({ channelWidthMhz: 20, capacityTxKbps: 20_000, capacityRxKbps: 30_000 });
      const alerts = activeMap(['capacity_kbps', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      expect(result).toHaveLength(0);
    });
  });

  describe('capacity_kbps — 40 MHz channel (floor: 100_000 kbps)', () => {
    it('should emit OPEN WARNING when both Tx and Rx are below 100_000 kbps floor', () => {
      const metrics = makeMetrics({ channelWidthMhz: 40, capacityTxKbps: 80_000, capacityRxKbps: 70_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(d => d.metric === 'capacity_kbps');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.threshold).toBe(100_000);
    });

    it('should return [] when only Tx is below 100_000 kbps floor', () => {
      const metrics = makeMetrics({ channelWidthMhz: 40, capacityTxKbps: 80_000, capacityRxKbps: 120_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });
  });

  describe('capacity_kbps — 80 MHz channel (floor: 200_000 kbps)', () => {
    it('should emit OPEN WARNING when both Tx and Rx are below 200_000 kbps floor', () => {
      const metrics = makeMetrics({ channelWidthMhz: 80, capacityTxKbps: 150_000, capacityRxKbps: 180_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(d => d.metric === 'capacity_kbps');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.threshold).toBe(200_000);
      expect(decision!.currentValue).toBe(150_000);
    });
  });
});
