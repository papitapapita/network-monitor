export interface WirelessConfigResponseDTO {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  intervalSecs: number;
  deviceType: 'STATION' | 'ACCESS_POINT';
  linkCapacityKbps: number | null;
  clientsProvisionedLimit: number | null;
  provisionedLanSpeedMbps: number | null;
  parentApDeviceId: string | null;
  lastPolledAt: string | null;
}
