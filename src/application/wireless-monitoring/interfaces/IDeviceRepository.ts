import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface IDeviceRepository {
  findIdByMacAddress(mac: string): Promise<Result<DeviceId | null>>;

  // Returns null when the device may be wireless-polled, or the reason it may
  // not. Deliberately hands back the answer rather than the Device aggregate:
  // device-inventory's model stays out of this context, and the adapter is
  // where the eligibility rule is applied.
  findWirelessIneligibilityReason(
    deviceId: DeviceId
  ): Promise<Result<string | null>>;
}
