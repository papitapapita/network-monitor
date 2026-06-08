// Source: src/domain/wireless-monitoring/services/rules/ThroughputSaturationRule.ts

import { ThroughputSaturationRule } from '../../../../../src/domain/wireless-monitoring/services/rules/ThroughputSaturationRule';
import { WirelessMetrics } from '../../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessMetricsProps } from '../../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';
import { EvaluationContext } from '../../../../../src/domain/wireless-monitoring/services/IWirelessAlertEvaluator';
import { WirelessAlertRecord } from '../../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { DeviceId } from '../../../../../src/domain/shared/ids/DeviceId';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

// 10 Mbps provisioned link = 10_000 kbps
// 80% threshold = 8_000 kbps = 8_000_000 bps

const LINK_CAPACITY_KBPS = 10_000;
const THRESHOLD_KBPS = 8_000; // 80% of 10_000

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
    linkCapacityKbps: LINK_CAPACITY_KBPS,
    clientsProvisionedLimit: null,
    previousMetrics: null,
    ...overrides,
  };
}

function makeActiveAlert(): WirelessAlertRecord {
  return WirelessAlertRecord.open(
    DeviceId.parse(DEVICE_UUID).value,
    'throughput_saturation',
    'WARNING',
    THRESHOLD_KBPS,
    THRESHOLD_KBPS + 100,
    'test'
  ).value;
}

describe('ThroughputSaturationRule', () => {
  let rule: ThroughputSaturationRule;

  beforeEach(() => {
    rule = new ThroughputSaturationRule();
  });

  describe('skip conditions', () => {
    it('should return [] when linkCapacityKbps is null', () => {
      const metrics = makeMetrics({ throughputTxBps: 5_000_000, throughputRxBps: 5_000_000 });
      const result = rule.evaluate(metrics, makeContext({ linkCapacityKbps: null }), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when throughputTxBps is null', () => {
      const metrics = makeMetrics({ throughputTxBps: null, throughputRxBps: 5_000_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when throughputRxBps is null', () => {
      const metrics = makeMetrics({ throughputTxBps: 5_000_000, throughputRxBps: null });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });
  });

  describe('OPEN alert', () => {
    it('should emit OPEN WARNING when total throughput reaches 80% of link capacity', () => {
      // exactly at threshold: 8_000 kbps = 8_000_000 bps total
      const metrics = makeMetrics({ throughputTxBps: 4_000_000, throughputRxBps: 4_000_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('OPEN');
      expect(result[0].severity).toBe('WARNING');
      expect(result[0].metric).toBe('throughput_saturation');
    });

    it('should emit OPEN WARNING when total throughput exceeds 80% of link capacity', () => {
      // 9_000 kbps = 9_000_000 bps — above threshold
      const metrics = makeMetrics({ throughputTxBps: 5_000_000, throughputRxBps: 4_000_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('OPEN');
    });

    it('should set currentValue to total throughput in kbps (rounded)', () => {
      const metrics = makeMetrics({ throughputTxBps: 4_500_000, throughputRxBps: 4_500_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result[0].currentValue).toBe(9_000);
    });

    it('should set threshold to 80% of linkCapacityKbps (rounded)', () => {
      const metrics = makeMetrics({ throughputTxBps: 4_000_000, throughputRxBps: 4_000_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result[0].threshold).toBe(THRESHOLD_KBPS);
    });

    it('should NOT emit OPEN when total throughput is below 80% of capacity', () => {
      // 7_999 kbps = 7_999_000 bps — just below threshold
      const metrics = makeMetrics({ throughputTxBps: 3_999_000, throughputRxBps: 4_000_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should NOT emit OPEN when alert is already active', () => {
      const metrics = makeMetrics({ throughputTxBps: 5_000_000, throughputRxBps: 5_000_000 });
      const alerts = new Map([['throughput_saturation:WARNING', makeActiveAlert()]]);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter((d) => d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });
  });

  describe('CLEAR alert', () => {
    it('should emit CLEAR when throughput drops below 80% and alert is active', () => {
      // 7_000 kbps = 7_000_000 bps — below threshold
      const metrics = makeMetrics({ throughputTxBps: 3_500_000, throughputRxBps: 3_500_000 });
      const alerts = new Map([['throughput_saturation:WARNING', makeActiveAlert()]]);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('CLEAR');
      expect(result[0].metric).toBe('throughput_saturation');
    });

    it('should NOT emit CLEAR when throughput is still at or above threshold', () => {
      const metrics = makeMetrics({ throughputTxBps: 4_000_000, throughputRxBps: 4_000_000 });
      const alerts = new Map([['throughput_saturation:WARNING', makeActiveAlert()]]);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const clears = result.filter((d) => d.action === 'CLEAR');
      expect(clears).toHaveLength(0);
    });

    it('should NOT emit CLEAR when no active alert exists', () => {
      const metrics = makeMetrics({ throughputTxBps: 1_000_000, throughputRxBps: 1_000_000 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });
  });
});
