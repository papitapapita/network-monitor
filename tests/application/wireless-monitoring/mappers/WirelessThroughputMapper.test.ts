// Source: src/application/wireless-monitoring/mappers/WirelessThroughputMapper.ts

import { WirelessThroughputMapper } from '../../../../src/application/wireless-monitoring/mappers/WirelessThroughputMapper';
import {
  WirelessSnapshot,
  WirelessDeviceConfig
} from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import {
  DeviceId,
  SnapshotId,
  WirelessDeviceConfigId
} from '../../../../src/domain/shared/ids';
import { WirelessMetricsProps } from '../../../../src/domain/wireless-monitoring/props';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SNAPSHOT_UUID = '550e8400-e29b-41d4-a716-446655440002';
const CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440003';

const COLLECTED_AT = new Date('2026-08-12T10:00:00.000Z');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMetrics(
  overrides: Partial<WirelessMetricsProps> = {}
): WirelessMetrics {
  return WirelessMetrics.reconstitute({
    signalRxDbm: null,
    signalTxDbm: null,
    noiseFloorDbm: null,
    snrDb: null,
    ccqPercent: null,
    frequencyMhz: null,
    channelWidthMhz: null,
    throughputTxBps: null,
    throughputRxBps: null,
    throughputTxPps: null,
    throughputRxPps: null,
    lanStatus: null,
    lanSpeedMbps: null,
    lanDuplex: null,
    uptimeSeconds: null,
    cpuLoadPercent: null,
    memoryUsedPercent: null,
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
    clientsConnected: null,
    macAddress: null,
    deviceModel: null,
    ssid: null,
    ...overrides
  });
}

function makeSnapshot(
  metrics: WirelessMetrics = makeMetrics(),
  deviceType: 'STATION' | 'ACCESS_POINT' = 'STATION',
  collectedAt: Date = COLLECTED_AT
): WirelessSnapshot {
  return WirelessSnapshot.reconstitute(
    SnapshotId.parse(SNAPSHOT_UUID).value,
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      deviceType,
      collectedAt,
      collectionMethod: 'http_api',
      metrics,
      clients: [],
      alerts: [],
      remoteApDeviceId: null
    }
  );
}

function makeConfig(
  linkCapacityKbps: number | null,
  intervalSecs = 60
): WirelessDeviceConfig {
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.parse(CONFIG_UUID).value,
    {
      deviceId: DeviceId.parse(DEVICE_UUID).value,
      ipAddress: null,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(intervalSecs),
      deviceType: 'STATION',
      linkCapacityKbps,
      clientsProvisionedLimit: null,
      lastPolledAt: null
    }
  );
}

// ---------------------------------------------------------------------------

describe('WirelessThroughputMapper', () => {
  describe('[WLS-147] utilisation', () => {
    it('reports throughput as a percentage of the configured capacity', () => {
      const metrics = makeMetrics({
        throughputTxBps: 12_000_000,
        throughputRxBps: 3_000_000
      });

      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(metrics),
        makeConfig(50_000), // 50 Mbps plan
        COLLECTED_AT
      );

      expect(dto.throughputTotalBps).toBe(15_000_000);
      expect(dto.linkCapacityKbps).toBe(50_000);
      expect(dto.utilisationPercent).toBe(30);
    });

    it('rounds utilisation to two decimals', () => {
      const metrics = makeMetrics({
        throughputTxBps: 1_234_567,
        throughputRxBps: 0
      });

      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(metrics),
        makeConfig(10_000),
        COLLECTED_AT
      );

      expect(dto.utilisationPercent).toBe(12.35);
    });

    // linkCapacityKbps is STATION-only, so an AP legitimately has none
    it('is null when no capacity is configured', () => {
      const metrics = makeMetrics({
        throughputTxBps: 1_000,
        throughputRxBps: 1_000
      });

      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(metrics, 'ACCESS_POINT'),
        makeConfig(null),
        COLLECTED_AT
      );

      expect(dto.linkCapacityKbps).toBeNull();
      expect(dto.utilisationPercent).toBeNull();
    });

    it('is null when either throughput leg is missing', () => {
      const metrics = makeMetrics({
        throughputTxBps: 1_000_000,
        throughputRxBps: null
      });

      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(metrics),
        makeConfig(50_000),
        COLLECTED_AT
      );

      expect(dto.throughputTotalBps).toBeNull();
      expect(dto.utilisationPercent).toBeNull();
    });
  });

  describe('[WLS-148] age and staleness', () => {
    it('reports the age of the reading in whole seconds', () => {
      const now = new Date(COLLECTED_AT.getTime() + 42_000);

      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(),
        makeConfig(null, 3600),
        now
      );

      expect(dto.ageSeconds).toBe(42);
      expect(dto.collectedAt).toBe(COLLECTED_AT.toISOString());
    });

    it('never reports a negative age when the radio clock runs ahead', () => {
      const now = new Date(COLLECTED_AT.getTime() - 5_000);

      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(),
        makeConfig(null, 60),
        now
      );

      expect(dto.ageSeconds).toBe(0);
    });

    it('is fresh at exactly two poll intervals', () => {
      const now = new Date(COLLECTED_AT.getTime() + 120_000);

      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(),
        makeConfig(null, 60),
        now
      );

      expect(dto.stale).toBe(false);
    });

    it('is stale one second past two poll intervals', () => {
      const now = new Date(COLLECTED_AT.getTime() + 121_000);

      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(),
        makeConfig(null, 60),
        now
      );

      expect(dto.stale).toBe(true);
    });

    // nothing is scheduled to refresh a snapshot whose config was removed
    it('is stale when the device has no configuration', () => {
      const dto = WirelessThroughputMapper.toDTO(
        makeSnapshot(),
        null,
        COLLECTED_AT
      );

      expect(dto.stale).toBe(true);
      expect(dto.linkCapacityKbps).toBeNull();
      expect(dto.utilisationPercent).toBeNull();
    });
  });

  it('carries the device identity and radio mode from the snapshot', () => {
    const dto = WirelessThroughputMapper.toDTO(
      makeSnapshot(makeMetrics(), 'ACCESS_POINT'),
      null,
      COLLECTED_AT
    );

    expect(dto.deviceId).toBe(DEVICE_UUID);
    expect(dto.deviceType).toBe('ACCESS_POINT');
  });
});
