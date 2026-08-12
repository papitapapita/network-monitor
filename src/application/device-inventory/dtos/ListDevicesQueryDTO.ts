export interface ListDevicesQueryDTO {
  limit?: number;
  offset?: number;
  status?: string;
  category?: string;
  owner?: string;
  locationId?: string;
  deviceModelId?: string;
  monitoringEnabled?: boolean;
  // 'only' is the recycle-bin view. Absent means live devices only.
  deleted?: 'exclude' | 'only' | 'any';
  search?: string;
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'name'
    | 'status'
    | 'deletedAt';
  sortOrder?: 'ASC' | 'DESC';
}
