/**
 * DTO for querying/listing network devices.
 *
 * Supports pagination and filtering.
 */
export interface ListNetworkDevicesQueryDTO {
  /** Maximum number of results (default: 20, max: 100) */
  limit?: number;

  /** Offset for pagination (default: 0) */
  offset?: number;

  /** Filter by device status (ONLINE, OFFLINE, MAINTENANCE) */
  status?: string;

  /** Filter by device type */
  deviceType?: string;
}
