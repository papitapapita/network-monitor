import { Result } from 'domain/shared/core';
import { IPAddress, MACAddress } from 'domain/shared';
import {
  DeviceId,
  LocationId,
  DeviceModelId
} from '../../shared/ids';
import { DeviceStatus, DeviceCategory } from '../value-objects';
import { DeviceOwnerType } from '../enums';
import { Device } from '../aggregates/Device';

// One knob with three honest states, rather than two booleans that could be
// set to a combination that means nothing.
export type DeletedFilter =
  | 'exclude' // live devices only — the default everywhere
  | 'only' // tombstones only — the recycle bin
  | 'any'; // both, for callers that genuinely want the whole table

export interface DeviceFilters {
  status?: DeviceStatus;
  category?: DeviceCategory;
  owner?: DeviceOwnerType;
  locationId?: LocationId;
  deviceModelId?: DeviceModelId;
  monitoringEnabled?: boolean;
  // Absent means 'exclude': a soft-deleted device stays out of every listing
  // until something explicitly asks for tombstones.
  deleted?: DeletedFilter;
  search?: string;
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'name'
    | 'status'
    | 'deletedAt'
    | 'ipAddress';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface IDeviceRepository {
  save(device: Device): Promise<Result<Device>>; // dispatches domain events on success

  // Every finder here excludes soft-deleted devices. The two that do not say
  // so in their names, and exist for the only two callers that need to see a
  // tombstone: restore and the grace-period purge.
  findById(id: DeviceId): Promise<Result<Device | null>>;
  findByIdIncludingDeleted(
    id: DeviceId
  ): Promise<Result<Device | null>>;
  findDeletedBefore(cutoff: Date): Promise<Result<Device[]>>;

  // Permanent removal, cascading to every metric the device produced. Soft
  // delete goes through save(), not here.
  delete(id: DeviceId): Promise<Result<void>>;
  exists(id: DeviceId): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;

  findAll(limit?: number, offset?: number): Promise<Result<Device[]>>;
  findByLocation(locationId: LocationId): Promise<Result<Device[]>>;
  findByLocationIds(ids: LocationId[]): Promise<Result<Device[]>>;
  findByDeviceModel(
    deviceModelId: DeviceModelId
  ): Promise<Result<Device[]>>;
  findByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<Device | null>>;
  findByIpAddress(
    ipAddress: IPAddress
  ): Promise<Result<Device | null>>;
  findByStatus(status: DeviceStatus): Promise<Result<Device[]>>;
  existsByMacAddress(
    macAddress: MACAddress
  ): Promise<Result<boolean>>;
  existsByIpAddress(ipAddress: IPAddress): Promise<Result<boolean>>;

  findByFilters(filters: DeviceFilters): Promise<Result<Device[]>>;
  countByFilters(filters: DeviceFilters): Promise<Result<number>>;
}
