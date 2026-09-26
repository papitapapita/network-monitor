import { VarbindValue } from 'net-snmp';
import { Result } from 'domain/shared/core';
import {
  IWirelessCollector,
  DecryptedCredentials,
  WirelessCollectionResult
} from 'application/wireless-monitoring/interfaces';
import { SnmpClient, SnmpValues } from './SnmpClient';

// OIDs from MIMOSA-NETWORKS-BFIVE-MIB (enterprise 43356), which the C5c and
// C5x answer on alongside standard MIB-II.
const B5 = '1.3.6.1.4.1.43356.2.1.2';
export const MIMOSA_OIDS = {
  deviceName: `${B5}.1.1.0`,
  firmwareVersion: `${B5}.1.3.0`,
  lastRebootTime: `${B5}.1.5.0`,
  wanSsid: `${B5}.3.1.0`,
  wanMac: `${B5}.3.2.0`,
  chainRxPower: (chain: number) => `${B5}.6.1.1.3.${chain}`,
  chainRxNoise: (chain: number) => `${B5}.6.1.1.4.${chain}`,
  channelWidth: `${B5}.6.3.1.3.1`,
  channelCenterFreq: `${B5}.6.3.1.5.1`,
  phyTxRate: `${B5}.7.1.0`,
  phyRxRate: `${B5}.7.2.0`,
  sysDescr: '1.3.6.1.2.1.1.1.0',
  ethOperStatus: '1.3.6.1.2.1.2.2.1.8.1',
  ethHighSpeed: '1.3.6.1.2.1.31.1.1.1.15.1'
} as const;

const CHAINS = [1, 2];
// The MIB marks an unused RF chain with an Rx power of -100 dBm.
const INVALID_CHAIN_RX_DBM = -100;

export class MimosaSnmpCollector implements IWirelessCollector {
  readonly method = 'snmp' as const;

  constructor(
    private readonly client: SnmpClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async collect(
    ipAddress: string,
    credentials: DecryptedCredentials
  ): Promise<Result<WirelessCollectionResult>> {
    const oids = [
      MIMOSA_OIDS.deviceName,
      MIMOSA_OIDS.firmwareVersion,
      MIMOSA_OIDS.lastRebootTime,
      MIMOSA_OIDS.wanSsid,
      MIMOSA_OIDS.wanMac,
      ...CHAINS.map(MIMOSA_OIDS.chainRxPower),
      ...CHAINS.map(MIMOSA_OIDS.chainRxNoise),
      MIMOSA_OIDS.channelWidth,
      MIMOSA_OIDS.channelCenterFreq,
      MIMOSA_OIDS.phyTxRate,
      MIMOSA_OIDS.phyRxRate,
      MIMOSA_OIDS.sysDescr,
      MIMOSA_OIDS.ethOperStatus,
      MIMOSA_OIDS.ethHighSpeed
    ];

    const fetched = await this.client.get(
      ipAddress,
      credentials,
      oids
    );
    if (fetched.isFailure) return Result.fail(fetched.error!);
    const v = fetched.value;

    if (!v.has(MIMOSA_OIDS.firmwareVersion)) {
      return Result.fail(
        'Device did not answer the Mimosa MIB — is it a Mimosa radio?'
      );
    }

    return Result.ok(this.parse(v));
  }

  private parse(v: SnmpValues): WirelessCollectionResult {
    const chains = CHAINS.map((c) => ({
      rx: decimalOne(v.get(MIMOSA_OIDS.chainRxPower(c))),
      noise: decimalOne(v.get(MIMOSA_OIDS.chainRxNoise(c)))
    })).filter(
      (c): c is { rx: number; noise: number } =>
        c.rx !== null &&
        c.rx > INVALID_CHAIN_RX_DBM &&
        c.noise !== null
    );

    const ethStatus = int(v.get(MIMOSA_OIDS.ethOperStatus));
    const phyTxKbps = decimalTwo(v.get(MIMOSA_OIDS.phyTxRate));
    const phyRxKbps = decimalTwo(v.get(MIMOSA_OIDS.phyRxRate));

    return {
      deviceName: text(v.get(MIMOSA_OIDS.deviceName)),
      firmwareVersion: text(v.get(MIMOSA_OIDS.firmwareVersion)),
      uptimeSeconds: this.secondsSince(
        text(v.get(MIMOSA_OIDS.lastRebootTime))
      ),
      deviceTimeEpoch: null,
      cpuLoadPercent: null,
      memoryUsedPercent: null,
      essid: text(v.get(MIMOSA_OIDS.wanSsid)),
      // The MIB says AP or station but not PTP or PTMP.
      mode: null,
      frequencyMhz: positive(
        int(v.get(MIMOSA_OIDS.channelCenterFreq))
      ),
      channelWidthMhz: positive(int(v.get(MIMOSA_OIDS.channelWidth))),
      // Per-chain averages, so signal minus noise matches the per-chain SNR
      // the radio's own UI shows rather than a combined-power figure.
      signalRxDbm: average(chains.map((c) => c.rx)),
      noiseFloorDbm: average(chains.map((c) => c.noise)),
      throughputTxBps:
        phyTxKbps !== null ? Math.round(phyTxKbps * 1000) : null,
      throughputRxBps:
        phyRxKbps !== null ? Math.round(phyRxKbps * 1000) : null,
      wirelessTxBytes: null,
      wirelessRxBytes: null,
      distanceM: null,
      clientsConnected: null,
      ccqPercent: null,
      signalTxDbm: null,
      latencyMs: null,
      remoteApMac: null,
      remoteApName: null,
      remoteApIp: null,
      // Mimosa reports only the raw PHY rate, which is not the usable-capacity
      // estimate AirOS gives and would make the capacity floors meaningless.
      capacityTxKbps: null,
      capacityRxKbps: null,
      lanStatus:
        ethStatus === 1 ? 'UP' : ethStatus === 2 ? 'DOWN' : null,
      lanSpeedMbps: positive(int(v.get(MIMOSA_OIDS.ethHighSpeed))),
      macAddress: mac(v.get(MIMOSA_OIDS.wanMac)),
      deviceModel: text(v.get(MIMOSA_OIDS.sysDescr)),
      clients: []
    };
  }

  // Reported as e.g. "2026-09-22 11:10:14 (UTC +0000)". sysUpTime is no
  // substitute: it restarts whenever the SNMP agent does.
  private secondsSince(rebootTime: string | null): number | null {
    const m = rebootTime?.match(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \(UTC ([+-])(\d{2})(\d{2})\)$/
    );
    if (!m) return null;
    const rebootedAt = Date.parse(
      `${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`
    );
    if (Number.isNaN(rebootedAt)) return null;
    const seconds = Math.floor(
      (this.now().getTime() - rebootedAt) / 1000
    );
    return seconds >= 0 ? seconds : null;
  }
}

function int(value: VarbindValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return null;
}

function decimalOne(value: VarbindValue): number | null {
  const n = int(value);
  return n !== null ? n / 10 : null;
}

function decimalTwo(value: VarbindValue): number | null {
  const n = int(value);
  return n !== null ? n / 100 : null;
}

function positive(n: number | null): number | null {
  return n !== null && n > 0 ? n : null;
}

function text(value: VarbindValue): string | null {
  const s = Buffer.isBuffer(value)
    ? value.toString('utf8')
    : typeof value === 'string'
      ? value
      : null;
  const trimmed = s?.replace(/\0+$/, '').trim();
  return trimmed ? trimmed : null;
}

function mac(value: VarbindValue): string | null {
  if (!Buffer.isBuffer(value) || value.length !== 6) return null;
  return [...value]
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(mean * 10) / 10;
}
