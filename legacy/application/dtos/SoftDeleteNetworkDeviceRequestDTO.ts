/**
 * Request DTO for soft-deleting a network device.
 *
 * Used By:
 * - SoftDeleteNetworkDeviceUseCase
 *
 * API Endpoint:
 * - DELETE /api/devices/:id (with soft delete)
 *
 * Business Context:
 * - REQ-002: Soft Delete with 7-Day Grace Period
 * - Marks device as deleted without physical removal
 * - Sets deletedAt timestamp and deletedBy user
 * - Device enters 7-day grace period for restoration
 * - Can be restored using RestoreNetworkDeviceUseCase
 * - After 7 days, permanent deletion occurs automatically
 * - IP and MAC become available for reuse immediately
 * - Dispatches NetworkDeviceDeletedEvent
 *
 * Validation Rules:
 * - id: Required, valid UUID format
 * - reason: Optional but recommended, max 500 characters
 *
 * Business Rules (enforced by Use Case):
 * - Device must exist in the system
 * - Device must NOT already be soft-deleted
 * - Device can be in any activationStatus (DRAFT or ACTIVE)
 * - deletedBy provided from authentication context (not in DTO)
 *
 * When to Use:
 * - Temporary removal of device (recoverable)
 * - Device replacement/upgrade scenarios
 * - Network restructuring
 * - Decommissioning with audit trail
 *
 * @example Soft delete with reason
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "reason": "Device replaced with newer model"
 * }
 * ```
 *
 * @example Soft delete without reason
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 */
export interface SoftDeleteNetworkDeviceRequestDTO {
  /**
   * Network device unique identifier
   * Required, valid UUID format
   * Device must exist and not already be soft-deleted
   */
  id: string;

  /**
   * Reason for deletion (optional but recommended)
   * Max 500 characters
   * Used for audit trail and historical tracking
   *
   * Examples:
   * - "Device replaced with newer model"
   * - "Hardware failure, decommissioned"
   * - "Network restructuring"
   * - "Moved to different location"
   * - "Temporary removal for maintenance"
   *
   * Best Practices:
   * - Always provide a reason for better audit trail
   * - Be specific about the deletion cause
   * - Include ticket/incident numbers if applicable
   */
  reason?: string;
}
