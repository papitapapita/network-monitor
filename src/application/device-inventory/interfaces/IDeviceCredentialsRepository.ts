import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';

export interface DeviceCredentials {
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: string | null;
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: string | null;
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: string | null;
  httpUsername: string | null;
  httpPassword: string | null;
  snmpPort: number;
  httpPort: number;
}

export interface IDeviceCredentialsRepository {
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceCredentials | null>>;
  save(
    deviceId: DeviceId,
    credentials: DeviceCredentials
  ): Promise<Result<void>>;
  delete(deviceId: DeviceId): Promise<Result<void>>;
}
