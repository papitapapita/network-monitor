import { Result } from 'domain/shared/core';

export interface HttpCredentials {
  username: string;
  password: string;
  port: number;
  useHttps?: boolean;
}

export interface HttpClientEntry {
  macAddress: string;
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  snrDb: number | null;
  txRateMbps: number | null;
  rxRateMbps: number | null;
  ccqPercent: number | null;
  uptimeSeconds: number | null;
  ipAddress: string | null;
}

export interface HttpCollectionResult {
  signalRxDbm: number | null;
  noiseFloorDbm: number | null;
  txRateMbps: number | null;
  rxRateMbps: number | null;
  ccqPercent: number | null;
  frequencyMhz: number | null;
  txPowerDbm: number | null;
  distanceM: number | null;
  latencyMs: number | null;
  uptimeSeconds: number | null;
  firmwareVersion: string | null;
  deviceName: string | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  lanStatus: 'UP' | 'DOWN' | null;
  lanSpeedMbps: number | null;
  clients: HttpClientEntry[];
}

export interface IUbiquitiHttpCollector {
  collect(ipAddress: string, credentials: HttpCredentials): Promise<Result<HttpCollectionResult>>;
  collectClients(ipAddress: string, credentials: HttpCredentials): Promise<Result<HttpClientEntry[]>>;
}
