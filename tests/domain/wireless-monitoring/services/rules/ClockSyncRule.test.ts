import { ClockSyncRule } from '../../../../../src/domain/wireless-monitoring/services/rules/ClockSyncRule';
import { WirelessMetrics } from '../../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessAlertRecord } from '../../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { WirelessMetricsProps } from '../../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';
import { EvaluationContext } from '../../../../../src/domain/wireless-monitoring/services/IWirelessAlertEvaluator';
import { DeviceId } from '../../../../../src/domain/shared/ids/DeviceId';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const COLLECTED_AT = new Date(1_700_000_000_000);
const COLLECTED_AT_S = COLLECTED_AT.getTime() / 1000;

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
    collectedAt: COLLECTED_AT,
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

describe('ClockSyncRule', () => {
  let rule: ClockSyncRule;

  beforeEach(() => {
    rule = new ClockSyncRule();
  });

  describe('clock_drift_s', () => {
    it('should return [] when deviceTimeEpoch is null', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: null });
      expect(rule.evaluate(metrics, makeContext(), new Map())).toHaveLength(0);
    });

    it('should emit OPEN WARNING when drift exceeds 300 s and no active alert', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: COLLECTED_AT_S - 400 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(d => d.metric === 'clock_drift_s');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(400);
      expect(decision!.threshold).toBe(300);
    });

    it('should not emit OPEN when alert is already active and drift still exceeds threshold', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: COLLECTED_AT_S - 600 });
      const alerts = activeMap(['clock_drift_s', 'WARNING']);
      const opens = rule.evaluate(metrics, makeContext(), alerts).filter(d => d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should emit CLEAR when drift recovers and alert is active', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: COLLECTED_AT_S - 100 });
      const alerts = activeMap(['clock_drift_s', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(d => d.metric === 'clock_drift_s');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
      expect(decision!.severity).toBe('WARNING');
      expect(decision!.currentValue).toBe(100);
      expect(decision!.threshold).toBe(300);
    });

    it('should not emit CLEAR when drift is still high and alert is active', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: COLLECTED_AT_S - 500 });
      const alerts = activeMap(['clock_drift_s', 'WARNING']);
      const clears = rule.evaluate(metrics, makeContext(), alerts).filter(d => d.action === 'CLEAR');
      expect(clears).toHaveLength(0);
    });

    it('should return [] when drift is within threshold and no active alert', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: COLLECTED_AT_S - 200 });
      expect(rule.evaluate(metrics, makeContext(), new Map())).toHaveLength(0);
    });

    it('should emit CLEAR when drift is exactly at threshold and alert is active', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: COLLECTED_AT_S - 300 });
      const alerts = activeMap(['clock_drift_s', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(d => d.metric === 'clock_drift_s');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should include the device name in the OPEN message', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: COLLECTED_AT_S - 400 });
      const result = rule.evaluate(metrics, makeContext({ deviceName: 'AP-Roof' }), new Map());
      const decision = result.find(d => d.metric === 'clock_drift_s' && d.action === 'OPEN');
      expect(decision!.message).toContain('AP-Roof');
    });

    it('should include the device name in the CLEAR message', () => {
      const metrics = makeMetrics({ deviceTimeEpoch: COLLECTED_AT_S - 50 });
      const alerts = activeMap(['clock_drift_s', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext({ deviceName: 'AP-Roof' }), alerts);
      const decision = result.find(d => d.metric === 'clock_drift_s' && d.action === 'CLEAR');
      expect(decision!.message).toContain('AP-Roof');
    });
  });
});
