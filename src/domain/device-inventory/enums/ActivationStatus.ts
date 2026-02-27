/**
 * Represents the activation state of a NetworkDevice in the system.
 *
 * Devices follow a lifecycle from DRAFT (minimal information) to ACTIVE (fully operational).
 * This enables a discovery + enrichment workflow where devices can be quickly captured
 * during network scans and then completed with full details before activation.
 *
 * @see REQ-002 Network Device CRUD Operations
 */
export enum ActivationStatus {
  /**
   * Device exists with minimum required fields (IP + MAC address only).
   * - Excluded from default device listings
   * - Excluded from active monitoring and polling
   * - Used during discovery and enrichment phase
   * - Cannot be polled until activated
   */
  DRAFT = 'DRAFT',

  /**
   * Device has all required fields and has been explicitly activated.
   * - Included in operational queries and monitoring
   * - Available for polling (if polling enabled)
   * - Fully functional in the system
   */
  ACTIVE = 'ACTIVE',
}
