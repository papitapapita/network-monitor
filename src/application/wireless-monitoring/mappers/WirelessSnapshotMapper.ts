import {
  WirelessSnapshot,
  WirelessAlertRecord
} from 'domain/wireless-monitoring/aggregates';
import {
  WirelessStatusResponseDTO,
  WirelessMetricsDTO,
  WirelessClientDTO,
  WirelessClientListResponseDTO
} from '../dtos';
import { WirelessAlertMapper } from './WirelessAlertMapper';

export class WirelessSnapshotMapper {
  public static toStatusDTO(
    snapshot: WirelessSnapshot,
    alerts: WirelessAlertRecord[]
  ): WirelessStatusResponseDTO {
    const m = snapshot.metrics;
    const metrics: WirelessMetricsDTO = {
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
      throughputTxBps: m.throughputTxBps,
      throughputRxBps: m.throughputRxBps,
      throughputTxPps: m.throughputTxPps,
      throughputRxPps: m.throughputRxPps,
      lanStatus: m.lanStatus,
      lanSpeedMbps: m.lanSpeedMbps,
      lanDuplex: m.lanDuplex,
      uptimeSeconds: m.uptimeSeconds,
      cpuLoadPercent: m.cpuLoadPercent,
      memoryUsedPercent: m.memoryUsedPercent,
      firmwareVersion: m.firmwareVersion,
      deviceName: m.deviceName,
      remoteApMac: m.remoteApMac,
      remoteApName: m.remoteApName,
      distanceM: m.distanceM,
      latencyMs: m.latencyMs,
      clientsConnected: m.clientsConnected,
      clientsProvisioned: m.clientsProvisioned
    };

    return {
      deviceId: snapshot.deviceId.toString(),
      deviceType: snapshot.deviceType,
      collectedAt: snapshot.collectedAt.toISOString(),
      collectionMethod: snapshot.collectionMethod,
      metrics,
      activeAlerts: alerts.map((a) => WirelessAlertMapper.toDTO(a)),
      clients: snapshot.clients.map((c) => this.toClientDTO(c))
    };
  }

  public static toClientListDTO(
    snapshot: WirelessSnapshot
  ): WirelessClientListResponseDTO {
    return {
      deviceId: snapshot.deviceId.toString(),
      collectedAt: snapshot.collectedAt.toISOString(),
      clients: snapshot.clients.map((c) => this.toClientDTO(c))
    };
  }

  private static toClientDTO(c: {
    macAddress: string;
    signalRxDbm: number | null;
    signalTxDbm: number | null;
    snrDb: number | null;
    txRateMbps: number | null;
    rxRateMbps: number | null;
    throughputTxBps: number | null;
    throughputRxBps: number | null;
    ccqPercent: number | null;
    uptimeSeconds: number | null;
    ipAddress: string | null;
  }): WirelessClientDTO {
    return {
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
    };
  }
}
