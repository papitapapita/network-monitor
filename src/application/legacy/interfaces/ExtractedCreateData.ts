export interface ExtractedCreateData {
  ipAddress: string;
  macAddress: string;
  deviceId: string;
  name: string | null;
  deviceType: string | null;
  description: string | null;
  connectivityType: string | null;
  managementProtocol: string | null;
  managementPort: number | null;
  enabledRemoteAccess: boolean | null;
  performPingTest: boolean | null;
  activateImmediately: boolean;
  installDate: string | null;
}
