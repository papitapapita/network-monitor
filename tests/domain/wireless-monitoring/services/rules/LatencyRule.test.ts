import { LatencyRule } from '../../../../../src/domain/wireless-monitoring/services/rules/LatencyRule';
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
    50,
    60,
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

describe('[WLS-086] LatencyRule', () => {
  let rule: LatencyRule;

  beforeEach(() => {
    rule = new LatencyRule();
  });

  describe('null guard', () => {
    it('should return [] when latencyMs is null', () => {
      const metrics = makeMetrics({ latencyMs: null });
      expect(
        rule.evaluate(metrics, makeContext(), new Map())
      ).toHaveLength(0);
    });
  });

  describe('latency_ms WARNING (threshold: 50 ms)', () => {
    it('should emit OPEN WARNING when latencyMs exceeds 50 ms', () => {
      const metrics = makeMetrics({ latencyMs: 51 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) => d.metric === 'latency_ms' && d.severity === 'WARNING'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.currentValue).toBe(51);
      expect(decision!.threshold).toBe(50);
    });

    it('should not emit OPEN WARNING when alert is already active', () => {
      const metrics = makeMetrics({ latencyMs: 80 });
      const alerts = activeMap(['latency_ms', 'WARNING']);
      const opens = rule
        .evaluate(metrics, makeContext(), alerts)
        .filter(
          (d) =>
            d.metric === 'latency_ms' &&
            d.severity === 'WARNING' &&
            d.action === 'OPEN'
        );
      expect(opens).toHaveLength(0);
    });

    it('should emit CLEAR WARNING when latencyMs recovers to 50 ms or below', () => {
      const metrics = makeMetrics({ latencyMs: 40 });
      const alerts = activeMap(['latency_ms', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(
        (d) => d.metric === 'latency_ms' && d.severity === 'WARNING'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
      expect(decision!.currentValue).toBe(40);
    });
  });

  describe('latency_ms CRITICAL (threshold: 150 ms)', () => {
    it('should emit OPEN CRITICAL when latencyMs exceeds 150 ms', () => {
      const metrics = makeMetrics({ latencyMs: 200 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) => d.metric === 'latency_ms' && d.severity === 'CRITICAL'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.currentValue).toBe(200);
      expect(decision!.threshold).toBe(150);
    });

    it('should not emit OPEN CRITICAL when alert is already active', () => {
      const metrics = makeMetrics({ latencyMs: 200 });
      const alerts = activeMap(['latency_ms', 'CRITICAL']);
      const opens = rule
        .evaluate(metrics, makeContext(), alerts)
        .filter(
          (d) =>
            d.metric === 'latency_ms' &&
            d.severity === 'CRITICAL' &&
            d.action === 'OPEN'
        );
      expect(opens).toHaveLength(0);
    });

    it('should emit CLEAR CRITICAL when latencyMs recovers to 150 ms or below', () => {
      const metrics = makeMetrics({ latencyMs: 100 });
      const alerts = activeMap(['latency_ms', 'CRITICAL']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(
        (d) => d.metric === 'latency_ms' && d.severity === 'CRITICAL'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });
  });

  describe('independent evaluation of WARNING and CRITICAL', () => {
    it('should emit both OPEN WARNING and OPEN CRITICAL when latencyMs > 150 ms', () => {
      const metrics = makeMetrics({ latencyMs: 200 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(
        result.filter(
          (d) => d.action === 'OPEN' && d.severity === 'WARNING'
        )
      ).toHaveLength(1);
      expect(
        result.filter(
          (d) => d.action === 'OPEN' && d.severity === 'CRITICAL'
        )
      ).toHaveLength(1);
    });

    it('should emit only OPEN WARNING when latencyMs is between 51 and 150 ms', () => {
      const metrics = makeMetrics({ latencyMs: 100 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(
        result.filter(
          (d) => d.action === 'OPEN' && d.severity === 'WARNING'
        )
      ).toHaveLength(1);
      expect(
        result.filter((d) => d.severity === 'CRITICAL')
      ).toHaveLength(0);
    });
  });

  describe('no decision within thresholds', () => {
    it('should return [] when latencyMs is exactly 50 (boundary — no alert)', () => {
      const metrics = makeMetrics({ latencyMs: 50 });
      expect(
        rule.evaluate(metrics, makeContext(), new Map())
      ).toHaveLength(0);
    });

    it('should emit OPEN WARNING when latencyMs is 51 (boundary — open)', () => {
      const metrics = makeMetrics({ latencyMs: 51 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) => d.severity === 'WARNING' && d.action === 'OPEN'
      );
      expect(decision).toBeDefined();
    });
  });

  describe('message content', () => {
    it('should include device name in the OPEN WARNING message', () => {
      const metrics = makeMetrics({ latencyMs: 80 });
      const result = rule.evaluate(
        metrics,
        makeContext({ deviceName: 'Torre-01' }),
        new Map()
      );
      const decision = result.find(
        (d) => d.severity === 'WARNING' && d.action === 'OPEN'
      );
      expect(decision!.message).toContain('Torre-01');
    });
  });
});
