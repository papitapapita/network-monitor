import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { IVendorSettingsRepository } from 'domain/shared/interfaces';
import {
  IDeviceCredentialsReader,
  RouterConnection
} from '../interfaces';

// Shared with the reconciliation job, which waits quietly for a router instead
// of warning every minute (SVC-060).
export const ENFORCEMENT_ROUTER_NOT_CONFIGURED =
  'Enforcement router is not configured';

// Which router applies suspensions is the vendor's setting (INS-028), read on
// every resolve so setting it from the dashboard needs no restart.
export class EnforcementRouterResolver {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly credentialsReader: IDeviceCredentialsReader,
    private readonly vendorSettings: IVendorSettingsRepository
  ) {}

  async resolve(): Promise<Result<RouterConnection>> {
    const settings = await this.vendorSettings.get();
    if (settings.isFailure) {
      return Result.fail(
        `Failed to read the enforcement router setting: ${settings.error}`
      );
    }
    const router = settings.value.enforcementRouter;
    if (router === null) {
      return Result.fail(ENFORCEMENT_ROUTER_NOT_CONFIGURED);
    }

    const deviceIdResult = DeviceId.parse(router.deviceId);
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
      port: router.apiPort,
      username: credentials.httpUsername,
      password: credentials.httpPassword
    });
  }
}
