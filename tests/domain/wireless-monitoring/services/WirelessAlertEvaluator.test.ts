import { WirelessAlertEvaluator, EvaluationContext } from '../../../../src/domain/wireless-monitoring/services/WirelessAlertEvaluator';
import { SignalStrengthRule } from '../../../../src/domain/wireless-monitoring/services/rules/SignalStrengthRule';
import { SnrRule } from '../../../../src/domain/wireless-monitoring/services/rules/SnrRule';
import { CcqRule } from '../../../../src/domain/wireless-monitoring/services/rules/CcqRule';
import { CpuMemoryRule } from '../../../../src/domain/wireless-monitoring/services/rules/CpuMemoryRule';
import { LanHealthRule } from '../../../../src/domain/wireless-monitoring/services/rules/LanHealthRule';
import { ClientCountRule } from '../../../../src/domain/wireless-monitoring/services/rules/ClientCountRule';
import { CapacityRule } from '../../../../src/domain/wireless-monitoring/services/rules/CapacityRule';
import { DistanceRule } from '../../../../src/domain/wireless-monitoring/services/rules/DistanceRule';
import { IdentityChangeRule } from '../../../../src/domain/wireless-monitoring/services/rules/IdentityChangeRule';
import { FirmwareRule } from '../../../../src/domain/wireless-monitoring/services/rules/FirmwareRule';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessAlertRecord } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { WirelessMetricsProps } from '../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

function makeDeviceId(): DeviceId {
  return DeviceId.parse(DEVICE_UUID).value;
}

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
    linkCapacityKbps: null,
    clientsProvisionedLimit: null,
    previousMetrics: null,
    ...overrides,
  };
}

/** Build an active WirelessAlertRecord via the domain factory. */
function makeActiveAlert(
  metric: string,
  severity: 'WARNING' | 'CRITICAL' = 'WARNING',
): WirelessAlertRecord {
  const result = WirelessAlertRecord.open(
    makeDeviceId(),
    metric,
    severity,
    -70,
    -72,
    'test alert'
  );
  return result.value;
}

function makeActiveAlertsMap(
  entries: Array<{ metric: string; severity: 'WARNING' | 'CRITICAL' }>
): Map<string, WirelessAlertRecord> {
  const map = new Map<string, WirelessAlertRecord>();
  for (const { metric, severity } of entries) {
    map.set(`${metric}:${severity}`, makeActiveAlert(metric, severity));
  }
  return map;
}

// ---------------------------------------------------------------------------

describe('WirelessAlertEvaluator', () => {
  let evaluator: WirelessAlertEvaluator;

  beforeEach(() => {
    evaluator = new WirelessAlertEvaluator([
      new SignalStrengthRule(),
      new SnrRule(),
      new CcqRule(),
      new CpuMemoryRule(),
      new LanHealthRule(),
      new ClientCountRule(),
      new CapacityRule(),
      new DistanceRule(),
      new IdentityChangeRule(),
      new FirmwareRule()
    ]);
  });

  // ===========================================================================
  describe('evaluate() — OPEN decisions', () => {

    it('should return OPEN for signal_rx_dbm WARNING when signal is below -70 dBm', () => {
      const metrics = makeMetrics({ signalRxDbm: -72 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'signal_rx_dbm' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
      expect(match!.currentValue).toBe(-72);
    });

    it('should return OPEN for signal_rx_dbm CRITICAL when signal is below -80 dBm', () => {
      const metrics = makeMetrics({ signalRxDbm: -82 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'signal_rx_dbm' && d.severity === 'CRITICAL');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
    });

    it('should return OPEN for snr_db WARNING when SNR is below 15 dB', () => {
      const metrics = makeMetrics({ snrDb: 12 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'snr_db' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
      expect(match!.threshold).toBe(15);
    });

    it('should return OPEN for snr_db CRITICAL when SNR is below 10 dB', () => {
      const metrics = makeMetrics({ snrDb: 8 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'snr_db' && d.severity === 'CRITICAL');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
    });

    it('should return OPEN for ccq_percent WARNING when CCQ is below 75% on an M-series device', () => {
      const metrics = makeMetrics({ ccqPercent: 70 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext({ deviceModel: 'Rocket M5' }));

      const match = decisions.find(d => d.metric === 'ccq_percent' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
    });

    it('should return OPEN for ccq_percent CRITICAL when CCQ is below 50% on an M-series device', () => {
      const metrics = makeMetrics({ ccqPercent: 40 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext({ deviceModel: 'NanoStation M5' }));

      const match = decisions.find(d => d.metric === 'ccq_percent' && d.severity === 'CRITICAL');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
    });

    it('should return OPEN for cpu_load_percent WARNING when CPU is above 80%', () => {
      const metrics = makeMetrics({ cpuLoadPercent: 85 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'cpu_load_percent' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
    });

    it('should return OPEN for memory_used_percent WARNING when memory is above 85%', () => {
      const metrics = makeMetrics({ memoryUsedPercent: 90 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'memory_used_percent' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
    });

    it('should return OPEN for clients_connected WARNING when connected clients exceed provisioned limit', () => {
      const metrics = makeMetrics({ clientsConnected: 25 });
      const ctx = makeContext({ clientsProvisionedLimit: 20 });

      const decisions = evaluator.evaluate(metrics, new Map(), ctx);

      const match = decisions.find(d => d.metric === 'clients_connected' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
      expect(match!.threshold).toBe(20);
    });

    it('should return OPEN for lan_status CRITICAL when LAN port is DOWN', () => {
      const metrics = makeMetrics({ lanStatus: 'DOWN' });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'lan_status' && d.severity === 'CRITICAL');
      expect(match).toBeDefined();
      expect(match!.action).toBe('OPEN');
      expect(match!.currentValue).toBe(0);
    });
  });

  // ===========================================================================
  describe('evaluate() — CLEAR decisions', () => {

    it('should return CLEAR for signal_rx_dbm WARNING when signal recovers above -68 dBm with active alert', () => {
      const metrics = makeMetrics({ signalRxDbm: -65 });
      const activeAlerts = makeActiveAlertsMap([{ metric: 'signal_rx_dbm', severity: 'WARNING' }]);

      const decisions = evaluator.evaluate(metrics, activeAlerts, makeContext());

      const match = decisions.find(d => d.metric === 'signal_rx_dbm' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('CLEAR');
    });

    it('should return CLEAR for snr_db WARNING when SNR recovers above 17 dB with active alert', () => {
      const metrics = makeMetrics({ snrDb: 18 });
      const activeAlerts = makeActiveAlertsMap([{ metric: 'snr_db', severity: 'WARNING' }]);

      const decisions = evaluator.evaluate(metrics, activeAlerts, makeContext());

      const match = decisions.find(d => d.metric === 'snr_db' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('CLEAR');
    });

    it('should return CLEAR for cpu_load_percent WARNING when CPU drops below 75% with active alert', () => {
      const metrics = makeMetrics({ cpuLoadPercent: 70 });
      const activeAlerts = makeActiveAlertsMap([{ metric: 'cpu_load_percent', severity: 'WARNING' }]);

      const decisions = evaluator.evaluate(metrics, activeAlerts, makeContext());

      const match = decisions.find(d => d.metric === 'cpu_load_percent' && d.severity === 'WARNING');
      expect(match).toBeDefined();
      expect(match!.action).toBe('CLEAR');
    });

    it('should return CLEAR for lan_status CRITICAL when LAN recovers to UP with active alert', () => {
      const metrics = makeMetrics({ lanStatus: 'UP' });
      const activeAlerts = makeActiveAlertsMap([{ metric: 'lan_status', severity: 'CRITICAL' }]);

      const decisions = evaluator.evaluate(metrics, activeAlerts, makeContext());

      const match = decisions.find(d => d.metric === 'lan_status' && d.severity === 'CRITICAL');
      expect(match).toBeDefined();
      expect(match!.action).toBe('CLEAR');
      expect(match!.currentValue).toBe(1);
    });
  });

  // ===========================================================================
  describe('evaluate() — hysteresis (NONE decisions)', () => {

    it('should produce no decision for signal_rx_dbm WARNING when metric breaches threshold but an active alert already exists (no duplicate OPEN)', () => {
      const metrics = makeMetrics({ signalRxDbm: -72 });
      const activeAlerts = makeActiveAlertsMap([{ metric: 'signal_rx_dbm', severity: 'WARNING' }]);

      const decisions = evaluator.evaluate(metrics, activeAlerts, makeContext());

      const openMatch = decisions.find(
        d => d.metric === 'signal_rx_dbm' && d.severity === 'WARNING' && d.action === 'OPEN'
      );
      expect(openMatch).toBeUndefined();
    });

    it('should produce no decision for snr_db WARNING when metric is between breach (-15) and clear (+17) thresholds with active alert', () => {
      // breach < 15, clear > 17 → value of 16 is in hysteresis band
      const metrics = makeMetrics({ snrDb: 16 });
      const activeAlerts = makeActiveAlertsMap([{ metric: 'snr_db', severity: 'WARNING' }]);

      const decisions = evaluator.evaluate(metrics, activeAlerts, makeContext());

      const match = decisions.find(d => d.metric === 'snr_db' && d.severity === 'WARNING');
      expect(match).toBeUndefined();
    });

    it('should produce no decision for ccq_percent WARNING when metric is in hysteresis band (75-78) with active alert', () => {
      // breach < 75, clear > 78 → value of 76 is in band
      const metrics = makeMetrics({ ccqPercent: 76 });
      const activeAlerts = makeActiveAlertsMap([{ metric: 'ccq_percent', severity: 'WARNING' }]);

      const decisions = evaluator.evaluate(metrics, activeAlerts, makeContext());

      const match = decisions.find(d => d.metric === 'ccq_percent' && d.severity === 'WARNING');
      expect(match).toBeUndefined();
    });

    it('should produce no decision for memory_used_percent WARNING when metric is in hysteresis band (80-85) with active alert', () => {
      // breach > 85, clear < 80 → value of 82 is in band
      const metrics = makeMetrics({ memoryUsedPercent: 82 });
      const activeAlerts = makeActiveAlertsMap([{ metric: 'memory_used_percent', severity: 'WARNING' }]);

      const decisions = evaluator.evaluate(metrics, activeAlerts, makeContext());

      const match = decisions.find(d => d.metric === 'memory_used_percent' && d.severity === 'WARNING');
      expect(match).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('evaluate() — no-op scenarios', () => {

    it('should return an empty array when all metrics are nominal and no active alerts exist', () => {
      const metrics = makeMetrics({
        signalRxDbm: -60,
        snrDb: 25,
        ccqPercent: 95,
        cpuLoadPercent: 30,
        memoryUsedPercent: 50,
        lanStatus: 'UP',
      });

      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      expect(decisions).toHaveLength(0);
    });

    it('should return an empty array when all metric props are null', () => {
      const metrics = makeMetrics();

      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      expect(decisions).toHaveLength(0);
    });

    it('should produce no decision for a null metric even when there is no active alert', () => {
      const metrics = makeMetrics({ signalRxDbm: null });

      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'signal_rx_dbm');
      expect(match).toBeUndefined();
    });

    it('should not produce a CLEAR decision when LAN is DOWN but there is no active alert (OPEN instead)', () => {
      const metrics = makeMetrics({ lanStatus: 'DOWN' });

      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const clearMatch = decisions.find(d => d.metric === 'lan_status' && d.action === 'CLEAR');
      expect(clearMatch).toBeUndefined();
    });

    it('should not produce any decision for LAN when lanStatus is null', () => {
      const metrics = makeMetrics({ lanStatus: null });

      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'lan_status');
      expect(match).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('evaluate() — context-dependent thresholds', () => {

    it('should produce no throughput_tx_bps decision when linkCapacityKbps is null', () => {
      const metrics = makeMetrics({ throughputTxBps: 99_000_000 });
      const ctx = makeContext({ linkCapacityKbps: null });

      const decisions = evaluator.evaluate(metrics, new Map(), ctx);

      const match = decisions.find(d => d.metric === 'throughput_tx_bps');
      expect(match).toBeUndefined();
    });

    it('should produce no clients_connected decision when clientsProvisionedLimit is null', () => {
      const metrics = makeMetrics({ clientsConnected: 999 });
      const ctx = makeContext({ clientsProvisionedLimit: null });

      const decisions = evaluator.evaluate(metrics, new Map(), ctx);

      const match = decisions.find(d => d.metric === 'clients_connected');
      expect(match).toBeUndefined();
    });

    it('should not open clients_connected alert when connected equals the limit exactly', () => {
      const metrics = makeMetrics({ clientsConnected: 20 });
      const ctx = makeContext({ clientsProvisionedLimit: 20 });

      const decisions = evaluator.evaluate(metrics, new Map(), ctx);

      const openMatch = decisions.find(d => d.metric === 'clients_connected' && d.action === 'OPEN');
      expect(openMatch).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('evaluate() — alert message language', () => {

    it('should use Spanish in the signal_rx_dbm message (contains "señal")', () => {
      const metrics = makeMetrics({ signalRxDbm: -72 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'signal_rx_dbm' && d.severity === 'WARNING');
      expect(match!.message.toLowerCase()).toContain('señal');
    });

    it('should include "umbral" in the signal_rx_dbm message', () => {
      const metrics = makeMetrics({ signalRxDbm: -72 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'signal_rx_dbm' && d.severity === 'WARNING');
      expect(match!.message.toLowerCase()).toContain('umbral');
    });

    it('should use Spanish in the snr_db message (contains "señal" or "ruido")', () => {
      const metrics = makeMetrics({ snrDb: 8 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'snr_db' && d.severity === 'CRITICAL');
      expect(match!.message.toLowerCase()).toMatch(/señal|ruido/);
    });

    it('should use Spanish in the cpu_load_percent message (contains "cpu")', () => {
      const metrics = makeMetrics({ cpuLoadPercent: 85 });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'cpu_load_percent');
      expect(match!.message.toLowerCase()).toContain('cpu');
    });

    it('should use Spanish in the lan_status DOWN message (contains "lan")', () => {
      const metrics = makeMetrics({ lanStatus: 'DOWN' });
      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const match = decisions.find(d => d.metric === 'lan_status');
      expect(match!.message.toLowerCase()).toContain('lan');
    });

    it('should include the device name in the message', () => {
      const metrics = makeMetrics({ signalRxDbm: -72 });
      const ctx = makeContext({ deviceName: 'TORRE-NORTE' });
      const decisions = evaluator.evaluate(metrics, new Map(), ctx);

      const match = decisions.find(d => d.metric === 'signal_rx_dbm' && d.severity === 'WARNING');
      expect(match!.message).toContain('TORRE-NORTE');
    });
  });

  // ===========================================================================
  describe('evaluate() — multiple simultaneous breaches', () => {

    it('should return multiple OPEN decisions when several thresholds breach at once', () => {
      const metrics = makeMetrics({
        signalRxDbm: -85,   // breaches signal WARNING (< -70) AND CRITICAL (< -80)
        ccqPercent: 40,      // breaches ccq WARNING (< 75) AND CRITICAL (< 50) — M-series only
        cpuLoadPercent: 90,  // breaches cpu WARNING (> 80)
        lanStatus: 'DOWN',   // breaches lan CRITICAL
      });

      const decisions = evaluator.evaluate(metrics, new Map(), makeContext({ deviceModel: 'Rocket M5' }));

      const openDecisions = decisions.filter(d => d.action === 'OPEN');
      // signal: 2 (WARNING + CRITICAL), ccq: 2 (WARNING + CRITICAL), cpu: 1, lan: 1 = 6
      expect(openDecisions.length).toBeGreaterThanOrEqual(6);
    });

    it('should return independent decisions for WARNING and CRITICAL of the same metric', () => {
      const metrics = makeMetrics({ signalRxDbm: -85 }); // breaches both -70 and -80 thresholds

      const decisions = evaluator.evaluate(metrics, new Map(), makeContext());

      const warningMatch = decisions.find(d => d.metric === 'signal_rx_dbm' && d.severity === 'WARNING');
      const criticalMatch = decisions.find(d => d.metric === 'signal_rx_dbm' && d.severity === 'CRITICAL');
      expect(warningMatch).toBeDefined();
      expect(criticalMatch).toBeDefined();
      expect(warningMatch!.action).toBe('OPEN');
      expect(criticalMatch!.action).toBe('OPEN');
    });
  });
});
