export interface WirelessConfigResponseDTO {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  intervalSecs: number;
  deviceType: 'STATION' | 'ACCESS_POINT';
  linkCapacityBps: number | null;
  clientsProvisionedLimit: number | null;
  lastPolledAt: string | null;
  targetFirmwareVersion: string | null;
  maxLinkDistanceM: number | null;
}
