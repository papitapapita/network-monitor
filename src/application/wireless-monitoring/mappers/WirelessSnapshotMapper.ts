import { WirelessSnapshot, WirelessAlertRecord } from 'domain/wireless-monitoring';
import {
  WirelessStatusResponseDTO,
  WirelessMetricsDTO
} from '../dtos/WirelessStatusResponseDTO';
import { WirelessAlertResponseDTO } from '../dtos/WirelessAlertResponseDTO';
import { WirelessClientDTO } from '../dtos/WirelessClientDTO';
import { WirelessClientListResponseDTO } from '../dtos/WirelessClientListResponseDTO';

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

    const activeAlerts: WirelessAlertResponseDTO[] = alerts.map(
      (a) => ({
        id: a.id.toString(),
        deviceId: a.deviceId.toString(),
        metric: a.metric,
        severity: a.severity,
        threshold: a.threshold,
        lastValue: a.lastValue,
        message: a.message,
        triggeredAt: a.triggeredAt.toISOString(),
        clearedAt: a.clearedAt?.toISOString() ?? null,
        isActive: a.isActive
      })
    );

    const clients: WirelessClientDTO[] = snapshot.clients.map(
      (c) => ({
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
      })
    );

    return {
      deviceId: snapshot.deviceId.toString(),
      deviceType: snapshot.deviceType,
      collectedAt: snapshot.collectedAt.toISOString(),
      collectionMethod: snapshot.collectionMethod,
      metrics,
      activeAlerts,
      clients
    };
  }

  /**
   * Maps a snapshot's client list to a WirelessClientListResponseDTO.
   * Centralises all structural DTO transformation for client data.
   */
  public static toClientListDTO(
    snapshot: WirelessSnapshot
  ): WirelessClientListResponseDTO {
    const clients: WirelessClientDTO[] = snapshot.clients.map((c) => ({
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
      ipAddress: c.ipAddress,
    }));

    return {
      deviceId: snapshot.deviceId.toString(),
      collectedAt: snapshot.collectedAt.toISOString(),
      clients,
    };
  }
}
