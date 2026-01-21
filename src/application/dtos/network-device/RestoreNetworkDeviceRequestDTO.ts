/**
 * Request DTO for restoring a soft-deleted network device.
 *
 * Used By:
 * - RestoreNetworkDeviceUseCase
 *
 * API Endpoint:
 * - POST /api/devices/:id/restore
 *
 * Business Context:
 * - REQ-002: Restore from Soft Delete
 * - Restores device from soft-deleted state within 7-day grace period
 * - Clears deletedAt and deletedBy fields
 * - Device returns to previous activationStatus (DRAFT or ACTIVE)
 * - Dispatches NetworkDeviceRestoredEvent
 * - Checks for IP/MAC conflicts before restoration
 *
 * Validation Rules:
 * - id: Required, valid UUID format
 *
 * Business Rules (enforced by Use Case):
 * - Device must exist in the system
 * - Device MUST be soft-deleted (deletedAt not null)
 * - Device must be within 7-day grace period
 * - IP address must still be unique (no conflicts with active devices)
 * - MAC address must still be unique (no conflicts with active devices)
 * - If conflicts exist, restoration fails with specific error message
 *
 * Conflict Resolution:
 * - If IP/MAC now in use by another active device, restoration is blocked
 * - User must either:
 *   1. Delete/soft-delete the conflicting device first, then retry
 *   2. Let this device expire (after 7 days) and create new one
 *   3. Contact admin to resolve the conflict manually
 *
 * When to Use:
 * - Accidental soft-delete (undo operation)
 * - Changed decision about device removal
 * - Device temporarily removed but now needed again
 * - Recovery from incorrect deletion
 *
 * @example Restore soft-deleted device
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 */
export interface RestoreNetworkDeviceRequestDTO {
  /**
   * Network device unique identifier
   * Required, valid UUID format
   * Device must exist, be soft-deleted, and within 7-day grace period
   */
  id: string;
}