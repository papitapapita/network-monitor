// Source: src/domain/wireless-monitoring/services/rules/SignalStrengthRule.ts

import { SignalStrengthRule } from '../../../../../src/domain/wireless-monitoring/services/rules/SignalStrengthRule';
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

describe('[WLS-081] [WLS-082] [WLS-083] SignalStrengthRule', () => {
  let rule: SignalStrengthRule;

  beforeEach(() => {
    rule = new SignalStrengthRule();
  });

  describe('signal_rx_dbm', () => {
    it('should return [] when signalRxDbm is null', () => {
      const metrics = makeMetrics({ signalRxDbm: null });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const rxDecisions = result.filter(
        (d) => d.metric === 'signal_rx_dbm'
      );
      expect(rxDecisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when signal is below -70 dBm and no active alert', () => {
      const metrics = makeMetrics({ signalRxDbm: -72 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) =>
          d.metric === 'signal_rx_dbm' && d.severity === 'WARNING'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.currentValue).toBe(-72);
      expect(decision!.threshold).toBe(-70);
    });

    it('should emit OPEN CRITICAL when signal is below -80 dBm and no active alert', () => {
      const metrics = makeMetrics({ signalRxDbm: -82 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) =>
          d.metric === 'signal_rx_dbm' && d.severity === 'CRITICAL'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.currentValue).toBe(-82);
      expect(decision!.threshold).toBe(-80);
    });

    it('should emit CLEAR WARNING when signal recovers above -68 dBm and active WARNING alert exists', () => {
      const metrics = makeMetrics({ signalRxDbm: -65 });
      const alerts = activeMap(['signal_rx_dbm', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(
        (d) =>
          d.metric === 'signal_rx_dbm' && d.severity === 'WARNING'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should emit CLEAR CRITICAL when signal recovers above -78 dBm and active CRITICAL alert exists', () => {
      const metrics = makeMetrics({ signalRxDbm: -76 });
      const alerts = activeMap(['signal_rx_dbm', 'CRITICAL']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(
        (d) =>
          d.metric === 'signal_rx_dbm' && d.severity === 'CRITICAL'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN when WARNING alert is already active and breach continues', () => {
      const metrics = makeMetrics({ signalRxDbm: -75 });
      const alerts = activeMap(['signal_rx_dbm', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter(
        (d) => d.metric === 'signal_rx_dbm' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });

    it('should not emit CLEAR WARNING when signal is in hysteresis band (-70 to -68)', () => {
      const metrics = makeMetrics({ signalRxDbm: -69 });
      const alerts = activeMap(['signal_rx_dbm', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(
        (d) =>
          d.metric === 'signal_rx_dbm' && d.severity === 'WARNING'
      );
      expect(decision).toBeUndefined();
    });

    it('should not emit OPEN WARNING when signal is exactly at -70 dBm (boundary is exclusive)', () => {
      const metrics = makeMetrics({ signalRxDbm: -70 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) =>
          d.metric === 'signal_rx_dbm' &&
          d.severity === 'WARNING' &&
          d.action === 'OPEN'
      );
      expect(decision).toBeUndefined();
    });
  });

  describe('signal_tx_dbm', () => {
    it('should return [] when signalTxDbm is null', () => {
      const metrics = makeMetrics({ signalTxDbm: null });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const txDecisions = result.filter(
        (d) => d.metric === 'signal_tx_dbm'
      );
      expect(txDecisions).toHaveLength(0);
    });

    it('should emit OPEN WARNING when Tx signal is below -70 dBm and no active alert', () => {
      const metrics = makeMetrics({ signalTxDbm: -73 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) =>
          d.metric === 'signal_tx_dbm' && d.severity === 'WARNING'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.threshold).toBe(-70);
    });

    it('should emit OPEN CRITICAL when Tx signal is below -80 dBm and no active alert', () => {
      const metrics = makeMetrics({ signalTxDbm: -81 });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      const decision = result.find(
        (d) =>
          d.metric === 'signal_tx_dbm' && d.severity === 'CRITICAL'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('OPEN');
      expect(decision!.threshold).toBe(-80);
    });

    it('should emit CLEAR WARNING when Tx signal recovers and active alert exists', () => {
      const metrics = makeMetrics({ signalTxDbm: -60 });
      const alerts = activeMap(['signal_tx_dbm', 'WARNING']);
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const decision = result.find(
        (d) =>
          d.metric === 'signal_tx_dbm' && d.severity === 'WARNING'
      );
      expect(decision).toBeDefined();
      expect(decision!.action).toBe('CLEAR');
    });

    it('should not emit OPEN CRITICAL when CRITICAL alert is already active and breach continues', () => {
      const metrics = makeMetrics({ signalTxDbm: -85 });
      const alerts = activeMap(
        ['signal_tx_dbm', 'WARNING'],
        ['signal_tx_dbm', 'CRITICAL']
      );
      const result = rule.evaluate(metrics, makeContext(), alerts);
      const opens = result.filter(
        (d) => d.metric === 'signal_tx_dbm' && d.action === 'OPEN'
      );
      expect(opens).toHaveLength(0);
    });
  });

  describe('multi-metric independence', () => {
    it('should evaluate both signal_rx_dbm and signal_tx_dbm independently', () => {
      const metrics = makeMetrics({
        signalRxDbm: -72,
        signalTxDbm: -71
      });
      const result = rule.evaluate(metrics, makeContext(), new Map());
      expect(
        result.filter(
          (d) => d.metric === 'signal_rx_dbm' && d.action === 'OPEN'
        )
      ).toHaveLength(1);
      expect(
        result.filter(
          (d) => d.metric === 'signal_tx_dbm' && d.action === 'OPEN'
        )
      ).toHaveLength(1);
    });
  });
});
