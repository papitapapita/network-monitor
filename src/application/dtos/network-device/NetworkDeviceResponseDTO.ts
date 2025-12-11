/**
 * DTO for network device response.
 *
 * Complete device information returned from queries.
 */
export interface NetworkDeviceResponseDTO {
  /** Device UUID */
  id: string;

  /** Device name */
  name: string;

  /** Device type */
  deviceType: string;

  /** Current device status (ONLINE, OFFLINE, MAINTENANCE) */
  status: string;

  /** IP address */
  ipAddress: string;

  /** MAC address */
  macAddress: string;

  /** Description (may be null) */
  description: string | null;

  /** Installation date */
  installDate: Date;

  /** Connectivity type */
  connectivityType: string;

  /** Management protocol */
  managementProtocol: string;

  /** Management port */
  managementPort: number;

  /** Remote access enabled */
  enabledRemoteAccess: boolean;

  /** Device reference ID */
  deviceId: string;

  /** Polling configuration details */
  pollingConfiguration: {
    id: string;
    enabled: boolean;
    intervalSeconds: number;
    pingCount: number;
    maxRetryAttempts: number;
    retryDelayMs: number;
    lastScheduledAt: Date | null;
    nextScheduledAt: Date | null;
  };

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}
