import { Result } from 'domain/shared/core';
import { IDiscoveredDeviceRepository } from 'domain/device-inventory/repository';

export const DISCOVERED_DEVICE_STALE_DAYS = 30;

// DEV-205: a host gone from the network for a month was a visitor, not a
// device to add. An ignored one stays, or it would come back as new.
export class PurgeStaleDiscoveredDevicesUseCase {
  constructor(
    private readonly repository: IDiscoveredDeviceRepository
  ) {}

  async execute(
    staleDays: number = DISCOVERED_DEVICE_STALE_DAYS
  ): Promise<Result<number>> {
    const cutoff = new Date(Date.now() - staleDays * 86_400_000);
    return this.repository.deletePendingLastSeenBefore(cutoff);
  }
}
