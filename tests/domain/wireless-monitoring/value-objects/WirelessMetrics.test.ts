// Source: src/domain/wireless-monitoring/value-objects/WirelessMetrics.ts

import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { WirelessMetricsProps } from '../../../../src/domain/wireless-monitoring/props/WirelessMetricsProps';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNullProps(): WirelessMetricsProps {
  return {
    signalRxDbm: null,
    signalTxDbm: null,
    noiseFloorDbm: null,
    snrDb: null,
    ccqPercent: null,
    txRateMbps: null,
    rxRateMbps: null,
    frequencyMhz: null,
    channelWidthMhz: null,
    txPowerDbm: null,
    throughputTxBps: null,
    throughputRxBps: null,
    lanStatus: null,
    lanSpeedMbps: null,
    lanDuplex: null,
    uptimeSeconds: null,
    cpuLoadPercent: null,
    memoryUsedPercent: null,
    clientsConnected: null,
    clientsProvisioned: null,
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
  };
}

function makeFullProps(overrides: Partial<WirelessMetricsProps> = {}): WirelessMetricsProps {
  return {
    signalRxDbm: -65,
    signalTxDbm: -60,
    noiseFloorDbm: -90,
    snrDb: 25,
    ccqPercent: 95,
    txRateMbps: 300,
    rxRateMbps: 300,
    frequencyMhz: 5180,
    channelWidthMhz: 40,
    txPowerDbm: 20,
    throughputTxBps: 5_000_000,
    throughputRxBps: 3_000_000,
    lanStatus: 'UP',
    lanSpeedMbps: 1000,
    lanDuplex: 'FULL',
    uptimeSeconds: 86400,
    cpuLoadPercent: 30,
    memoryUsedPercent: 50,
    clientsConnected: 5,
    clientsProvisioned: 20,
    throughputTxPps: 1200,
    throughputRxPps: 900,
    firmwareVersion: 'WA.v8.7.11',
    deviceName: 'CPE-001',
    remoteApMac: 'aa:bb:cc:dd:ee:ff',
    remoteApName: 'AP-Roof',
    remoteApIp: null,
    distanceM: 1500,
    latencyMs: 4,
    capacityTxKbps: null,
    capacityRxKbps: null,
    deviceTimeEpoch: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('WirelessMetrics', () => {

  // ===========================================================================
  describe('create()', () => {
    it('should return a successful Result wrapping a WirelessMetrics instance', () => {
      const result = WirelessMetrics.create(makeFullProps());

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(WirelessMetrics);
    });

    it('should fail when ccqPercent is out of range', () => {
      const result = WirelessMetrics.create(makeFullProps({ ccqPercent: 101 }));

      expect(result.isFailure).toBe(true);
    });

    it('should fail when cpuLoadPercent is negative', () => {
      const result = WirelessMetrics.create(makeFullProps({ cpuLoadPercent: -1 }));

      expect(result.isFailure).toBe(true);
    });

    it('should fail when memoryUsedPercent exceeds 100', () => {
      const result = WirelessMetrics.create(makeFullProps({ memoryUsedPercent: 200 }));

      expect(result.isFailure).toBe(true);
    });

    it('should fail when frequencyMhz is zero', () => {
      const result = WirelessMetrics.create(makeFullProps({ frequencyMhz: 0 }));

      expect(result.isFailure).toBe(true);
    });

    it('should fail when channelWidthMhz is negative', () => {
      const result = WirelessMetrics.create(makeFullProps({ channelWidthMhz: -20 }));

      expect(result.isFailure).toBe(true);
    });

    it('should fail when lanStatus is an invalid value', () => {
      const result = WirelessMetrics.create(makeFullProps({ lanStatus: 'UNKNOWN' as 'UP' }));

      expect(result.isFailure).toBe(true);
    });

    it('should fail when lanDuplex is an invalid value', () => {
      const result = WirelessMetrics.create(makeFullProps({ lanDuplex: 'AUTO' as 'FULL' }));

      expect(result.isFailure).toBe(true);
    });

    it('should fail when remoteApMac is not a valid MAC address', () => {
      const result = WirelessMetrics.create(makeFullProps({ remoteApMac: 'not-a-mac' }));

      expect(result.isFailure).toBe(true);
    });

    it('should succeed when all nullable fields are null', () => {
      const result = WirelessMetrics.create(makeNullProps());

      expect(result.isSuccess).toBe(true);
    });
  });

  // ===========================================================================
  describe('reconstitute()', () => {
    it('should return a WirelessMetrics instance with all props preserved', () => {
      const props = makeFullProps();
      const metrics = WirelessMetrics.reconstitute(props);

      expect(metrics).toBeInstanceOf(WirelessMetrics);
      expect(metrics.signalRxDbm).toBe(props.signalRxDbm);
      expect(metrics.firmwareVersion).toBe(props.firmwareVersion);
    });
  });

  // ===========================================================================
  describe('getters — original fields', () => {
    it('should expose signalRxDbm', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ signalRxDbm: -65 })).value;

      expect(metrics.signalRxDbm).toBe(-65);
    });

    it('should expose signalTxDbm', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ signalTxDbm: -60 })).value;

      expect(metrics.signalTxDbm).toBe(-60);
    });

    it('should expose noiseFloorDbm', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ noiseFloorDbm: -90 })).value;

      expect(metrics.noiseFloorDbm).toBe(-90);
    });

    it('should expose snrDb', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ snrDb: 25 })).value;

      expect(metrics.snrDb).toBe(25);
    });

    it('should expose ccqPercent', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ ccqPercent: 95 })).value;

      expect(metrics.ccqPercent).toBe(95);
    });

    it('should expose txRateMbps', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ txRateMbps: 300 })).value;

      expect(metrics.txRateMbps).toBe(300);
    });

    it('should expose rxRateMbps', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ rxRateMbps: 150 })).value;

      expect(metrics.rxRateMbps).toBe(150);
    });

    it('should expose frequencyMhz', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ frequencyMhz: 5180 })).value;

      expect(metrics.frequencyMhz).toBe(5180);
    });

    it('should expose channelWidthMhz', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ channelWidthMhz: 40 })).value;

      expect(metrics.channelWidthMhz).toBe(40);
    });

    it('should expose txPowerDbm', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ txPowerDbm: 20 })).value;

      expect(metrics.txPowerDbm).toBe(20);
    });

    it('should expose throughputTxBps', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ throughputTxBps: 5_000_000 })).value;

      expect(metrics.throughputTxBps).toBe(5_000_000);
    });

    it('should expose throughputRxBps', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ throughputRxBps: 3_000_000 })).value;

      expect(metrics.throughputRxBps).toBe(3_000_000);
    });

    it('should expose lanStatus UP', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ lanStatus: 'UP' })).value;

      expect(metrics.lanStatus).toBe('UP');
    });

    it('should expose lanStatus DOWN', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ lanStatus: 'DOWN' })).value;

      expect(metrics.lanStatus).toBe('DOWN');
    });

    it('should expose lanSpeedMbps', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ lanSpeedMbps: 1000 })).value;

      expect(metrics.lanSpeedMbps).toBe(1000);
    });

    it('should expose lanDuplex FULL', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ lanDuplex: 'FULL' })).value;

      expect(metrics.lanDuplex).toBe('FULL');
    });

    it('should expose uptimeSeconds', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ uptimeSeconds: 86400 })).value;

      expect(metrics.uptimeSeconds).toBe(86400);
    });

    it('should expose cpuLoadPercent', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ cpuLoadPercent: 30 })).value;

      expect(metrics.cpuLoadPercent).toBe(30);
    });

    it('should expose memoryUsedPercent', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ memoryUsedPercent: 50 })).value;

      expect(metrics.memoryUsedPercent).toBe(50);
    });

    it('should expose clientsConnected', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ clientsConnected: 5 })).value;

      expect(metrics.clientsConnected).toBe(5);
    });

    it('should expose clientsProvisioned', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ clientsProvisioned: 20 })).value;

      expect(metrics.clientsProvisioned).toBe(20);
    });

    it('should return null for any getter when the field is null', () => {
      const metrics = WirelessMetrics.create(makeNullProps()).value;

      expect(metrics.signalRxDbm).toBeNull();
      expect(metrics.snrDb).toBeNull();
      expect(metrics.ccqPercent).toBeNull();
      expect(metrics.lanStatus).toBeNull();
    });
  });

  // ===========================================================================
  describe('getters — new fields (8 additions)', () => {
    it('should expose throughputTxPps', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ throughputTxPps: 1200 })).value;

      expect(metrics.throughputTxPps).toBe(1200);
    });

    it('should expose throughputRxPps', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ throughputRxPps: 900 })).value;

      expect(metrics.throughputRxPps).toBe(900);
    });

    it('should expose firmwareVersion', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ firmwareVersion: 'WA.v8.7.11' })).value;

      expect(metrics.firmwareVersion).toBe('WA.v8.7.11');
    });

    it('should expose deviceName', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ deviceName: 'CPE-001' })).value;

      expect(metrics.deviceName).toBe('CPE-001');
    });

    it('should expose remoteApMac', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ remoteApMac: 'aa:bb:cc:dd:ee:ff' })).value;

      expect(metrics.remoteApMac).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should expose remoteApName', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ remoteApName: 'AP-Roof' })).value;

      expect(metrics.remoteApName).toBe('AP-Roof');
    });

    it('should expose distanceM', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ distanceM: 1500 })).value;

      expect(metrics.distanceM).toBe(1500);
    });

    it('should expose latencyMs', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ latencyMs: 4 })).value;

      expect(metrics.latencyMs).toBe(4);
    });

    it('should return null for each new field when not set', () => {
      const metrics = WirelessMetrics.create(makeNullProps()).value;

      expect(metrics.throughputTxPps).toBeNull();
      expect(metrics.throughputRxPps).toBeNull();
      expect(metrics.firmwareVersion).toBeNull();
      expect(metrics.deviceName).toBeNull();
      expect(metrics.remoteApMac).toBeNull();
      expect(metrics.remoteApName).toBeNull();
      expect(metrics.distanceM).toBeNull();
      expect(metrics.latencyMs).toBeNull();
    });
  });

  // ===========================================================================
  describe('getSnr()', () => {
    it('should return stored snrDb when present, even when signal and noise are also present', () => {
      // stored snrDb=30 takes priority; signal-noise would compute 25
      const metrics = WirelessMetrics.create(makeFullProps({
        signalRxDbm: -65,
        noiseFloorDbm: -90,
        snrDb: 30,
      })).value;

      expect(metrics.getSnr()).toBe(30);
    });

    it('should compute signalRxDbm - noiseFloorDbm when snrDb is null and both signals are present', () => {
      const metrics = WirelessMetrics.create({
        ...makeNullProps(),
        signalRxDbm: -65,
        noiseFloorDbm: -90,
        snrDb: null,
      }).value;

      expect(metrics.getSnr()).toBe(25);
    });

    it('should return the stored snrDb when signalRxDbm is null but noiseFloorDbm is present', () => {
      const metrics = WirelessMetrics.create(makeNullProps()).value;
      const withSnr = WirelessMetrics.create({ ...makeNullProps(), snrDb: 18 }).value;

      expect(withSnr.getSnr()).toBe(18);
      expect(metrics.getSnr()).toBeNull();
    });

    it('should return snrDb when signalRxDbm is null', () => {
      const metrics = WirelessMetrics.create({
        ...makeNullProps(),
        signalRxDbm: null,
        noiseFloorDbm: -90,
        snrDb: 18,
      }).value;

      expect(metrics.getSnr()).toBe(18);
    });

    it('should return snrDb when noiseFloorDbm is null', () => {
      const metrics = WirelessMetrics.create({
        ...makeNullProps(),
        signalRxDbm: -70,
        noiseFloorDbm: null,
        snrDb: 20,
      }).value;

      expect(metrics.getSnr()).toBe(20);
    });

    it('should return null when signalRxDbm, noiseFloorDbm, and snrDb are all null', () => {
      const metrics = WirelessMetrics.create(makeNullProps()).value;

      expect(metrics.getSnr()).toBeNull();
    });

    it('should return a negative computed SNR when signal is higher than noise floor (edge case)', () => {
      // Unusual but mathematically valid
      const metrics = WirelessMetrics.create({
        ...makeNullProps(),
        signalRxDbm: -95,
        noiseFloorDbm: -90,
        snrDb: null,
      }).value;

      expect(metrics.getSnr()).toBe(-5);
    });

    it('should return 0 when signalRxDbm equals noiseFloorDbm', () => {
      const metrics = WirelessMetrics.create({
        ...makeNullProps(),
        signalRxDbm: -90,
        noiseFloorDbm: -90,
        snrDb: null,
      }).value;

      expect(metrics.getSnr()).toBe(0);
    });
  });

  // ===========================================================================
  describe('isSignalDegraded()', () => {
    it('should return true when signalRxDbm is below -70 dBm', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ signalRxDbm: -71 })).value;

      expect(metrics.isSignalDegraded()).toBe(true);
    });

    it('should return true for a very weak signal like -85 dBm', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ signalRxDbm: -85 })).value;

      expect(metrics.isSignalDegraded()).toBe(true);
    });

    it('should return false when signalRxDbm is exactly -70 dBm (boundary)', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ signalRxDbm: -70 })).value;

      expect(metrics.isSignalDegraded()).toBe(false);
    });

    it('should return false when signalRxDbm is above -70 dBm', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ signalRxDbm: -65 })).value;

      expect(metrics.isSignalDegraded()).toBe(false);
    });

    it('should return false when signalRxDbm is null', () => {
      const metrics = WirelessMetrics.create(makeNullProps()).value;

      expect(metrics.isSignalDegraded()).toBe(false);
    });

    it('should return false for a strong signal like -40 dBm', () => {
      const metrics = WirelessMetrics.create(makeFullProps({ signalRxDbm: -40 })).value;

      expect(metrics.isSignalDegraded()).toBe(false);
    });
  });

  // ===========================================================================
  describe('getLinkUtilizationPercent()', () => {
    it('should return (throughputTxBps + throughputRxBps) / capacityBps * 100', () => {
      // tx=5_000_000 + rx=5_000_000 = 10_000_000 out of 100_000_000 → 10%
      const metrics = WirelessMetrics.create(makeFullProps({
        throughputTxBps: 5_000_000,
        throughputRxBps: 5_000_000,
      })).value;

      expect(metrics.getLinkUtilizationPercent(100_000_000)).toBe(10);
    });

    it('should return 100 when combined throughput equals capacity', () => {
      const metrics = WirelessMetrics.create(makeFullProps({
        throughputTxBps: 50_000_000,
        throughputRxBps: 50_000_000,
      })).value;

      expect(metrics.getLinkUtilizationPercent(100_000_000)).toBe(100);
    });

    it('should return null when throughputTxBps is null', () => {
      const metrics = WirelessMetrics.create(makeFullProps({
        throughputTxBps: null,
        throughputRxBps: 5_000_000,
      })).value;

      expect(metrics.getLinkUtilizationPercent(100_000_000)).toBeNull();
    });

    it('should return null when throughputRxBps is null', () => {
      const metrics = WirelessMetrics.create(makeFullProps({
        throughputTxBps: 5_000_000,
        throughputRxBps: null,
      })).value;

      expect(metrics.getLinkUtilizationPercent(100_000_000)).toBeNull();
    });

    it('should return null when both throughput fields are null', () => {
      const metrics = WirelessMetrics.create(makeNullProps()).value;

      expect(metrics.getLinkUtilizationPercent(100_000_000)).toBeNull();
    });

    it('should return null when capacityBps is zero', () => {
      const metrics = WirelessMetrics.create(makeFullProps({
        throughputTxBps: 5_000_000,
        throughputRxBps: 5_000_000,
      })).value;

      expect(metrics.getLinkUtilizationPercent(0)).toBeNull();
    });

    it('should return null when capacityBps is negative', () => {
      const metrics = WirelessMetrics.create(makeFullProps({
        throughputTxBps: 5_000_000,
        throughputRxBps: 5_000_000,
      })).value;

      expect(metrics.getLinkUtilizationPercent(-1)).toBeNull();
    });

    it('should handle asymmetric throughput correctly', () => {
      // tx=80_000_000 + rx=20_000_000 = 100_000_000 / 200_000_000 → 50%
      const metrics = WirelessMetrics.create(makeFullProps({
        throughputTxBps: 80_000_000,
        throughputRxBps: 20_000_000,
      })).value;

      expect(metrics.getLinkUtilizationPercent(200_000_000)).toBe(50);
    });

    it('should return a fractional percentage for partial utilisation', () => {
      // tx=1 + rx=1 = 2 / 1000 → 0.2%
      const metrics = WirelessMetrics.create(makeFullProps({
        throughputTxBps: 1,
        throughputRxBps: 1,
      })).value;

      expect(metrics.getLinkUtilizationPercent(1000)).toBeCloseTo(0.2);
    });
  });
});
