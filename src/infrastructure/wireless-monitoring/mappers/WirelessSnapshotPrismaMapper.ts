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
  txRateMbps: { toNumber(): number } | null;
  rxRateMbps: { toNumber(): number } | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  txPowerDbm: number | null;
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
  distanceM: number | null;
  latencyMs: number | null;
  clientsConnected: number | null;
  clientsProvisioned: number | null;
  clientsJson: unknown;
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
  txRateMbps: number | null;
  rxRateMbps: number | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  txPowerDbm: number | null;
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
  distanceM: number | null;
  latencyMs: number | null;
  clientsConnected: number | null;
  clientsProvisioned: number | null;
  clientsJson: unknown;
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
      txRateMbps: raw.txRateMbps ? raw.txRateMbps.toNumber() : null,
      rxRateMbps: raw.rxRateMbps ? raw.rxRateMbps.toNumber() : null,
      frequencyMhz: raw.frequencyMhz,
      channelWidthMhz: raw.channelWidthMhz,
      txPowerDbm: raw.txPowerDbm,
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
      distanceM: raw.distanceM,
      latencyMs: raw.latencyMs,
      clientsConnected: raw.clientsConnected,
      clientsProvisioned: raw.clientsProvisioned
    };

    const metrics = WirelessMetrics.reconstitute(metricsProps);

    const clients: WirelessClientEntry[] = [];
    if (raw.clientsJson && Array.isArray(raw.clientsJson)) {
      for (const c of raw.clientsJson as Record<string, unknown>[]) {
        clients.push(
          WirelessClientEntry.reconstitute({
            macAddress: String(c['macAddress'] ?? ''),
            signalRxDbm: (c['signalRxDbm'] as number | null) ?? null,
            signalTxDbm: (c['signalTxDbm'] as number | null) ?? null,
            snrDb: (c['snrDb'] as number | null) ?? null,
            txRateMbps: (c['txRateMbps'] as number | null) ?? null,
            rxRateMbps: (c['rxRateMbps'] as number | null) ?? null,
            throughputTxBps:
              (c['throughputTxBps'] as number | null) ?? null,
            throughputRxBps:
              (c['throughputRxBps'] as number | null) ?? null,
            ccqPercent: (c['ccqPercent'] as number | null) ?? null,
            uptimeSeconds:
              (c['uptimeSeconds'] as number | null) ?? null,
            ipAddress: (c['ipAddress'] as string | null) ?? null
          })
        );
      }
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
      alerts: []
    });
  }

  static toPersistence(snapshot: WirelessSnapshot): PersistenceData {
    const m = snapshot.metrics;
    const clientsJson = snapshot.clients.map((c) => ({
      macAddress: c.macAddress,
      signalRxDbm: c.signalRxDbm,
      signalTxDbm: c.signalTxDbm,
      snrDb: c.snrDb,
      txRateMbps: c.txRateMbps,
      rxRateMbps: c.rxRateMbps,
      throughputTxBps: c.throughputTxBps,
      throughputRxBps: c.throughputRxBps,
      ccqPercent: c.ccqPercent,
      uptimeSeconds: c.uptimeSeconds,
      ipAddress: c.ipAddress
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
      txRateMbps: m.txRateMbps,
      rxRateMbps: m.rxRateMbps,
      frequencyMhz: m.frequencyMhz,
      channelWidthMhz: m.channelWidthMhz,
      txPowerDbm: m.txPowerDbm,
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
      distanceM: m.distanceM,
      latencyMs: m.latencyMs,
      clientsConnected: m.clientsConnected,
      clientsProvisioned: m.clientsProvisioned,
      clientsJson: clientsJson.length > 0 ? clientsJson : null
    };
  }
}
