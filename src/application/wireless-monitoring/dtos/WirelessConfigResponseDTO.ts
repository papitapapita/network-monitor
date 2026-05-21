/**
 * Response DTO for a WirelessPollingConfig entity.
 *
 * Returned By:
 * - CreateWirelessConfigUseCase
 * - GetWirelessConfigUseCase
 * - UpdateWirelessConfigUseCase
 *
 * API Endpoints:
 * - POST   /api/wireless/configs
 * - GET    /api/wireless/configs/:deviceId
 * - PATCH  /api/wireless/configs/:deviceId
 *
 * @example
 * ```json
 * {
 *   "id": "01J...",
 *   "deviceId": "01J...",
 *   "ipAddress": "192.168.1.10",
 *   "enabled": true,
 *   "intervalSecs": 3600,
 *   "deviceType": "CPE",
 *   "linkCapacityBps": 50000000,
 *   "clientsProvisionedLimit": 10,
 *   "lastPolledAt": "2026-05-15T10:00:00.000Z"
 * }
 * ```
 */
export interface WirelessConfigResponseDTO {
  /** Unique identifier of the polling config record */
  id: string;

  /** ID of the device this config belongs to */
  deviceId: string;

  /** IP address used for polling — null if not configured */
  ipAddress: string | null;

  /** Whether polling is currently active */
  enabled: boolean;

  /** Polling interval in seconds */
  intervalSecs: number;

  /** Device type that determines polling strategy */
  deviceType: 'STATION' | 'ACCESS_POINT';

  /** Maximum link capacity in bits per second — null if unknown */
  linkCapacityBps: number | null;

  /** Maximum number of provisioned clients — null if not tracked */
  clientsProvisionedLimit: number | null;

  /** ISO 8601 timestamp of the last successful poll — null if never polled */
  lastPolledAt: string | null;
}
