import { WirelessAlertResponseDTO } from './WirelessAlertResponseDTO';
import { WirelessClientDTO } from './WirelessClientDTO';

export interface WirelessMetricsDTO {
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
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  throughputTxPps: number | null;
  throughputRxPps: number | null;
  lanStatus: string | null;
  lanSpeedMbps: number | null;
  lanDuplex: string | null;
  uptimeSeconds: number | null;
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
  macAddress: string | null;
  deviceModel: string | null;
  ssid: string | null;
}

export interface WirelessStatusResponseDTO {
  deviceId: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  collectedAt: string;
  collectionMethod: 'snmp' | 'http_api' | 'mixed';
  metrics: WirelessMetricsDTO;
  activeAlerts: WirelessAlertResponseDTO[];
  clients: WirelessClientDTO[];
}
