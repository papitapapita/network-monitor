import { Result } from 'domain/shared/core';
import { DiscoveredDeviceId } from 'domain/shared/ids';
import { DiscoveredDevice } from '../aggregates';

export interface IDiscoveredDeviceRepository {
  findById(
    id: DiscoveredDeviceId
  ): Promise<Result<DiscoveredDevice | null>>;
  findByMacs(
    macAddresses: string[]
  ): Promise<Result<DiscoveredDevice[]>>;
  // Upserts on the MAC, so two scans racing on one new host keep one row.
  saveMany(devices: DiscoveredDevice[]): Promise<Result<void>>;
  save(device: DiscoveredDevice): Promise<Result<void>>;
  deleteByMacs(macAddresses: string[]): Promise<Result<number>>;
  // DEV-205: only suggestions still waiting; an ignored one stays.
  deletePendingLastSeenBefore(cutoff: Date): Promise<Result<number>>;
}
