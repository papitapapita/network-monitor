import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring';
import {
  IDeviceReach,
  IDeviceVendorLookup,
  IRadioLoginSource,
  OUT_OF_SERVER_REACH,
  RadioReach,
  RadioTarget
} from '../interfaces';

export interface RadioTargetSources {
  configRepo: IWirelessDeviceConfigRepository;
  loginSource: IRadioLoginSource;
  vendorLookup: IDeviceVendorLookup;
  deviceReach: IDeviceReach;
}

// Who talks to the radio and with what (WLS-225): the same reach a wireless
// poll uses, the address of its wireless configuration and its HTTP login.
export async function resolveRadioTarget(
  sources: RadioTargetSources,
  deviceId: DeviceId
): Promise<Result<{ reach: RadioReach; target: RadioTarget }>> {
  const reader = await sources.deviceReach.readerFor(deviceId);
  if (reader.isFailure)
    return Result.fail(
      `Failed to check device reach: ${reader.error}`
    );
  if (reader.value.by === 'none')
    return Result.fail(OUT_OF_SERVER_REACH);

  const config = await sources.configRepo.findByDeviceId(deviceId);
  if (config.isFailure)
    return Result.fail(
      `Failed to load wireless polling config: ${config.error}`
    );
  if (!config.value)
    return Result.fail(
      'No wireless polling configuration found for device'
    );
  if (!config.value.ipAddress)
    return Result.fail('IP address not configured for device');

  const vendor = await sources.vendorLookup.findVendorSlug(deviceId);
  if (vendor.isFailure)
    return Result.fail(`Failed to look up vendor: ${vendor.error}`);
  if (!vendor.value)
    return Result.fail('Vendor not configured for device');

  const login = await sources.loginSource.findByDeviceId(deviceId);
  if (login.isFailure)
    return Result.fail(`Failed to load credentials: ${login.error}`);
  if (!login.value)
    return Result.fail('HTTP credentials not configured for device');

  return Result.ok({
    reach: reader.value,
    target: {
      ipAddress: config.value.ipAddress.value,
      vendor: vendor.value,
      deviceType: config.value.deviceType,
      login: login.value
    }
  });
}
