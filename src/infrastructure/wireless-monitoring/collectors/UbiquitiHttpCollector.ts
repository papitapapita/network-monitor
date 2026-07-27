import { Result } from 'domain/shared/core';
import {
  IUbiquitiHttpCollector,
  IWirelessDeviceRebooter,
  HttpCredentials,
  HttpCollectionResult,
  HttpClientEntry
} from 'application/wireless-monitoring/interfaces';
import { AirOsHttpClient } from './AirOsHttpClient';

export class UbiquitiHttpCollector
  implements IUbiquitiHttpCollector, IWirelessDeviceRebooter
{
  constructor(private readonly client: AirOsHttpClient) {}

  async reboot(
    ipAddress: string,
    credentials: HttpCredentials
  ): Promise<Result<void>> {
    return this.client.reboot(ipAddress, credentials.port, {
      username: credentials.username,
      password: credentials.password
    });
  }

  async collect(
    ipAddress: string,
    credentials: HttpCredentials,
    deviceType: 'STATION' | 'ACCESS_POINT'
  ): Promise<Result<HttpCollectionResult>> {
    const fetchResult = await this.client.fetchStatus(
      ipAddress,
      credentials.port,
      {
        username: credentials.username,
        password: credentials.password
      }
    );
    if (fetchResult.isFailure) {
      return Result.fail(fetchResult.error!);
    }
    return Result.ok(
      this.parseStatusCgi(
        fetchResult.value as Record<string, unknown>,
        deviceType
      )
    );
  }

  private parseStatusCgi(
    data: Record<string, unknown>,
    deviceType: 'STATION' | 'ACCESS_POINT'
  ): HttpCollectionResult {
    const host = obj(data, 'host');
    const wireless = obj(data, 'wireless');
    const throughput = obj(wireless, 'throughput');
    const sta = arr(wireless, 'sta');
    const interfaces = arr(data, 'interfaces');

    const eth0 = (interfaces.find(
      (i) => str(i, 'ifname') === 'eth0'
    ) ?? {}) as Record<string, unknown>;
    const eth0Status = obj(eth0, 'status');

    const isStaMode = deviceType === 'STATION';
    const sta0 = sta.length > 0 ? sta[0]! : null;

    const totalRam = num(host, 'totalram');
    const freeRam = num(host, 'freeram');
    const memoryUsedPercent =
      totalRam !== null && totalRam > 0 && freeRam !== null
        ? ((totalRam - freeRam) / totalRam) * 100
        : null;

    const chanbw = num(wireless, 'chanbw');
    const txThroughputRaw = num(throughput, 'tx');
    const rxThroughputRaw = num(throughput, 'rx');
    const ccqRaw = num(wireless, 'ccq');

    // airOS 8: eth0.status.plugged is a boolean; eth0.status.speed is Mbps
    const plugged = eth0Status['plugged'];
    const lanStatus: 'UP' | 'DOWN' | null =
      typeof plugged === 'boolean' ? (plugged ? 'UP' : 'DOWN') : null;
    const lanSpeedMbps = num(eth0Status, 'speed');

    const remote0 = isStaMode && sta0 ? obj(sta0, 'remote') : null;
    const airmax0 = isStaMode && sta0 ? obj(sta0, 'airmax') : null;

    const rawRemoteIps =
      isStaMode && remote0 ? remote0['ipaddr'] : null;
    const remoteApIp =
      Array.isArray(rawRemoteIps) && rawRemoteIps.length > 0
        ? String(rawRemoteIps[0])
        : null;

    return {
      deviceName: str(host, 'hostname'),
      firmwareVersion: str(host, 'fwversion'),
      uptimeSeconds: num(host, 'uptime'),
      deviceTimeEpoch: num(host, 'time'),
      cpuLoadPercent: num(host, 'cpuload'),
      memoryUsedPercent,
      essid: str(wireless, 'essid'),
      macAddress: str(wireless, 'mac'),
      deviceModel: str(host, 'platform'),
      mode: parseMode(str(wireless, 'mode')),
      frequencyMhz: num(wireless, 'frequency'),
      channelWidthMhz: chanbw !== null && chanbw > 0 ? chanbw : null,
      noiseFloorDbm: num(wireless, 'noisef'),
      throughputTxBps:
        txThroughputRaw !== null ? txThroughputRaw * 1000 : null,
      throughputRxBps:
        rxThroughputRaw !== null ? rxThroughputRaw * 1000 : null,
      distanceM: num(wireless, 'distance'),
      clientsConnected:
        deviceType === 'ACCESS_POINT' ? num(wireless, 'count') : null,
      ccqPercent: ccqRaw !== null && ccqRaw > 0 ? ccqRaw / 10 : null,
      signalRxDbm: isStaMode && sta0 ? num(sta0, 'signal') : null,
      signalTxDbm:
        isStaMode && remote0 ? num(remote0, 'signal') : null,
      latencyMs: isStaMode && sta0 ? num(sta0, 'tx_latency') : null,
      remoteApMac: isStaMode && sta0 ? str(sta0, 'mac') : null,
      remoteApName:
        isStaMode && remote0 ? str(remote0, 'hostname') : null,
      remoteApIp,
      capacityRxKbps: airmax0
        ? num(airmax0, 'downlink_capacity')
        : null,
      capacityTxKbps: airmax0
        ? num(airmax0, 'uplink_capacity')
        : null,
      lanStatus,
      lanSpeedMbps,
      clients:
        deviceType === 'ACCESS_POINT' ? sta.map(parseClientEntry) : []
    };
  }
}

// ---------------------------------------------------------------------------
// Module-level parse helpers (avoid closure overhead per call)
// ---------------------------------------------------------------------------

function obj(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const v = source[key];
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function arr(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown>[] {
  const v = source[key];
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

function num(
  source: Record<string, unknown>,
  key: string
): number | null {
  const v = source[key];
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function str(
  source: Record<string, unknown>,
  key: string
): string | null {
  const v = source[key];
  if (v === null || v === undefined) return null;
  return String(v);
}

function big(
  source: Record<string, unknown>,
  key: string
): bigint | null {
  const v = source[key];
  if (v === null || v === undefined) return null;
  try {
    return BigInt(String(v));
  } catch {
    return null;
  }
}

function parseMode(raw: string | null): HttpCollectionResult['mode'] {
  if (
    raw === 'ap-ptmp' ||
    raw === 'sta-ptmp' ||
    raw === 'ap-ptp' ||
    raw === 'sta-ptp'
  ) {
    return raw;
  }
  return null;
}

function parseClientEntry(
  s: Record<string, unknown>
): HttpClientEntry {
  const airmax = obj(s, 'airmax');
  const airmaxRx = obj(airmax, 'rx');
  const airmaxTx = obj(airmax, 'tx');
  const stats = obj(s, 'stats');
  const remote = obj(s, 'remote');
  const rawIps = remote['ipaddr'];
  const remoteIpAddresses = Array.isArray(rawIps)
    ? (rawIps as unknown[]).map(String)
    : [];

  return {
    macAddress: String(s['mac'] ?? ''),
    ipAddress: str(s, 'lastip'),
    signalRxDbm: num(s, 'signal'),
    noiseFloorDbm: num(s, 'noisefloor'),
    distanceM: num(s, 'distance'),
    uptimeSeconds: num(s, 'uptime'),
    txLatencyMs: num(s, 'tx_latency'),
    dlLinkScore: num(s, 'dl_linkscore'),
    ulLinkScore: num(s, 'ul_linkscore'),
    dlCapacityKbps: num(airmax, 'downlink_capacity'),
    ulCapacityKbps: num(airmax, 'uplink_capacity'),
    dlCinr: num(airmaxRx, 'cinr'),
    ulCinr: num(airmaxTx, 'cinr'),
    txBytesTotal: big(stats, 'tx_bytes'),
    rxBytesTotal: big(stats, 'rx_bytes'),
    txPps: num(stats, 'tx_pps'),
    rxPps: num(stats, 'rx_pps'),
    remoteHostname: str(remote, 'hostname'),
    remotePlatform: str(remote, 'platform'),
    remoteVersion: str(remote, 'version'),
    remoteCpuLoad: num(remote, 'cpuload'),
    remoteTotalRam: num(remote, 'totalram'),
    remoteFreeRam: num(remote, 'freeram'),
    remoteSignal: num(remote, 'signal'),
    remoteNoiseFloor: num(remote, 'noisefloor'),
    remoteTxPower: num(remote, 'tx_power'),
    remoteTxThroughputKbps: num(remote, 'tx_throughput'),
    remoteRxThroughputKbps: num(remote, 'rx_throughput'),
    remoteIpAddresses,
    dlAirtimePercent: num(airmaxRx, 'airtime'),
    ulAirtimePercent: num(airmaxTx, 'airtime')
  };
}
