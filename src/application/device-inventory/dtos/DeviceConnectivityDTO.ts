export type ConnectivityStatus = 'UP' | 'DOWN' | 'UNKNOWN';

export interface DeviceConnectivityDTO {
  status: ConnectivityStatus;
  downSince: string | null;
  lastSeen: string | null;
}
