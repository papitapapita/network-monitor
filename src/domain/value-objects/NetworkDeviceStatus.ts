/**
 * NetworkDeviceStatus Enum
 *
 * Represents the operational status of a network device.
 * Status transitions are managed by the NetworkDevice aggregate.
 *
 * @example
 * const status = NetworkDeviceStatus.ONLINE;
 */

export enum NetworkDeviceStatus {
  /**
   * Device is online and responding to polls
   */
  ONLINE = 'ONLINE',

  /**
   * Device is offline (failed consecutive polls)
   */
  OFFLINE = 'OFFLINE',

  /**
   * Device is in maintenance mode (polling disabled)
   */
  MAINTENANCE = 'MAINTENANCE',

  /**
   * Device status is unknown (newly added, not yet polled)
   */
  UNKNOWN = 'UNKNOWN'
}

/**
 * Validates if a string is a valid NetworkDeviceStatus.
 *
 * @param value - String value to validate
 * @returns True if valid, false otherwise
 */
export function isValidNetworkDeviceStatus(value: string): boolean {
  return Object.values(NetworkDeviceStatus).includes(
    value as NetworkDeviceStatus
  );
}

/**
 * Gets a user-friendly display name for a device status.
 *
 * @param status - The device status enum value
 * @returns Human-readable name
 */
export function getDeviceStatusDisplayName(
  status: NetworkDeviceStatus
): string {
  switch (status) {
    case NetworkDeviceStatus.ONLINE:
      return 'Online';
    case NetworkDeviceStatus.OFFLINE:
      return 'Offline';
    case NetworkDeviceStatus.MAINTENANCE:
      return 'Maintenance';
    case NetworkDeviceStatus.UNKNOWN:
    default:
      return 'Unknown';
  }
}

/**
 * Gets a color code for UI representation of device status.
 *
 * @param status - The device status enum value
 * @returns Color code (for CSS or UI frameworks)
 */
export function getDeviceStatusColor(status: NetworkDeviceStatus): string {
  switch (status) {
    case NetworkDeviceStatus.ONLINE:
      return 'green';
    case NetworkDeviceStatus.OFFLINE:
      return 'red';
    case NetworkDeviceStatus.MAINTENANCE:
      return 'yellow';
    case NetworkDeviceStatus.UNKNOWN:
    default:
      return 'gray';
  }
}

/**
 * Checks if a status transition is valid.
 *
 * @param from - Current status
 * @param to - Target status
 * @returns True if transition is allowed
 */
export function isValidStatusTransition(
  from: NetworkDeviceStatus,
  to: NetworkDeviceStatus
): boolean {
  // UNKNOWN can transition to any status
  if (from === NetworkDeviceStatus.UNKNOWN) {
    return true;
  }

  // MAINTENANCE can transition to any status (when exiting maintenance)
  if (from === NetworkDeviceStatus.MAINTENANCE) {
    return true;
  }

  // Any status can transition to MAINTENANCE
  if (to === NetworkDeviceStatus.MAINTENANCE) {
    return true;
  }

  // ONLINE <-> OFFLINE transitions are allowed
  if (
    (from === NetworkDeviceStatus.ONLINE &&
      to === NetworkDeviceStatus.OFFLINE) ||
    (from === NetworkDeviceStatus.OFFLINE && to === NetworkDeviceStatus.ONLINE)
  ) {
    return true;
  }

  // All other transitions are not allowed
  return false;
}
