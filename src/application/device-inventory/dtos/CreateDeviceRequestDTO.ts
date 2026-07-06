export interface CreateDeviceRequestDTO {
  deviceModelId: string;
  name: string;
  ownerType?: string;
  status?: string;
  // Only WIRELESS_CPE and AP can have wireless polling configs.
  // When set, the device must have an IP address.
  category?: string | null;
  locationId?: string | null;
  serialNumber?: string | null;
  macAddress?: string | null;
  ipAddress?: string | null;
  description?: string | null;
  installedDate?: string | null;
  monitoringEnabled?: boolean;
}
