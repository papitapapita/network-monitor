// Source: src/domain/wireless-monitoring/services/AlertConfirmation.ts

import {
  CCQ_IDLE_TRAFFIC_BPS,
  ConfirmationSample,
  confirmAlertDecisions,
  needsConfirmation
} from '../../../../src/domain/wireless-monitoring/services/AlertConfirmation';
import { AlertDecision } from '../../../../src/domain/wireless-monitoring/services/IWirelessAlertEvaluator';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessMetricsProps } from '../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';

function makeMetrics(
  overrides: Partial<WirelessMetricsProps> = {}
): WirelessMetrics {
  return WirelessMetrics.create({
    signalRxDbm: null,
    signalTxDbm: null,
    noiseFloorDbm: null,
    snrDb: null,
    ccqPercent: null,
    frequencyMhz: null,
    channelWidthMhz: null,
    throughputTxBps: 2_000_000,
    throughputRxBps: 1_000_000,
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
    ssid: null,
    ...overrides
  }).value;
}

function makeDecision(
  overrides: Partial<AlertDecision> = {}
): AlertDecision {
  return {
    metric: 'ccq_percent',
    action: 'OPEN',
    severity: 'WARNING',
    currentValue: 60,
    threshold: 75,
    message: 'Calidad de conexión degradada',
    ...overrides
  };
}

function sample(
  decisions: AlertDecision[],
  metrics: WirelessMetrics = makeMetrics()
): ConfirmationSample {
  return { metrics, decisions };
}

describe('[WLS-203] [WLS-204] AlertConfirmation', () => {
  describe('needsConfirmation', () => {
    it.each([
      'ccq_percent',
      'latency_ms',
      'signal_rx_dbm',
      'signal_tx_dbm',
      'snr_db',
      'capacity_kbps'
    ])('holds back an opening %s alert', (metric) => {
      expect(needsConfirmation(makeDecision({ metric }))).toBe(true);
    });

    it.each([
      'throughput_saturation',
      'cpu_percent',
      'distance_m',
      'parent_ap_mismatch'
    ])('lets %s open on the first reading', (metric) => {
      expect(needsConfirmation(makeDecision({ metric }))).toBe(false);
    });

    it('never holds back a clear', () => {
      expect(
        needsConfirmation(makeDecision({ action: 'CLEAR' }))
      ).toBe(false);
    });
  });

  describe('confirmAlertDecisions', () => {
    const ccq = makeDecision();

    it('confirms an alert most readings breach', () => {
      const outcome = confirmAlertDecisions(
        [ccq],
        [
          sample([ccq]),
          sample([ccq]),
          sample([ccq]),
          sample([]),
          sample([])
        ]
      );
      expect(outcome.confirmed).toEqual([ccq]);
      expect(outcome.rejected).toEqual([]);
    });

    it('rejects an alert only half the readings breach', () => {
      const outcome = confirmAlertDecisions(
        [ccq],
        [sample([ccq]), sample([ccq]), sample([]), sample([])]
      );
      expect(outcome.confirmed).toEqual([]);
      expect(outcome.rejected).toEqual([ccq]);
    });

    it('matches on severity, not only on metric', () => {
      const critical = makeDecision({ severity: 'CRITICAL' });
      const outcome = confirmAlertDecisions(
        [critical],
        [sample([ccq]), sample([ccq]), sample([ccq])]
      );
      expect(outcome.rejected).toEqual([critical]);
    });

    it('judges each alert on its own', () => {
      const latency = makeDecision({ metric: 'latency_ms' });
      const outcome = confirmAlertDecisions(
        [ccq, latency],
        [sample([latency]), sample([latency, ccq]), sample([latency])]
      );
      expect(outcome.confirmed).toEqual([latency]);
      expect(outcome.rejected).toEqual([ccq]);
    });

    it('opens everything when no reading came back', () => {
      const outcome = confirmAlertDecisions([ccq], []);
      expect(outcome.confirmed).toEqual([ccq]);
    });

    it('does not count low CCQ on an idle link as a breach', () => {
      const idle = makeMetrics({
        throughputTxBps: CCQ_IDLE_TRAFFIC_BPS / 2 - 1,
        throughputRxBps: CCQ_IDLE_TRAFFIC_BPS / 2 - 1
      });
      const outcome = confirmAlertDecisions(
        [ccq],
        [
          sample([ccq], idle),
          sample([ccq], idle),
          sample([ccq], idle)
        ]
      );
      expect(outcome.rejected).toEqual([ccq]);
    });

    it('counts low CCQ once the link carries traffic', () => {
      const busy = makeMetrics({
        throughputTxBps: CCQ_IDLE_TRAFFIC_BPS,
        throughputRxBps: 0
      });
      const outcome = confirmAlertDecisions(
        [ccq],
        [sample([ccq], busy), sample([ccq], busy)]
      );
      expect(outcome.confirmed).toEqual([ccq]);
    });

    it('counts low CCQ when the radio reports no traffic figure', () => {
      const unknown = makeMetrics({
        throughputTxBps: null,
        throughputRxBps: null
      });
      const outcome = confirmAlertDecisions(
        [ccq],
        [sample([ccq], unknown)]
      );
      expect(outcome.confirmed).toEqual([ccq]);
    });

    it('applies the idle check to CCQ only', () => {
      const signal = makeDecision({ metric: 'signal_rx_dbm' });
      const idle = makeMetrics({
        throughputTxBps: 0,
        throughputRxBps: 0
      });
      const outcome = confirmAlertDecisions(
        [signal],
        [sample([signal], idle)]
      );
      expect(outcome.confirmed).toEqual([signal]);
    });
  });
});
