import { Result } from 'domain/shared/core';
import { HttpCredentials } from './IUbiquitiHttpCollector';

export interface IWirelessDeviceRebooter {
  reboot(
    ipAddress: string,
    credentials: HttpCredentials
  ): Promise<Result<void>>;
}
