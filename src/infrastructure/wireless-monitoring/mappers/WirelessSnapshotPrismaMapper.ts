import { WirelessSnapshot } from 'domain/wireless-monitoring/aggregates';
import { WirelessMetricsProps } from 'domain/wireless-monitoring/props';
import {
  WirelessMetrics,
  WirelessClientEntry
} from 'domain/wireless-monitoring/value-objects';
import { SnapshotId, DeviceId } from 'domain/shared/ids';

type PrismaWirelessSnapshot = {
  id: string;
  deviceId: string;
  deviceType: string;
  collectedAt: Date;
  collectionMethod: string;
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  noiseFloorDbm: number | null;
  snrDb: number | null;
  ccqPercent: number | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  throughputTxBps: bigint | null;
  throughputRxBps: bigint | null;
  throughputTxPps: bigint | null;
  throughputRxPps: bigint | null;
  lanStatus: string | null;
  lanSpeedMbps: number | null;
  lanDuplex: string | null;
  uptimeSeconds: bigint | null;
  cpuLoadPercent: number | null;
  memoryUsedPercent: number | null;
  firmwareVersion: string | null;
  deviceName: string | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  remoteApIp: string | null;
  remoteApDeviceId: string | null;
  distanceM: number | null;
  latencyMs: number | null;
  capacityTxKbps: number | null;
  capacityRxKbps: number | null;
  deviceTimeEpoch: bigint | null;
  clientsConnected: number | null;
  clientsJson: unknown;
  macAddress: string | null;
  deviceModel: string | null;
  ssid: string | null;
};

type PersistenceData = {
  id: string;
  deviceId: string;
  deviceType: string;
  collectedAt: Date;
  collectionMethod: string;
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  noiseFloorDbm: number | null;
  snrDb: number | null;
  ccqPercent: number | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  throughputTxBps: bigint | null;
  throughputRxBps: bigint | null;
  throughputTxPps: bigint | null;
  throughputRxPps: bigint | null;
  lanStatus: string | null;
  lanSpeedMbps: number | null;
  lanDuplex: string | null;
  uptimeSeconds: bigint | null;
  cpuLoadPercent: number | null;
  memoryUsedPercent: number | null;
  firmwareVersion: string | null;
  deviceName: string | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  remoteApIp: string | null;
  remoteApDeviceId: string | null;
  distanceM: number | null;
  latencyMs: number | null;
  capacityTxKbps: number | null;
  capacityRxKbps: number | null;
  deviceTimeEpoch: bigint | null;
  clientsConnected: number | null;
  clientsJson: unknown;
  macAddress: string | null;
  deviceModel: string | null;
  ssid: string | null;
};

export class WirelessSnapshotPrismaMapper {
  static toDomain(raw: PrismaWirelessSnapshot): WirelessSnapshot {
    const deviceId = DeviceId.parse(raw.deviceId);
    if (deviceId.isFailure)
      throw new Error(`Invalid device ID: ${deviceId.error}`);

    const snapshotId = SnapshotId.parse(raw.id);
    if (snapshotId.isFailure)
      throw new Error(`Invalid snapshot ID: ${snapshotId.error}`);

    const metricsProps: WirelessMetricsProps = {
      signalRxDbm: raw.signalRxDbm,
      signalTxDbm: raw.signalTxDbm,
      noiseFloorDbm: raw.noiseFloorDbm,
      snrDb: raw.snrDb,
      ccqPercent: raw.ccqPercent,
      frequencyMhz: raw.frequencyMhz,
      channelWidthMhz: raw.channelWidthMhz,
      throughputTxBps:
        raw.throughputTxBps !== null
          ? Number(raw.throughputTxBps)
          : null,
      throughputRxBps:
        raw.throughputRxBps !== null
          ? Number(raw.throughputRxBps)
          : null,
      throughputTxPps:
        raw.throughputTxPps !== null
          ? Number(raw.throughputTxPps)
          : null,
      throughputRxPps:
        raw.throughputRxPps !== null
          ? Number(raw.throughputRxPps)
          : null,
      lanStatus: raw.lanStatus as 'UP' | 'DOWN' | null,
      lanSpeedMbps: raw.lanSpeedMbps,
      lanDuplex: raw.lanDuplex as 'FULL' | 'HALF' | null,
      uptimeSeconds:
        raw.uptimeSeconds !== null ? Number(raw.uptimeSeconds) : null,
      cpuLoadPercent: raw.cpuLoadPercent,
      memoryUsedPercent: raw.memoryUsedPercent,
      firmwareVersion: raw.firmwareVersion,
      deviceName: raw.deviceName,
      remoteApMac: raw.remoteApMac,
      remoteApName: raw.remoteApName,
      remoteApIp: raw.remoteApIp,
      distanceM: raw.distanceM,
      latencyMs: raw.latencyMs,
      capacityTxKbps: raw.capacityTxKbps,
      capacityRxKbps: raw.capacityRxKbps,
      deviceTimeEpoch:
        raw.deviceTimeEpoch !== null
          ? Number(raw.deviceTimeEpoch)
          : null,
      clientsConnected: raw.clientsConnected,
      macAddress: raw.macAddress,
      deviceModel: raw.deviceModel,
      ssid: raw.ssid
    };

    const metrics = WirelessMetrics.reconstitute(metricsProps);

    const clients: WirelessClientEntry[] = [];
    if (raw.clientsJson && Array.isArray(raw.clientsJson)) {
      for (const c of raw.clientsJson as Record<string, unknown>[]) {
        const txBytes = c['txBytesTotal'];
        const rxBytes = c['rxBytesTotal'];
        clients.push(
          WirelessClientEntry.reconstitute({
            macAddress: String(c['macAddress'] ?? ''),
            ipAddress: (c['ipAddress'] as string | null) ?? null,
            signalRxDbm: (c['signalRxDbm'] as number | null) ?? null,
            noiseFloorDbm:
              (c['noiseFloorDbm'] as number | null) ?? null,
            distanceM: (c['distanceM'] as number | null) ?? null,
            uptimeSeconds:
              (c['uptimeSeconds'] as number | null) ?? null,
            txLatencyMs: (c['txLatencyMs'] as number | null) ?? null,
            dlLinkScore: (c['dlLinkScore'] as number | null) ?? null,
            ulLinkScore: (c['ulLinkScore'] as number | null) ?? null,
            dlCapacityKbps:
              (c['dlCapacityKbps'] as number | null) ?? null,
            ulCapacityKbps:
              (c['ulCapacityKbps'] as number | null) ?? null,
            dlCinr: (c['dlCinr'] as number | null) ?? null,
            ulCinr: (c['ulCinr'] as number | null) ?? null,
            txBytesTotal:
              txBytes !== null && txBytes !== undefined
                ? BigInt(String(txBytes))
                : null,
            rxBytesTotal:
              rxBytes !== null && rxBytes !== undefined
                ? BigInt(String(rxBytes))
                : null,
            txPps: (c['txPps'] as number | null) ?? null,
            rxPps: (c['rxPps'] as number | null) ?? null,
            remoteHostname:
              (c['remoteHostname'] as string | null) ?? null,
            remotePlatform:
              (c['remotePlatform'] as string | null) ?? null,
            remoteVersion:
              (c['remoteVersion'] as string | null) ?? null,
            remoteCpuLoad:
              (c['remoteCpuLoad'] as number | null) ?? null,
            remoteTotalRam:
              (c['remoteTotalRam'] as number | null) ?? null,
            remoteFreeRam:
              (c['remoteFreeRam'] as number | null) ?? null,
            remoteSignal:
              (c['remoteSignal'] as number | null) ?? null,
            remoteNoiseFloor:
              (c['remoteNoiseFloor'] as number | null) ?? null,
            remoteTxPower:
              (c['remoteTxPower'] as number | null) ?? null,
            remoteTxThroughputKbps:
              (c['remoteTxThroughputKbps'] as number | null) ?? null,
            remoteRxThroughputKbps:
              (c['remoteRxThroughputKbps'] as number | null) ?? null,
            remoteIpAddresses: Array.isArray(c['remoteIpAddresses'])
              ? (c['remoteIpAddresses'] as string[])
              : [],
            dlAirtimePercent:
              (c['dlAirtimePercent'] as number | null) ?? null,
            ulAirtimePercent:
              (c['ulAirtimePercent'] as number | null) ?? null
          })
        );
      }
    }

    let remoteApDeviceId = null;
    if (raw.remoteApDeviceId) {
      const apId = DeviceId.parse(raw.remoteApDeviceId);
      if (apId.isSuccess) remoteApDeviceId = apId.value;
    }

    return WirelessSnapshot.reconstitute(snapshotId.value, {
      deviceId: deviceId.value,
      deviceType: raw.deviceType as 'STATION' | 'ACCESS_POINT',
      collectedAt: raw.collectedAt,
      collectionMethod: raw.collectionMethod as
        | 'snmp'
        | 'http_api'
        | 'mixed',
      metrics,
      clients,
      alerts: [],
      remoteApDeviceId
    });
  }

  static toPersistence(snapshot: WirelessSnapshot): PersistenceData {
    const m = snapshot.metrics;
    const clientsJson = snapshot.clients.map((c) => ({
      macAddress: c.macAddress,
      ipAddress: c.ipAddress,
      signalRxDbm: c.signalRxDbm,
      noiseFloorDbm: c.noiseFloorDbm,
      distanceM: c.distanceM,
      uptimeSeconds: c.uptimeSeconds,
      txLatencyMs: c.txLatencyMs,
      dlLinkScore: c.dlLinkScore,
      ulLinkScore: c.ulLinkScore,
      dlCapacityKbps: c.dlCapacityKbps,
      ulCapacityKbps: c.ulCapacityKbps,
      dlCinr: c.dlCinr,
      ulCinr: c.ulCinr,
      txBytesTotal:
        c.txBytesTotal !== null ? c.txBytesTotal.toString() : null,
      rxBytesTotal:
        c.rxBytesTotal !== null ? c.rxBytesTotal.toString() : null,
      txPps: c.txPps,
      rxPps: c.rxPps,
      remoteHostname: c.remoteHostname,
      remotePlatform: c.remotePlatform,
      remoteVersion: c.remoteVersion,
      remoteCpuLoad: c.remoteCpuLoad,
      remoteTotalRam: c.remoteTotalRam,
      remoteFreeRam: c.remoteFreeRam,
      remoteSignal: c.remoteSignal,
      remoteNoiseFloor: c.remoteNoiseFloor,
      remoteTxPower: c.remoteTxPower,
      remoteTxThroughputKbps: c.remoteTxThroughputKbps,
      remoteRxThroughputKbps: c.remoteRxThroughputKbps,
      remoteIpAddresses: c.remoteIpAddresses,
      dlAirtimePercent: c.dlAirtimePercent,
      ulAirtimePercent: c.ulAirtimePercent
    }));

    return {
      id: snapshot.snapshotId.toString(),
      deviceId: snapshot.deviceId.toString(),
      deviceType: snapshot.deviceType,
      collectedAt: snapshot.collectedAt,
      collectionMethod: snapshot.collectionMethod,
      signalRxDbm: m.signalRxDbm,
      signalTxDbm: m.signalTxDbm,
      noiseFloorDbm: m.noiseFloorDbm,
      snrDb: m.snrDb,
      ccqPercent: m.ccqPercent,
      frequencyMhz: m.frequencyMhz,
      channelWidthMhz: m.channelWidthMhz,
      throughputTxBps:
        m.throughputTxBps !== null ? BigInt(m.throughputTxBps) : null,
      throughputRxBps:
        m.throughputRxBps !== null ? BigInt(m.throughputRxBps) : null,
      throughputTxPps:
        m.throughputTxPps !== null ? BigInt(m.throughputTxPps) : null,
      throughputRxPps:
        m.throughputRxPps !== null ? BigInt(m.throughputRxPps) : null,
      lanStatus: m.lanStatus,
      lanSpeedMbps: m.lanSpeedMbps,
      lanDuplex: m.lanDuplex,
      uptimeSeconds:
        m.uptimeSeconds !== null ? BigInt(m.uptimeSeconds) : null,
      cpuLoadPercent: m.cpuLoadPercent,
      memoryUsedPercent: m.memoryUsedPercent,
      firmwareVersion: m.firmwareVersion,
      deviceName: m.deviceName,
      remoteApMac: m.remoteApMac,
      remoteApName: m.remoteApName,
      remoteApIp: m.remoteApIp,
      remoteApDeviceId: snapshot.remoteApDeviceId
        ? snapshot.remoteApDeviceId.toString()
        : null,
      distanceM: m.distanceM,
      latencyMs: m.latencyMs,
      capacityTxKbps: m.capacityTxKbps,
      capacityRxKbps: m.capacityRxKbps,
      deviceTimeEpoch:
        m.deviceTimeEpoch !== null ? BigInt(m.deviceTimeEpoch) : null,
      clientsConnected: m.clientsConnected,
      clientsJson: clientsJson.length > 0 ? clientsJson : null,
      macAddress: m.macAddress,
      deviceModel: m.deviceModel,
      ssid: m.ssid
    };
  }
}
