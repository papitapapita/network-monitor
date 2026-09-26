import { Result } from 'domain/shared/core';

export interface HttpCredentials {
  username: string;
  password: string;
  port: number;
}

export interface IWirelessDeviceRebooter {
  reboot(
    ipAddress: string,
    credentials: HttpCredentials
  ): Promise<Result<void>>;
}
