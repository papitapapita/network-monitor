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
import { WirelessClientEntry } from 'domain/wireless-monitoring/value-objects';

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
      frequencyMhz: m.frequencyMhz,
      channelWidthMhz: m.channelWidthMhz,
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
      macAddress: m.macAddress,
      deviceModel: m.deviceModel,
      ssid: m.ssid
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

  private static toClientDTO(
    c: WirelessClientEntry
  ): WirelessClientDTO {
    return {
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
    };
  }
}
