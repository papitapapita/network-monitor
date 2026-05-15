import { PrismaClient } from '../../../generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import {
  IDeviceCredentialsRepository,
  DecryptedCredentials
} from 'application/wireless-monitoring/interfaces';
import { CredentialsEncryption } from '../crypto/CredentialsEncryption';

export class PrismaDeviceCredentialsRepository implements IDeviceCredentialsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByDeviceId(deviceId: DeviceId): Promise<Result<DecryptedCredentials | null>> {
    try {
      const raw = await this.prisma.deviceCredentials.findUnique({
        where: { deviceId: deviceId.toString() },
      });

      if (!raw) return Result.ok(null);

      const credentials: DecryptedCredentials = {
        snmpVersion: raw.snmpVersion as 2 | 3,
        snmpCommunity: raw.snmpCommunity ? CredentialsEncryption.decrypt(raw.snmpCommunity) : null,
        snmpV3AuthUser: raw.snmpV3AuthUser,
        snmpV3AuthProto: raw.snmpV3AuthProto as 'MD5' | 'SHA' | null,
        snmpV3AuthKey: raw.snmpV3AuthKey ? CredentialsEncryption.decrypt(raw.snmpV3AuthKey) : null,
        snmpV3PrivProto: raw.snmpV3PrivProto as 'DES' | 'AES' | null,
        snmpV3PrivKey: raw.snmpV3PrivKey ? CredentialsEncryption.decrypt(raw.snmpV3PrivKey) : null,
        httpUsername: raw.httpUsername,
        httpPassword: raw.httpPassword ? CredentialsEncryption.decrypt(raw.httpPassword) : null,
        snmpPort: raw.snmpPort,
        httpPort: raw.httpPort,
      };

      return Result.ok(credentials);
    } catch (error) {
      return Result.fail(`Database error finding device credentials: ${(error as Error).message}`);
    }
  }

  async save(deviceId: DeviceId, credentials: DecryptedCredentials): Promise<Result<void>> {
    try {
      const encryptedCommunity = credentials.snmpCommunity
        ? CredentialsEncryption.encrypt(credentials.snmpCommunity)
        : null;
      const encryptedAuthKey = credentials.snmpV3AuthKey
        ? CredentialsEncryption.encrypt(credentials.snmpV3AuthKey)
        : null;
      const encryptedPrivKey = credentials.snmpV3PrivKey
        ? CredentialsEncryption.encrypt(credentials.snmpV3PrivKey)
        : null;
      const encryptedHttpPassword = credentials.httpPassword
        ? CredentialsEncryption.encrypt(credentials.httpPassword)
        : null;

      const deviceIdStr = deviceId.toString();

      await this.prisma.deviceCredentials.upsert({
        where: { deviceId: deviceIdStr },
        update: {
          snmpVersion: credentials.snmpVersion,
          snmpCommunity: encryptedCommunity,
          snmpV3AuthUser: credentials.snmpV3AuthUser,
          snmpV3AuthProto: credentials.snmpV3AuthProto,
          snmpV3AuthKey: encryptedAuthKey,
          snmpV3PrivProto: credentials.snmpV3PrivProto,
          snmpV3PrivKey: encryptedPrivKey,
          httpUsername: credentials.httpUsername,
          httpPassword: encryptedHttpPassword,
          snmpPort: credentials.snmpPort,
          httpPort: credentials.httpPort,
        },
        create: {
          deviceId: deviceIdStr,
          snmpVersion: credentials.snmpVersion,
          snmpCommunity: encryptedCommunity,
          snmpV3AuthUser: credentials.snmpV3AuthUser,
          snmpV3AuthProto: credentials.snmpV3AuthProto,
          snmpV3AuthKey: encryptedAuthKey,
          snmpV3PrivProto: credentials.snmpV3PrivProto,
          snmpV3PrivKey: encryptedPrivKey,
          httpUsername: credentials.httpUsername,
          httpPassword: encryptedHttpPassword,
          snmpPort: credentials.snmpPort,
          httpPort: credentials.httpPort,
        },
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(`Database error saving device credentials: ${(error as Error).message}`);
    }
  }
}
