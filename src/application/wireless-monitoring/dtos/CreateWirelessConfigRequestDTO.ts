export interface CreateWirelessConfigRequestDTO {
  deviceId: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  ipAddress?: string | null;
  intervalSecs?: number;
  enabled?: boolean;
  linkCapacityBps?: number | null;
  clientsProvisionedLimit?: number | null;
}
