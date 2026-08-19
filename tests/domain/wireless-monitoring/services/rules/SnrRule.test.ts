// Source: src/domain/wireless-monitoring/services/rules/SnrRule.ts

import { SnrRule } from '../../../../../src/domain/wireless-monitoring/services/rules/SnrRule';
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

describe('[WLS-081] [WLS-082] [WLS-084] SnrRule', () => {
  let rule: SnrRule;

  beforeEach(() => {
    rule = new SnrRule();
  });

  describe('snr_db — stored value path', () => {
    it('should return [] when both snrDb and signal/noise fields are null', () => {
      const metrics = makeMetrics();
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should emit OPEN WARNING when snrDb is below 15 dB and no active alert', () => {
      const metrics = makeMetrics({ snrDb: 12 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find((d) => d.severity === 'WARNING');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.metric).toBe('snr_db');
      expect(decision!.currentValue).toBe(12);
      expect(decision!.threshold).toBe(15);
    });

    it('should emit OPEN CRITICAL when snrDb is below 10 dB and no active alert', () => {
      const metrics = makeMetrics({ snrDb: 8 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find((d) => d.severity === 'CRITICAL');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.threshold).toBe(10);
    });

    it('should emit CLEAR WARNING when snrDb recovers above 17 dB and active WARNING alert exists', () => {
      const metrics = makeMetrics({ snrDb: 18 });
      const alerts = activeMap(['snr_db', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find((d) => d.severity === 'WARNING');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should emit CLEAR CRITICAL when snrDb recovers above 12 dB and active CRITICAL alert exists', () => {
      const metrics = makeMetrics({ snrDb: 14 });
      const alerts = activeMap(['snr_db', 'CRITICAL']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find((d) => d.severity === 'CRITICAL');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when WARNING is already active and breach continues', () => {
      const metrics = makeMetrics({ snrDb: 10 });
      const alerts = activeMap(['snr_db', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter((d) => d.action === 'OPEN');
      expect(opens).toHaveLength(0);
    });

    it('should not emit CLEAR when snrDb is in WARNING hysteresis band (15 to 17)', () => {
      const metrics = makeMetrics({ snrDb: 16 });
      const alerts = activeMap(['snr_db', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      expect(result).toHaveLength(0);
    });
  });

  describe('snr_db — computed from signalRxDbm − noiseFloorDbm when snrDb is null', () => {
    it('should emit OPEN WARNING using computed SNR when snrDb is null but signal and noise are present', () => {
      // signalRxDbm = -75, noiseFloorDbm = -90 → SNR = 15, but breach is < 15, so use 14
      const metrics = makeMetrics({
        signalRxDbm: -76,
        noiseFloorDbm: -90,
        snrDb: null
      });
      // computed SNR = -76 - (-90) = 14, which is < 15 → WARNING breach
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) => d.severity === 'WARNING' && d.action === 'OPEN'
      );
      expect(decision).toBeDefined();
      expect(decision!.currentValue).toBe(14);
    });

    it('should return [] when snrDb is null and only signalRxDbm is present (no noiseFloorDbm)', () => {
      const metrics = makeMetrics({
        signalRxDbm: -76,
        noiseFloorDbm: null,
        snrDb: null
      });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should return [] when snrDb is null and only noiseFloorDbm is present (no signalRxDbm)', () => {
      const metrics = makeMetrics({
        signalRxDbm: null,
        noiseFloorDbm: -90,
        snrDb: null
      });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should prefer stored snrDb over computed value when snrDb is not null', () => {
      // signal - noise would give 5 dB (CRITICAL breach) but snrDb says 20 dB (healthy)
      const metrics = makeMetrics({
        signalRxDbm: -85,
        noiseFloorDbm: -90,
        snrDb: 20
      });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(result).toHaveLength(0);
    });

    it('should emit CLEAR using computed SNR when snrDb is null and SNR recovers above 17 dB', () => {
      // computed SNR = -70 - (-90) = 20, which is > 17 → CLEAR
      const metrics = makeMetrics({
        signalRxDbm: -70,
        noiseFloorDbm: -90,
        snrDb: null
      });
      const alerts = activeMap(['snr_db', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find((d) => d.severity === 'WARNING');
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });
  });
});
