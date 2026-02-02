/**
 * CSV row representing a network device.
 * Matches CSV column headers.
 */
export interface CSVDeviceRow {
  ipAddress: string;
  macAddress: string;
  name?: string;
  deviceType?: string;
  description?: string;
  connectivityType?: string;
  managementProtocol?: string;
  managementPort?: string; // Parsed to number
  enabledRemoteAccess?: string; // Parsed to boolean
  deviceId?: string;
}
