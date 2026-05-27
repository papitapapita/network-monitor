import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IDeviceCredentialsRepository,
  DeviceCredentials
} from 'application/device-inventory/interfaces';
import { CredentialsEncryption } from '../wireless-monitoring/crypto';

export class PrismaDeviceCredentialsRepository
  implements IDeviceCredentialsRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceCredentials | null>> {
    try {
      const raw = await this.prisma.deviceCredentials.findUnique({
        where: { deviceId: deviceId.toString() }
      });

      if (!raw) return Result.ok(null);

      return Result.ok({
        snmpVersion: raw.snmpVersion as 2 | 3,
        snmpCommunity: raw.snmpCommunity
          ? CredentialsEncryption.decrypt(raw.snmpCommunity)
          : null,
        snmpV3AuthUser: raw.snmpV3AuthUser,
        snmpV3AuthProto: raw.snmpV3AuthProto as 'MD5' | 'SHA' | null,
        snmpV3AuthKey: raw.snmpV3AuthKey
          ? CredentialsEncryption.decrypt(raw.snmpV3AuthKey)
          : null,
        snmpV3PrivProto: raw.snmpV3PrivProto as 'DES' | 'AES' | null,
        snmpV3PrivKey: raw.snmpV3PrivKey
          ? CredentialsEncryption.decrypt(raw.snmpV3PrivKey)
          : null,
        httpUsername: raw.httpUsername,
        httpPassword: raw.httpPassword
          ? CredentialsEncryption.decrypt(raw.httpPassword)
          : null,
        snmpPort: raw.snmpPort,
        httpPort: raw.httpPort
      });
    } catch (error) {
      return Result.fail(
        `Database error finding credentials: ${(error as Error).message}`
      );
    }
  }

  async save(
    deviceId: DeviceId,
    credentials: DeviceCredentials
  ): Promise<Result<void>> {
    try {
      const deviceIdStr = deviceId.toString();

      await this.prisma.deviceCredentials.upsert({
        where: { deviceId: deviceIdStr },
        update: this.toEncryptedRecord(credentials),
        create: {
          deviceId: deviceIdStr,
          ...this.toEncryptedRecord(credentials)
        }
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        `Database error saving credentials: ${(error as Error).message}`
      );
    }
  }

  async delete(deviceId: DeviceId): Promise<Result<void>> {
    try {
      await this.prisma.deviceCredentials.deleteMany({
        where: { deviceId: deviceId.toString() }
      });
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        `Database error deleting credentials: ${(error as Error).message}`
      );
    }
  }

  private toEncryptedRecord(c: DeviceCredentials) {
    return {
      snmpVersion: c.snmpVersion,
      snmpCommunity: c.snmpCommunity
        ? CredentialsEncryption.encrypt(c.snmpCommunity)
        : null,
      snmpV3AuthUser: c.snmpV3AuthUser,
      snmpV3AuthProto: c.snmpV3AuthProto,
      snmpV3AuthKey: c.snmpV3AuthKey
        ? CredentialsEncryption.encrypt(c.snmpV3AuthKey)
        : null,
      snmpV3PrivProto: c.snmpV3PrivProto,
      snmpV3PrivKey: c.snmpV3PrivKey
        ? CredentialsEncryption.encrypt(c.snmpV3PrivKey)
        : null,
      httpUsername: c.httpUsername,
      httpPassword: c.httpPassword
        ? CredentialsEncryption.encrypt(c.httpPassword)
        : null,
      snmpPort: c.snmpPort,
      httpPort: c.httpPort
    };
  }
}
