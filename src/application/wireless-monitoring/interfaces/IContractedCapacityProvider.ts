import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

// The link capacity a device's contracted service entitles it to, in kbps,
// as download + upload combined — the same tx + rx total that saturation and
// utilisation are measured against. Null when no current contract covers the
// device; the customers context decides what "current" means, not this one.
export interface IContractedCapacityProvider {
  findKbpsByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<number | null>>;

  // Keyed by device id string; devices without a current contract are absent.
  findKbpsForAllDevices(): Promise<Result<Map<string, number>>>;
}
