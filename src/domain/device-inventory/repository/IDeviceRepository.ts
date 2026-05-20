import { Result } from 'domain/shared/core';
import { IPAddress } from 'domain/shared';
import {
  DeviceId,
  LocationId,
  DeviceModelId
} from '../../shared/ids';
import {
  MACAddress,
  DeviceStatus,
  DeviceCategory
} from '../value-objects';
import { DeviceOwnerType } from '../enums';
import { Device } from '../aggregates/Device';

export interface IDeviceRepository {
  save(device: Device): Promise<Result<Device>>; // dispatches domain events on success
  findById(id: DeviceId): Promise<Result<Device | null>>;
  delete(id: DeviceId): Promise<Result<void>>;
  exists(id: DeviceId): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;

  findAll(limit?: number, offset?: number): Promise<Result<Device[]>>;
  findByLocation(locationId: LocationId): Promise<Result<Device[]>>;
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

  findByFilters(filters: {
    status?: DeviceStatus;
    category?: DeviceCategory;
    owner?: DeviceOwnerType;
    locationId?: LocationId;
    deviceModelId?: DeviceModelId;
    monitoringEnabled?: boolean;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
    sortOrder?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }): Promise<Result<Device[]>>;
}
