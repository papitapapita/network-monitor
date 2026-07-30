// PATCH semantics: omitted fields are left unchanged; null clears the field.
export interface UpdateDeviceRequestDTO {
  id: string;
  name?: string;
  // Corrects a mis-registered model. Accepted only while the device is
  // INVENTORY — this is not a hardware-replacement path.
  deviceModelId?: string;
  status?: string;
  // null clears the category. When set, device must have an IP address.
  category?: string | null;
  ownerType?: string;
  // null unassigns the device from its current location.
  locationId?: string | null;
  serialNumber?: string | null;
  macAddress?: string | null;
  ipAddress?: string | null;
  description?: string | null;
  installedDate?: string | null;
  monitoringEnabled?: boolean;
}
