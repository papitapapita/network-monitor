export interface CreateWirelessConfigRequestDTO {
  deviceId: string;
  ipAddress?: string | null;
  intervalSecs?: number;
  enabled?: boolean;
  linkCapacityKbps?: number | null;
  clientsProvisionedLimit?: number | null;
  provisionedLanSpeedMbps?: number | null;
  parentApDeviceId?: string | null;
}
