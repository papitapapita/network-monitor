import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface DeviceBasicInfo {
  name: string;
  macAddress: string | null;
}

export interface IDeviceRepository {
  findIdByMacAddress(mac: string): Promise<Result<DeviceId | null>>;
  findIdByIpAddress(ip: string): Promise<Result<DeviceId | null>>;

  // Minimal display info for a device, without exposing device-inventory's
  // domain model to this context.
  findBasicInfoById(
    deviceId: DeviceId
  ): Promise<Result<DeviceBasicInfo | null>>;

  // Returns null when the device may be wireless-polled, or the reason it may
  // not. Deliberately hands back the answer rather than the Device aggregate:
  // device-inventory's model stays out of this context, and the adapter is
  // where the eligibility rule is applied.
  findWirelessIneligibilityReason(
    deviceId: DeviceId
  ): Promise<Result<string | null>>;

  // The device's declared upstream (DEV-180) — for a STATION, the AP it is
  // meant to sit on.
  findUpstreamId(
    deviceId: DeviceId
  ): Promise<Result<DeviceId | null>>;

  // Fills an undeclared upstream with the AP the radio reports. Never
  // overwrites one: a mismatch is drift for the operator to resolve, not
  // something a poll decides. Device Inventory's link rules still apply, so
  // an AP they refuse is left undeclared. Resolves true when it linked.
  declareUpstreamIfUnset(
    deviceId: DeviceId,
    upstreamId: DeviceId
  ): Promise<Result<boolean>>;
}
