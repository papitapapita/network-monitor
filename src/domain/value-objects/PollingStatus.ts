/**
 * PollingStatus Enum
 *
 * Represents the outcome status of a single polling operation.
 * This is distinct from NetworkDeviceStatus, which represents the overall device state.
 *
 * A poll can succeed, fail, timeout, or have partial success (relevant for multi-ping scenarios).
 *
 * @example
 * const status = PollingStatus.SUCCESS;
 */

export enum PollingStatus {
  /**
   * Poll completed successfully - all pings received responses
   */
  SUCCESS = 'SUCCESS',

  /**
   * Poll failed - device is unreachable (all pings failed)
   */
  FAILED = 'FAILED',

  /**
   * Poll timed out - no response within configured timeout period
   */
  TIMEOUT = 'TIMEOUT',

  /**
   * Partial success - some pings succeeded, some failed (multi-ping scenario)
   * This indicates potential network instability or packet loss
   */
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS'
}

/**
 * Validates if a string is a valid PollingStatus.
 *
 * @param value - String value to validate
 * @returns True if valid, false otherwise
 */
export function isValidPollingStatus(value: string): boolean {
  return Object.values(PollingStatus).includes(value as PollingStatus);
}

/**
 * Gets a user-friendly display name for a polling status.
 *
 * @param status - The polling status enum value
 * @returns Human-readable name
 */
export function getPollingStatusDisplayName(status: PollingStatus): string {
  switch (status) {
    case PollingStatus.SUCCESS:
      return 'Success';
    case PollingStatus.FAILED:
      return 'Failed';
    case PollingStatus.TIMEOUT:
      return 'Timeout';
    case PollingStatus.PARTIAL_SUCCESS:
      return 'Partial Success';
    default:
      return 'Unknown';
  }
}

/**
 * Gets a color code for UI representation of polling status.
 *
 * @param status - The polling status enum value
 * @returns Color code (for CSS or UI frameworks)
 */
export function getPollingStatusColor(status: PollingStatus): string {
  switch (status) {
    case PollingStatus.SUCCESS:
      return 'green';
    case PollingStatus.FAILED:
      return 'red';
    case PollingStatus.TIMEOUT:
      return 'orange';
    case PollingStatus.PARTIAL_SUCCESS:
      return 'yellow';
    default:
      return 'gray';
  }
}

/**
 * Determines if a polling status indicates the device is reachable.
 *
 * @param status - The polling status
 * @returns True if device responded (SUCCESS or PARTIAL_SUCCESS)
 */
export function isDeviceReachable(status: PollingStatus): boolean {
  return (
    status === PollingStatus.SUCCESS ||
    status === PollingStatus.PARTIAL_SUCCESS
  );
}

/**
 * Calculates polling status from multi-ping results.
 *
 * @param successfulPings - Number of successful pings
 * @param totalPings - Total number of pings attempted
 * @returns Appropriate PollingStatus
 */
export function calculatePollingStatus(
  successfulPings: number,
  totalPings: number
): PollingStatus {
  if (successfulPings === 0) {
    return PollingStatus.FAILED;
  }

  if (successfulPings === totalPings) {
    return PollingStatus.SUCCESS;
  }

  return PollingStatus.PARTIAL_SUCCESS;
}
