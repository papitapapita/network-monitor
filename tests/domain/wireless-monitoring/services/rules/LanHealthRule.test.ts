// Source: src/domain/wireless-monitoring/services/rules/LanHealthRule.ts

import { LanHealthRule } from '../../../../../src/domain/wireless-monitoring/services/rules/LanHealthRule';
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

describe('LanHealthRule', () => {
  let rule: LanHealthRule;

  beforeEach(() => {
    rule = new LanHealthRule();
  });

  describe('lan_status', () => {
    it('should return [] for lan_status when lanStatus is null', () => {
      const metrics = makeMetrics({ lanStatus: null });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const lanStatusDecisions = result.filter(d => d.metric === 'lan_status');
      expect(lanStatusDecisions).toHaveLength(0);
    });

    it('should emit OPEN CRITICAL when lanStatus is DOWN and no active alert', () => {
      const metrics = makeMetrics({ lanStatus: 'DOWN' });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(d => d.metric === 'lan_status');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('CRITICAL');
      expect(decision!.currentValue).toBe(0);
    });

    it('should emit CLEAR CRITICAL when lanStatus is UP and active alert exists', () => {
      const metrics = makeMetrics({ lanStatus: 'UP' });
      const alerts = activeMap(['lan_status', 'CRITICAL']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(d => d.metric === 'lan_status');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
      expect(decision!.severity).toBe('CRITICAL');
      expect(decision!.currentValue).toBe(1);
    });

    it('should not emit OPEN when CRITICAL alert is already active and LAN is still DOWN', () => {
      const metrics = makeMetrics({ lanStatus: 'DOWN' });
      const alerts = activeMap(['lan_status', 'CRITICAL']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter(d => d.metric === 'lan_status' && d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should not emit any decision when lanStatus is UP and no active alert exists', () => {
      const metrics = makeMetrics({ lanStatus: 'UP' });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const lanStatusDecisions = result.filter(d => d.metric === 'lan_status');
      expect(lanStatusDecisions).toHaveLength(0);
    });
  });

  describe('lan_speed_mbps', () => {
    it('should return [] for lan_speed_mbps when lanSpeedMbps is null', () => {
      const metrics = makeMetrics({ lanSpeedMbps: null });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const speedDecisions = result.filter(d => d.metric === 'lan_speed_mbps');
      expect(speedDecisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when lanSpeedMbps is at or below 10 Mbps and no active alert', () => {
      const metrics = makeMetrics({ lanSpeedMbps: 10 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(d => d.metric === 'lan_speed_mbps');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(10);
      expect(decision!.threshold).toBe(10);
    });

    it('should emit OPEN WARNING when lanSpeedMbps is below 10 Mbps and no active alert', () => {
      const metrics = makeMetrics({ lanSpeedMbps: 5 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(d => d.metric === 'lan_speed_mbps');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
    });

    it('should emit CLEAR WARNING when lanSpeedMbps exceeds 100 Mbps and active alert exists', () => {
      const metrics = makeMetrics({ lanSpeedMbps: 1000 });
      const alerts = activeMap(['lan_speed_mbps', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(d => d.metric === 'lan_speed_mbps');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when WARNING alert is already active and speed is still low', () => {
      const metrics = makeMetrics({ lanSpeedMbps: 5 });
      const alerts = activeMap(['lan_speed_mbps', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter(d => d.metric === 'lan_speed_mbps' && d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should not emit CLEAR when speed is in mid range (10 to 100 Mbps) while alert is active', () => {
      const metrics = makeMetrics({ lanSpeedMbps: 100 });
      const alerts = activeMap(['lan_speed_mbps', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const speedDecisions = result.filter(d => d.metric === 'lan_speed_mbps');
      expect(speedDecisions).toHaveLength(0);
    });
  });

  describe('lan_duplex_changed (change-based)', () => {
    it('should return [] when previousMetrics is null', () => {
      const metrics = makeMetrics({ lanDuplex: 'HALF' });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: null }), new Map());
      const duplexDecisions = result.filter(d => d.metric === 'lan_duplex_changed');
      expect(duplexDecisions).toHaveLength(0);
    });

    it('should return [] when current lanDuplex is null', () => {
      const prev = makeMetrics({ lanDuplex: 'FULL' });
      const metrics = makeMetrics({ lanDuplex: null });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const duplexDecisions = result.filter(d => d.metric === 'lan_duplex_changed');
      expect(duplexDecisions).toHaveLength(0);
    });

    it('should return [] when previous lanDuplex is null', () => {
      const prev = makeMetrics({ lanDuplex: null });
      const metrics = makeMetrics({ lanDuplex: 'HALF' });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const duplexDecisions = result.filter(d => d.metric === 'lan_duplex_changed');
      expect(duplexDecisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when duplex mode changes and no active alert', () => {
      const prev = makeMetrics({ lanDuplex: 'FULL' });
      const metrics = makeMetrics({ lanDuplex: 'HALF' });
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), new Map());
      const decision = result.find(d => d.metric === 'lan_duplex_changed');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(1);
    });

    it('should emit CLEAR WARNING when duplex mode matches previous and active alert exists', () => {
      const prev = makeMetrics({ lanDuplex: 'FULL' });
      const metrics = makeMetrics({ lanDuplex: 'FULL' });
      const alerts = activeMap(['lan_duplex_changed', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), alerts);
      const decision = result.find(d => d.metric === 'lan_duplex_changed');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when duplex change alert is already active', () => {
      const prev = makeMetrics({ lanDuplex: 'FULL' });
      const metrics = makeMetrics({ lanDuplex: 'HALF' });
      const alerts = activeMap(['lan_duplex_changed', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ previousMetrics: prev }), alerts);
      const opens = result.filter(d => d.metric === 'lan_duplex_changed' && d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });
  });
});
