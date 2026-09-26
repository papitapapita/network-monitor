import * as snmp from 'net-snmp';
import { Result } from 'domain/shared/core';
import { DecryptedCredentials } from 'application/wireless-monitoring/interfaces';

export type SnmpValues = ReadonlyMap<string, snmp.VarbindValue>;

const AUTH_PROTOCOLS = {
  MD5: snmp.AuthProtocols.md5,
  SHA: snmp.AuthProtocols.sha
} as const;

const PRIV_PROTOCOLS = {
  DES: snmp.PrivProtocols.des,
  AES: snmp.PrivProtocols.aes
} as const;

export class SnmpClient {
  constructor(
    private readonly timeoutMs: number,
    private readonly retries = 1
  ) {}

  // Resolves with only the OIDs the agent answered; an OID the device does
  // not implement is left out rather than failing the whole request.
  async get(
    ipAddress: string,
    credentials: DecryptedCredentials,
    oids: string[]
  ): Promise<Result<SnmpValues>> {
    const sessionResult = this.openSession(ipAddress, credentials);
    if (sessionResult.isFailure)
      return Result.fail(sessionResult.error!);
    const session = sessionResult.value;

    return new Promise((resolve) => {
      session.get(oids, (error, varbinds) => {
        session.close();
        if (error) {
          resolve(
            Result.fail(`SNMP request failed: ${error.message}`)
          );
          return;
        }
        const values = new Map<string, snmp.VarbindValue>();
        for (const vb of varbinds ?? []) {
          if (!snmp.isVarbindError(vb)) values.set(vb.oid, vb.value);
        }
        resolve(Result.ok(values));
      });
    });
  }

  private openSession(
    ipAddress: string,
    c: DecryptedCredentials
  ): Result<snmp.Session> {
    const common = {
      port: c.snmpPort,
      timeout: this.timeoutMs,
      retries: this.retries
    };

    if (c.snmpVersion === 3) {
      if (!c.snmpV3AuthUser) {
        return Result.fail('SNMPv3 requires a username');
      }
      const level = c.snmpV3PrivKey
        ? snmp.SecurityLevel.authPriv
        : c.snmpV3AuthKey
          ? snmp.SecurityLevel.authNoPriv
          : snmp.SecurityLevel.noAuthNoPriv;
      return Result.ok(
        snmp.createV3Session(
          ipAddress,
          {
            name: c.snmpV3AuthUser,
            level,
            authProtocol: c.snmpV3AuthProto
              ? AUTH_PROTOCOLS[c.snmpV3AuthProto]
              : undefined,
            authKey: c.snmpV3AuthKey ?? undefined,
            privProtocol: c.snmpV3PrivProto
              ? PRIV_PROTOCOLS[c.snmpV3PrivProto]
              : undefined,
            privKey: c.snmpV3PrivKey ?? undefined
          },
          { ...common, version: snmp.Version3 }
        )
      );
    }

    if (!c.snmpCommunity) {
      return Result.fail('SNMP community is not configured');
    }
    return Result.ok(
      snmp.createSession(ipAddress, c.snmpCommunity, {
        ...common,
        version: c.snmpVersion === 1 ? snmp.Version1 : snmp.Version2c
      })
    );
  }
}
