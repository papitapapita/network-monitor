export interface DeviceResponseDTO {
  id: string;
  deviceModelId: string;
  status: string;
  category: string | null;
  ownerType: string | null;
  locationId: string | null;
  name: string;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  description: string | null;
  installedDate: string | null;
  monitoringEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  replacedAt: string | null;
  replacesDeviceId: string | null;
  replacedByDeviceId: string | null;
}
