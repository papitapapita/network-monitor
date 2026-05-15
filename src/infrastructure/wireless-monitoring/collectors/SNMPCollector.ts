import * as snmp from 'net-snmp';
import { Result } from 'domain/shared/core';
import {
  ISNMPCollector,
  SNMPCredentials,
  SNMPCollectionResult
} from 'application/wireless-monitoring/interfaces';

const SCALAR_OIDS = [
  '1.3.6.1.2.1.1.1.0', // sysDescr
  '1.3.6.1.2.1.1.5.0', // sysName
  '1.3.6.1.2.1.1.3.0', // sysUpTime
  '1.3.6.1.2.1.2.2.1.8.2', // ifOperStatus (LAN port index 2)
  '1.3.6.1.2.1.2.2.1.5.2', // ifSpeed
  '1.3.6.1.2.1.31.1.1.1.6.2', // ifHCInOctets
  '1.3.6.1.2.1.31.1.1.1.10.2', // ifHCOutOctets
  '1.3.6.1.2.1.31.1.1.1.7.2', // ifInUcastPkts
  '1.3.6.1.2.1.31.1.1.1.11.2', // ifOutUcastPkts
  '1.3.6.1.4.1.41112.1.4.5.1.5', // ubntWlStatSignal
  '1.3.6.1.4.1.41112.1.4.5.1.4', // ubntWlStatRssi
  '1.3.6.1.4.1.41112.1.4.5.1.6', // ubntWlStatNoiseFloor
  '1.3.6.1.4.1.41112.1.4.5.1.15', // ubntWlStatCcq
  '1.3.6.1.4.1.41112.1.4.5.1.8', // ubntWlStatTxRate
  '1.3.6.1.4.1.41112.1.4.5.1.9', // ubntWlStatRxRate
  '1.3.6.1.4.1.41112.1.4.5.1.3', // ubntWlStatFreq
  '1.3.6.1.4.1.41112.1.4.5.1.11', // ubntWlStatTxPower
  '1.3.6.1.4.1.41112.1.4.7.1' // ubntStaCount
];

export class SNMPCollector implements ISNMPCollector {
  private readonly timeoutMs = 5000;

  async collect(
    ipAddress: string,
    credentials: SNMPCredentials
  ): Promise<Result<SNMPCollectionResult>> {
    let session: snmp.Session | undefined;
    try {
      session = this.createSession(ipAddress, credentials);
      const varbinds = await this.getWithTimeout(
        session,
        SCALAR_OIDS
      );
      const result = this.parseVarbinds(varbinds);
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
        version: snmp.Version2c
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

  private parseVarbinds(
    varbinds: snmp.Varbind[]
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

    const ifOperStatus = num('1.3.6.1.2.1.2.2.1.8.2');
    const ifSpeedRaw = num('1.3.6.1.2.1.2.2.1.5.2');
    const txRateRaw = num('1.3.6.1.4.1.41112.1.4.5.1.8');
    const rxRateRaw = num('1.3.6.1.4.1.41112.1.4.5.1.9');

    return {
      signalRxDbm: num('1.3.6.1.4.1.41112.1.4.5.1.5'),
      signalTxDbm: null,
      noiseFloorDbm: num('1.3.6.1.4.1.41112.1.4.5.1.6'),
      snrDb: null,
      ccqPercent: num('1.3.6.1.4.1.41112.1.4.5.1.15'),
      txRateMbps: txRateRaw !== null ? txRateRaw / 1000 : null,
      rxRateMbps: rxRateRaw !== null ? rxRateRaw / 1000 : null,
      frequencyMhz: num('1.3.6.1.4.1.41112.1.4.5.1.3'),
      channelWidthMhz: null,
      txPowerDbm: num('1.3.6.1.4.1.41112.1.4.5.1.11'),
      ifHCInOctets: big('1.3.6.1.2.1.31.1.1.1.6.2'),
      ifHCOutOctets: big('1.3.6.1.2.1.31.1.1.1.10.2'),
      ifInUcastPkts: num('1.3.6.1.2.1.31.1.1.1.7.2'),
      ifOutUcastPkts: num('1.3.6.1.2.1.31.1.1.1.11.2'),
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
        return d ? ((d.match(/v(\S+)/) ?? [])[1] ?? null) : null;
      })(),
      uptimeSeconds: (() => {
        const v = num('1.3.6.1.2.1.1.3.0');
        return v !== null ? Math.floor(v / 100) : null;
      })(),
      cpuLoadPercent: null,
      memoryUsedPercent: null,
      clientsConnected: num('1.3.6.1.4.1.41112.1.4.7.1'),
      remoteApMac: null,
      remoteApName: null,
      distanceM: null,
      latencyMs: null
    };
  }
}
