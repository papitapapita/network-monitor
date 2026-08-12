export interface WirelessThroughputDTO {
  deviceId: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  collectedAt: string;
  // age of the reading, not of the request — snapshots only refresh per poll
  ageSeconds: number;
  stale: boolean;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  throughputTotalBps: number | null;
  linkCapacityKbps: number | null;
  // null whenever no capacity is configured, which is always true for an AP
  utilisationPercent: number | null;
}

export interface FleetWirelessThroughputResponseDTO {
  devices: WirelessThroughputDTO[];
  total: number;
}
