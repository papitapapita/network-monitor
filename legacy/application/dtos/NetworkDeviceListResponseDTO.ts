import { NetworkDeviceResponseDTO } from './NetworkDeviceResponseDTO';

/**
 * DTO for list response with pagination metadata.
 */
export interface NetworkDeviceListResponseDTO {
  /** Array of network devices */
  devices: NetworkDeviceResponseDTO[];

  /** Total count of devices (respects filters) */
  total: number;

  /** Whether there are more results available */
  hasMore: boolean;

  /** Current limit */
  limit: number;

  /** Current offset */
  offset: number;
}
