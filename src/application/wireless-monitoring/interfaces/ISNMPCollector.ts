import { Result } from 'domain/shared/core';

export interface SNMPCredentials {
  version: 1 | 2 | 3;
  community?: string;
  authUser?: string;
  authProtocol?: 'MD5' | 'SHA';
  authKey?: string;
  privProtocol?: 'DES' | 'AES';
  privKey?: string;
  port: number;
}

export interface SNMPCollectionResult {
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
  ifHCInOctets: bigint | null;
  ifHCOutOctets: bigint | null;
  ifInUcastPkts: number | null;
  ifOutUcastPkts: number | null;
  lanStatus: 'UP' | 'DOWN' | null;
  lanSpeedMbps: number | null;
  lanDuplex: 'FULL' | 'HALF' | null;
  sysDescr: string | null;
  sysName: string | null;
  firmwareVersion: string | null;
  uptimeSeconds: number | null;
  cpuLoadPercent: number | null;
  memoryUsedPercent: number | null;
  clientsConnected: number | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  distanceM: number | null;
  latencyMs: number | null;
}

export interface ISNMPCollector {
  collect(
    ipAddress: string,
    credentials: SNMPCredentials
  ): Promise<Result<SNMPCollectionResult>>;
}
