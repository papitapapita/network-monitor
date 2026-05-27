export interface ListDevicesQueryDTO {
  limit?: number;
  offset?: number;
  status?: string;
  category?: string;
  owner?: string;
  locationId?: string;
  deviceModelId?: string;
  monitoringEnabled?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}
