import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';

/**
 * Read-only view of device credentials used by wireless polling.
 * The full CRUD interface lives in the device-inventory BC.
 * DecryptedCredentials is kept as a local alias so PollWirelessDeviceUseCase
 * does not need to import from another bounded context.
 */
export interface DecryptedCredentials {
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
  ): Promise<Result<DecryptedCredentials | null>>;
}
