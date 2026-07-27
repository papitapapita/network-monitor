import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import {
  IDeviceCredentialsReader,
  RouterConnection
} from '../interfaces';

export interface EnforcementRouterConfig {
  routerDeviceId: string;
  apiPort: number;
}

export class EnforcementRouterResolver {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly credentialsReader: IDeviceCredentialsReader,
    private readonly config: EnforcementRouterConfig
  ) {}

  async resolve(): Promise<Result<RouterConnection>> {
    const deviceIdResult = DeviceId.parse(this.config.routerDeviceId);
    if (deviceIdResult.isFailure) {
      return Result.fail(
        `Invalid enforcement router device ID: ${deviceIdResult.error}`
      );
    }
    const deviceId = deviceIdResult.value;

    const deviceResult = await this.deviceRepo.findById(deviceId);
    if (deviceResult.isFailure) {
      return Result.fail(
        `Failed to load enforcement router device: ${deviceResult.error}`
      );
    }
    const device = deviceResult.value;
    if (!device) {
      return Result.fail('Enforcement router device not found');
    }
    if (!device.ipAddress) {
      return Result.fail(
        'Enforcement router device has no IP address'
      );
    }

    const credentialsResult =
      await this.credentialsReader.findByDeviceId(deviceId);
    if (credentialsResult.isFailure) {
      return Result.fail(
        `Failed to load enforcement router credentials: ${credentialsResult.error}`
      );
    }
    const credentials = credentialsResult.value;
    if (
      !credentials ||
      !credentials.httpUsername ||
      !credentials.httpPassword
    ) {
      return Result.fail(
        'Enforcement router credentials not configured'
      );
    }

    return Result.ok({
      host: device.ipAddress.value,
      port: this.config.apiPort,
      username: credentials.httpUsername,
      password: credentials.httpPassword
    });
  }
}
