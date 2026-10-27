export interface UpdateWirelessConfigRequestDTO {
  deviceId: string;
  // undefined = skip, null = clear, string = set new value
  ipAddress?: string | null;
  intervalSecs?: number;
  enabled?: boolean;
  // null = clear, number = set, undefined = skip
  linkCapacityKbps?: number | null;
  clientsProvisionedLimit?: number | null;
  provisionedLanSpeedMbps?: number | null;
}
