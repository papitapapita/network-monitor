import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from '../interfaces';

// Shared by the parent-AP suggestion (WLS-151) and the drift alert (WLS-013),
// so the alert never names an AP the suggestion would not offer.
export async function resolveReportedAp(
  deviceRepo: IDeviceRepository,
  macMatch: DeviceId | null,
  remoteApIp: string | null
): Promise<Result<DeviceId | null>> {
  if (macMatch) return Result.ok(macMatch);
  if (!remoteApIp) return Result.ok(null);
  return deviceRepo.findIdByIpAddress(remoteApIp);
}
