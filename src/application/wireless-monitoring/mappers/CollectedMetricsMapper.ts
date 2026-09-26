import { Result } from 'domain/shared/core';
import { WirelessMetrics } from 'domain/wireless-monitoring';
import { WirelessCollectionResult } from '../interfaces';

export interface ThroughputOverride {
  txBps: number | null;
  rxBps: number | null;
}

export class CollectedMetricsMapper {
  // throughput overrides the collector's own figures — a diagnosis derives
  // it from counter deltas between its own fast samples
  public static toMetrics(
    collected: WirelessCollectionResult,
    throughput?: ThroughputOverride
  ): Result<WirelessMetrics> {
    const snrDb =
      collected.signalRxDbm !== null &&
      collected.noiseFloorDbm !== null
        ? collected.signalRxDbm - collected.noiseFloorDbm
        : null;

    return WirelessMetrics.create({
      signalRxDbm: collected.signalRxDbm,
      signalTxDbm: collected.signalTxDbm,
      noiseFloorDbm: collected.noiseFloorDbm,
      snrDb,
      ccqPercent: collected.ccqPercent,
      frequencyMhz: collected.frequencyMhz,
      channelWidthMhz: collected.channelWidthMhz,
      throughputTxBps: throughput
        ? throughput.txBps
        : collected.throughputTxBps,
      throughputRxBps: throughput
        ? throughput.rxBps
        : collected.throughputRxBps,
      throughputTxPps: null,
      throughputRxPps: null,
      lanStatus: collected.lanStatus,
      lanSpeedMbps: collected.lanSpeedMbps,
      lanDuplex: null,
      uptimeSeconds: collected.uptimeSeconds,
      cpuLoadPercent: collected.cpuLoadPercent,
      memoryUsedPercent: collected.memoryUsedPercent,
      clientsConnected: collected.clientsConnected,
      firmwareVersion: collected.firmwareVersion,
      deviceName: collected.deviceName,
      remoteApMac: collected.remoteApMac,
      remoteApName: collected.remoteApName,
      remoteApIp: collected.remoteApIp,
      distanceM: collected.distanceM,
      latencyMs: collected.latencyMs,
      capacityTxKbps: collected.capacityTxKbps,
      capacityRxKbps: collected.capacityRxKbps,
      deviceTimeEpoch: collected.deviceTimeEpoch,
      macAddress: collected.macAddress,
      deviceModel: collected.deviceModel,
      ssid: collected.essid
    });
  }
}
