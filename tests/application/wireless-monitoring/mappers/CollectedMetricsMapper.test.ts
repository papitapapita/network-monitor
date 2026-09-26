import { CollectedMetricsMapper } from '../../../../src/application/wireless-monitoring/mappers/CollectedMetricsMapper';
import { WirelessCollectionResult } from '../../../../src/application/wireless-monitoring/interfaces';

function makeCollected(
  overrides: Partial<WirelessCollectionResult> = {}
): WirelessCollectionResult {
  return {
    deviceName: 'CPE-Juan',
    firmwareVersion: 'WA.v8.7.11',
    uptimeSeconds: 1000,
    deviceTimeEpoch: 1_790_000_000,
    cpuLoadPercent: 10,
    memoryUsedPercent: 40,
    essid: 'ISP',
    mode: 'sta-ptmp',
    frequencyMhz: 5180,
    channelWidthMhz: 20,
    noiseFloorDbm: -95,
    throughputTxBps: 1_000_000,
    throughputRxBps: 2_000_000,
    wirelessTxBytes: null,
    wirelessRxBytes: null,
    distanceM: 800,
    clientsConnected: null,
    ccqPercent: 95,
    signalRxDbm: -60,
    signalTxDbm: -62,
    latencyMs: 2,
    remoteApMac: 'AA:BB:CC:DD:EE:FF',
    remoteApName: 'AP-Norte',
    remoteApIp: '10.0.0.1',
    capacityTxKbps: 50_000,
    capacityRxKbps: 60_000,
    lanStatus: 'UP',
    lanSpeedMbps: 100,
    macAddress: '11:22:33:44:55:66',
    deviceModel: 'LiteBeam 5AC',
    clients: [],
    ...overrides
  };
}

describe('CollectedMetricsMapper.toMetrics', () => {
  it('should carry the collected fields onto the metrics', () => {
    const metrics =
      CollectedMetricsMapper.toMetrics(makeCollected()).value;

    expect(metrics.signalRxDbm).toBe(-60);
    expect(metrics.ssid).toBe('ISP');
    expect(metrics.remoteApIp).toBe('10.0.0.1');
    expect(metrics.throughputTxBps).toBe(1_000_000);
    expect(metrics.throughputTxPps).toBeNull();
  });

  it('should derive SNR from signal and noise floor', () => {
    const metrics =
      CollectedMetricsMapper.toMetrics(makeCollected()).value;

    expect(metrics.snrDb).toBe(35);
  });

  it('should leave SNR null when either input is missing', () => {
    const metrics = CollectedMetricsMapper.toMetrics(
      makeCollected({ noiseFloorDbm: null })
    ).value;

    expect(metrics.snrDb).toBeNull();
  });

  it('should let a throughput override replace the firmware figures', () => {
    const metrics = CollectedMetricsMapper.toMetrics(
      makeCollected(),
      {
        txBps: 7,
        rxBps: null
      }
    ).value;

    expect(metrics.throughputTxBps).toBe(7);
    expect(metrics.throughputRxBps).toBeNull();
  });
});
