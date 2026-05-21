import * as snmp from 'net-snmp';
import { Result } from 'domain/shared/core';
import {
  ISNMPCollector,
  SNMPCredentials,
  SNMPCollectionResult
} from 'application/wireless-monitoring/interfaces';

const BASE_OIDS = [
  // Standard MIB-II
  '1.3.6.1.2.1.1.1.0', // sysDescr (firmware version string)
  '1.3.6.1.2.1.1.5.0', // sysName (device hostname)
  '1.3.6.1.2.1.1.3.0', // sysUpTime (centiseconds)
  '1.3.6.1.2.1.2.2.1.8.2', // ifOperStatus (LAN port index 2)
  '1.3.6.1.2.1.2.2.1.5.2', // ifSpeed (LAN port index 2)
  // ubntWlTable — radio config (instance .1)
  '1.3.6.1.4.1.41112.1.4.1.1.4.1', // frequency (MHz)
  '1.3.6.1.4.1.41112.1.4.1.1.5.1', // channel width index (0=5,1=10,2=20,3=40,4=80 MHz)
  // ubntWlStatTable — CPE link/connection status (instance .1)
  '1.3.6.1.4.1.41112.1.4.5.1.2.1', // connected AP SSID
  '1.3.6.1.4.1.41112.1.4.5.1.4.1', // AP MAC address (Hex-STRING)
  '1.3.6.1.4.1.41112.1.4.5.1.5.1', // signal Rx from AP (dBm)
  '1.3.6.1.4.1.41112.1.4.5.1.7.1', // CCQ (0–1000; divide by 10 for %)
  '1.3.6.1.4.1.41112.1.4.5.1.8.1', // noise floor (dBm)
  '1.3.6.1.4.1.41112.1.4.5.1.9.1', // Tx rate (bps)
  '1.3.6.1.4.1.41112.1.4.5.1.10.1', // Rx rate (bps)
  '1.3.6.1.4.1.41112.1.4.5.1.14.1', // distance to AP (meters)
  '1.3.6.1.4.1.41112.1.4.5.1.15.1', // association uptime (centiseconds)
  // AP system info (meaningful on AP mode; may be absent on CPE)
  '1.3.6.1.4.1.41112.1.4.8.3.0' // connected station count (AP mode)
];

// SNMPv1: Counter32 — available on all devices including AirOS 8
const V1_TRAFFIC_OIDS = [
  '1.3.6.1.2.1.2.2.1.10.2', // ifInOctets  (Counter32, wraps at ~4 GB)
  '1.3.6.1.2.1.2.2.1.16.2', // ifOutOctets (Counter32)
  '1.3.6.1.2.1.2.2.1.11.2', // ifInUcastPkts
  '1.3.6.1.2.1.2.2.1.17.2' // ifOutUcastPkts
];

// SNMPv2c/v3: Counter64 — no wrap issues at any line rate
const V2_TRAFFIC_OIDS = [
  '1.3.6.1.2.1.31.1.1.1.6.2', // ifHCInOctets  (Counter64)
  '1.3.6.1.2.1.31.1.1.1.10.2', // ifHCOutOctets (Counter64)
  '1.3.6.1.2.1.31.1.1.1.7.2', // ifHCInUcastPkts
  '1.3.6.1.2.1.31.1.1.1.11.2' // ifHCOutUcastPkts
];

export class SNMPCollector implements ISNMPCollector {
  private readonly timeoutMs = 5000;

  async collect(
    ipAddress: string,
    credentials: SNMPCredentials
  ): Promise<Result<SNMPCollectionResult>> {
    let session: snmp.Session | undefined;
    const useV1Counters = credentials.version === 1;
    const oids = [
      ...BASE_OIDS,
      ...(useV1Counters ? V1_TRAFFIC_OIDS : V2_TRAFFIC_OIDS)
    ];
    try {
      session = this.createSession(ipAddress, credentials);
      // SNMPv1: a single bad OID kills the whole GET PDU, so fetch individually
      // and silently skip OIDs the device doesn't implement.
      // SNMPv2c/v3: batch GET — each varbind carries its own error status.
      const varbinds = useV1Counters
        ? await this.getEachOid(session, oids)
        : await this.getWithTimeout(session, oids);
      const result = this.parseVarbinds(varbinds, useV1Counters);
      return Result.ok(result);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      if (msg.includes('Timed out') || msg.includes('timeout')) {
        return Result.fail('SNMP_TIMEOUT');
      }
      return Result.fail(`SNMP error: ${msg}`);
    } finally {
      session?.close();
    }
  }

  private createSession(
    ipAddress: string,
    credentials: SNMPCredentials
  ): snmp.Session {
    if (credentials.version === 3) {
      const user: snmp.User = {
        name: credentials.authUser ?? '',
        level: snmp.SecurityLevel.authPriv,
        authProtocol:
          credentials.authProtocol === 'SHA'
            ? snmp.AuthProtocols.sha
            : snmp.AuthProtocols.md5,
        authKey: credentials.authKey ?? '',
        privProtocol:
          credentials.privProtocol === 'AES'
            ? snmp.PrivProtocols.aes
            : snmp.PrivProtocols.des,
        privKey: credentials.privKey ?? ''
      };
      const options: snmp.SessionOptionsV3 = {
        port: credentials.port,
        retries: 0,
        timeout: this.timeoutMs
      };
      return snmp.createV3Session(ipAddress, user, options);
    } else {
      const options: snmp.SessionOptions = {
        port: credentials.port,
        retries: 0,
        timeout: this.timeoutMs,
        version:
          credentials.version === 1 ? snmp.Version1 : snmp.Version2c
      };
      return snmp.createSession(
        ipAddress,
        credentials.community ?? 'public',
        options
      );
    }
  }

  private getWithTimeout(
    session: snmp.Session,
    oids: string[]
  ): Promise<snmp.Varbind[]> {
    return new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) reject(error);
        else resolve(varbinds ?? []);
      });
    });
  }

  // For SNMPv1: fetch each OID in its own GET and skip NoSuchName responses
  // so a missing OID doesn't abort the entire collection.
  private async getEachOid(
    session: snmp.Session,
    oids: string[]
  ): Promise<snmp.Varbind[]> {
    const results: snmp.Varbind[] = [];
    for (const oid of oids) {
      try {
        const varbinds = await new Promise<snmp.Varbind[]>(
          (resolve, reject) => {
            session.get([oid], (error, varbinds) => {
              if (error) reject(error);
              else resolve(varbinds ?? []);
            });
          }
        );
        results.push(...varbinds);
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : String(error);
        if (
          msg.includes('NoSuchName') ||
          msg.includes('noSuchName')
        ) {
          continue; // OID not implemented on this device — treat as null
        }
        throw error; // timeout or auth error — propagate
      }
    }
    return results;
  }

  private parseVarbinds(
    varbinds: snmp.Varbind[],
    useV1Counters: boolean
  ): SNMPCollectionResult {
    const get = (oid: string): unknown => {
      const vb = varbinds.find((v) => v.oid === oid);
      if (!vb || snmp.isVarbindError(vb)) return null;
      return vb.value;
    };

    const num = (oid: string): number | null => {
      const v = get(oid);
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    const str = (oid: string): string | null => {
      const v = get(oid);
      if (v === null || v === undefined) return null;
      return v instanceof Buffer ? v.toString('utf8') : String(v);
    };

    const big = (oid: string): bigint | null => {
      const v = get(oid);
      if (v === null || v === undefined) return null;
      try {
        return BigInt(String(v));
      } catch {
        return null;
      }
    };

    const CHANNEL_WIDTH_MHZ = [5, 10, 20, 40, 80];

    const ifOperStatus = num('1.3.6.1.2.1.2.2.1.8.2');
    const ifSpeedRaw = num('1.3.6.1.2.1.2.2.1.5.2');
    const txRateRaw = num('1.3.6.1.4.1.41112.1.4.5.1.9.1');
    const rxRateRaw = num('1.3.6.1.4.1.41112.1.4.5.1.10.1');
    const ccqRaw = num('1.3.6.1.4.1.41112.1.4.5.1.7.1');
    const signalRxDbm = num('1.3.6.1.4.1.41112.1.4.5.1.5.1');
    const noiseFloorDbm = num('1.3.6.1.4.1.41112.1.4.5.1.8.1');
    const chWidthIdx = num('1.3.6.1.4.1.41112.1.4.1.1.5.1');

    const remoteApMac = (() => {
      const v = get('1.3.6.1.4.1.41112.1.4.5.1.4.1');
      if (!v) return null;
      const buf = v instanceof Buffer ? v : null;
      if (!buf || buf.length !== 6) return null;
      return Array.from(buf)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(':')
        .toUpperCase();
    })();

    return {
      signalRxDbm,
      signalTxDbm: null, // only available from the AP side
      noiseFloorDbm,
      snrDb:
        signalRxDbm !== null && noiseFloorDbm !== null
          ? signalRxDbm - noiseFloorDbm
          : null,
      // CCQ is M-series only — AirMax AC devices do not implement it.
      // A null or zero raw value means unsupported; only positive values are valid.
      ccqPercent: ccqRaw !== null && ccqRaw > 0 ? ccqRaw / 10 : null,
      txRateMbps: txRateRaw !== null ? txRateRaw / 1_000_000 : null,
      rxRateMbps: rxRateRaw !== null ? rxRateRaw / 1_000_000 : null,
      frequencyMhz: num('1.3.6.1.4.1.41112.1.4.1.1.4.1'),
      channelWidthMhz:
        chWidthIdx !== null &&
        chWidthIdx >= 0 &&
        chWidthIdx < CHANNEL_WIDTH_MHZ.length
          ? CHANNEL_WIDTH_MHZ[chWidthIdx]
          : null,
      txPowerDbm: null, // not exposed via SNMP on AirOS
      ifHCInOctets: useV1Counters
        ? (() => {
            const v = num('1.3.6.1.2.1.2.2.1.10.2');
            return v !== null ? BigInt(v) : null;
          })()
        : big('1.3.6.1.2.1.31.1.1.1.6.2'),
      ifHCOutOctets: useV1Counters
        ? (() => {
            const v = num('1.3.6.1.2.1.2.2.1.16.2');
            return v !== null ? BigInt(v) : null;
          })()
        : big('1.3.6.1.2.1.31.1.1.1.10.2'),
      ifInUcastPkts: num(
        useV1Counters
          ? '1.3.6.1.2.1.2.2.1.11.2'
          : '1.3.6.1.2.1.31.1.1.1.7.2'
      ),
      ifOutUcastPkts: num(
        useV1Counters
          ? '1.3.6.1.2.1.2.2.1.17.2'
          : '1.3.6.1.2.1.31.1.1.1.11.2'
      ),
      lanStatus:
        ifOperStatus === 1
          ? 'UP'
          : ifOperStatus === 2
            ? 'DOWN'
            : null,
      lanSpeedMbps:
        ifSpeedRaw !== null
          ? Math.round(ifSpeedRaw / 1_000_000)
          : null,
      lanDuplex: null,
      sysDescr: str('1.3.6.1.2.1.1.1.0'),
      sysName: str('1.3.6.1.2.1.1.5.0'),
      firmwareVersion: (() => {
        const d = str('1.3.6.1.2.1.1.1.0');
        return d
          ? ((d.match(/XM\.v(\S+)|XW\.v(\S+)|v(\S+)/) ?? [])
              .slice(1)
              .find(Boolean) ?? null)
          : null;
      })(),
      uptimeSeconds: (() => {
        const v = num('1.3.6.1.2.1.1.3.0');
        return v !== null ? Math.floor(v / 100) : null;
      })(),
      cpuLoadPercent: null,
      memoryUsedPercent: null,
      clientsConnected: num('1.3.6.1.4.1.41112.1.4.8.3.0'),
      remoteApMac,
      remoteApName: str('1.3.6.1.4.1.41112.1.4.5.1.2.1'),
      distanceM: num('1.3.6.1.4.1.41112.1.4.5.1.14.1'),
      latencyMs: null
    };
  }
}
