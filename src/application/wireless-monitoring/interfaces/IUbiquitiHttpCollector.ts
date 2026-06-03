import { Result } from 'domain/shared/core';

export interface HttpCredentials {
  username: string;
  password: string;
  port: number;
}

export interface HttpClientEntry {
  macAddress: string;
  ipAddress: string | null;
  signalRxDbm: number | null;
  noiseFloorDbm: number | null;
  distanceM: number | null;
  uptimeSeconds: number | null;
  txLatencyMs: number | null;
  dlLinkScore: number | null;
  ulLinkScore: number | null;
  dlCapacityKbps: number | null;
  ulCapacityKbps: number | null;
  dlCinr: number | null;
  ulCinr: number | null;
  txBytesTotal: bigint | null;
  rxBytesTotal: bigint | null;
  txPps: number | null;
  rxPps: number | null;
  remoteHostname: string | null;
  remotePlatform: string | null;
  remoteVersion: string | null;
  remoteCpuLoad: number | null;
  remoteTotalRam: number | null;
  remoteFreeRam: number | null;
  remoteSignal: number | null;
  remoteNoiseFloor: number | null;
  remoteTxPower: number | null;
  remoteTxThroughputKbps: number | null;
  remoteRxThroughputKbps: number | null;
  remoteIpAddresses: string[];
}

export interface HttpCollectionResult {
  deviceName: string | null;
  firmwareVersion: string | null;
  uptimeSeconds: number | null;
  cpuLoadPercent: number | null;
  memoryUsedPercent: number | null;
  essid: string | null;
  mode: 'ap-ptmp' | 'sta-ptmp' | 'ap-ptp' | 'sta-ptp' | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  noiseFloorDbm: number | null;
  txPowerDbm: number | null;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  distanceM: number | null;
  clientsConnected: number | null;
  ccqPercent: number | null;
  signalRxDbm: number | null;
  latencyMs: number | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  lanStatus: 'UP' | 'DOWN' | null;
  lanSpeedMbps: number | null;
  clients: HttpClientEntry[];
}

export interface IUbiquitiHttpCollector {
  collect(
    ipAddress: string,
    credentials: HttpCredentials,
    deviceType: 'STATION' | 'ACCESS_POINT'
  ): Promise<Result<HttpCollectionResult>>;
}
