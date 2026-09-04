// Source: src/domain/wireless-monitoring/services/rules/CpuMemoryRule.ts

import { CpuMemoryRule } from '../../../../../src/domain/wireless-monitoring/services/rules/CpuMemoryRule';
import { WirelessMetrics } from '../../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessAlertRecord } from '../../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { WirelessMetricsProps } from '../../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';
import { EvaluationContext } from '../../../../../src/domain/wireless-monitoring/services/IWirelessAlertEvaluator';
import { DeviceId } from '../../../../../src/domain/shared/ids/DeviceId';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makeNullProps(): WirelessMetricsProps {
  return {
    signalRxDbm: null,
    signalTxDbm: null,
    noiseFloorDbm: null,
    snrDb: null,
    ccqPercent: null,
    frequencyMhz: null,
    channelWidthMhz: null,
    throughputTxBps: null,
    throughputRxBps: null,
    lanStatus: null,
    lanSpeedMbps: null,
    lanDuplex: null,
    uptimeSeconds: null,
    cpuLoadPercent: null,
    memoryUsedPercent: null,
    clientsConnected: null,
    throughputTxPps: null,
    throughputRxPps: null,
    firmwareVersion: null,
    deviceName: null,
    remoteApMac: null,
    remoteApName: null,
    remoteApIp: null,
    distanceM: null,
    latencyMs: null,
    capacityTxKbps: null,
    capacityRxKbps: null,
    deviceTimeEpoch: null,
    macAddress: null,
    deviceModel: null,
    ssid: null
  };
}

function makeMetrics(
  overrides: Partial<WirelessMetricsProps> = {}
): WirelessMetrics {
  return WirelessMetrics.create({ ...makeNullProps(), ...overrides })
    .value;
}

function makeContext(
  overrides: Partial<EvaluationContext> = {}
): EvaluationContext {
  return {
    deviceName: 'CPE-001',
    deviceModel: null,
    linkCapacityKbps: null,
    clientsProvisionedLimit: null,
    provisionedLanSpeedMbps: null,
    previousMetrics: null,
    collectedAt: new Date(),
    ...overrides
  };
}

function makeActiveAlert(
  metric: string,
  severity: 'WARNING' | 'CRITICAL' = 'WARNING'
): WirelessAlertRecord {
  return WirelessAlertRecord.open(
    DeviceId.parse(DEVICE_UUID).value,
    metric,
    severity,
    -70,
    -72,
    'test'
  ).value;
}

function activeMap(
  ...entries: Array<[string, 'WARNING' | 'CRITICAL']>
): Map<string, WirelessAlertRecord> {
  const m = new Map<string, WirelessAlertRecord>();
  for (const [metric, sev] of entries) {
    m.set(`${metric}:${sev}`, makeActiveAlert(metric, sev));
  }
  return m;
}

describe('[WLS-081] [WLS-087] CpuMemoryRule', () => {
  let rule: CpuMemoryRule;

  beforeEach(() => {
    rule = new CpuMemoryRule();
  });

  describe('cpu_load_percent', () => {
    it('should return [] when cpuLoadPercent is null', () => {
      const metrics = makeMetrics({ cpuLoadPercent: null });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const cpuDecisions = result.filter(
        (d) => d.metric === 'cpu_load_percent'
      );
      expect(cpuDecisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when cpuLoadPercent exceeds 80% and no active alert', () => {
      const metrics = makeMetrics({ cpuLoadPercent: 85 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) => d.metric === 'cpu_load_percent'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(85);
      expect(decision!.threshold).toBe(80);
    });

    it('should emit CLEAR WARNING when cpuLoadPercent drops below 75% and active alert exists', () => {
      const metrics = makeMetrics({ cpuLoadPercent: 70 });
      const alerts = activeMap(['cpu_load_percent', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(
        (d) => d.metric === 'cpu_load_percent'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
      expect(decision!.severity).toBe('WARNING');
    });

    it('should not emit OPEN when WARNING alert is already active and breach continues', () => {
      const metrics = makeMetrics({ cpuLoadPercent: 90 });
      const alerts = activeMap(['cpu_load_percent', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter(
        (d) => d.metric === 'cpu_load_percent' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });

    it('should not emit CLEAR when cpuLoadPercent is in hysteresis band (75 to 80)', () => {
      const metrics = makeMetrics({ cpuLoadPercent: 77 });
      const alerts = activeMap(['cpu_load_percent', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const cpuDecisions = result.filter(
        (d) => d.metric === 'cpu_load_percent'
      );
      expect(cpuDecisions).toHaveLength(0);
    });

    it('should not emit OPEN when cpuLoadPercent is exactly at 80% (boundary is exclusive)', () => {
      const metrics = makeMetrics({ cpuLoadPercent: 80 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const opens = result.filter(
        (d) => d.metric === 'cpu_load_percent' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });
  });

  describe('memory_used_percent', () => {
    it('should return [] when memoryUsedPercent is null', () => {
      const metrics = makeMetrics({ memoryUsedPercent: null });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const memDecisions = result.filter(
        (d) => d.metric === 'memory_used_percent'
      );
      expect(memDecisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when memoryUsedPercent exceeds 85% and no active alert', () => {
      const metrics = makeMetrics({ memoryUsedPercent: 90 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) => d.metric === 'memory_used_percent'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(90);
      expect(decision!.threshold).toBe(85);
    });

    it('should emit CLEAR WARNING when memoryUsedPercent drops below 80% and active alert exists', () => {
      const metrics = makeMetrics({ memoryUsedPercent: 75 });
      const alerts = activeMap(['memory_used_percent', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(
        (d) => d.metric === 'memory_used_percent'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when WARNING alert is already active and breach continues', () => {
      const metrics = makeMetrics({ memoryUsedPercent: 95 });
      const alerts = activeMap(['memory_used_percent', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter(
        (d) =>
          d.metric === 'memory_used_percent' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });

    it('should not emit CLEAR when memoryUsedPercent is in hysteresis band (80 to 85)', () => {
      const metrics = makeMetrics({ memoryUsedPercent: 82 });
      const alerts = activeMap(['memory_used_percent', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const memDecisions = result.filter(
        (d) => d.metric === 'memory_used_percent'
      );
      expect(memDecisions).toHaveLength(0);
    });
  });

  describe('multi-metric independence', () => {
    it('should evaluate cpu_load_percent and memory_used_percent independently', () => {
      const metrics = makeMetrics({
        cpuLoadPercent: 85,
        memoryUsedPercent: 90
      });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(
        result.filter(
          (d) =>
            d.metric === 'cpu_load_percent' && d.action === 'OPEN'
        )
      ).toHaveLength(1);
      expect(
        result.filter(
          (d) =>
            d.metric === 'memory_used_percent' && d.action === 'OPEN'
        )
      ).toHaveLength(1);
    });
  });
});
