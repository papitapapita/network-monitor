import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

/**
 * Read-only view of device credentials used by suspension enforcement.
 * The full CRUD interface lives in the device-inventory BC; this local
 * alias keeps the service-enforcement BC from importing it directly.
 */
export interface RouterCredentials {
  httpUsername: string | null;
  httpPassword: string | null;
}

export interface IDeviceCredentialsReader {
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<RouterCredentials | null>>;
}
