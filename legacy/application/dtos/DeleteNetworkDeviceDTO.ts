/**
 * Request DTO for permanently deleting a network device.
 *
 * Used By:
 * - DeleteNetworkDeviceUseCase
 *
 * API Endpoint:
 * - DELETE /api/devices/:id (hard delete)
 *
 * Business Context:
 * - REQ-002: Permanent deletion after grace period
 * - IRREVERSIBLE operation - all data permanently lost
 * - CASCADE deletes PollingConfiguration and all PollingResult records
 * - IP and MAC addresses become immediately available for reuse
 * - Device deletion event dispatched before physical deletion
 * - Operation logged for audit trail
 *
 * Validation Rules:
 * - id: Required, valid UUID format
 *
 * Business Rules (enforced by Use Case):
 * - Device must exist in the system
 * - No soft delete check (can delete both DRAFT and ACTIVE devices)
 * - No grace period (immediate permanent deletion)
 * - All related data CASCADE deleted automatically
 *
 * When to Use:
 * - After 7-day soft delete grace period expires (automated cleanup)
 * - Administrative cleanup of old/test devices
 * - Forced removal when soft delete is not appropriate
 *
 * Warning:
 * - THIS OPERATION CANNOT BE UNDONE
 * - Use SoftDeleteNetworkDeviceRequestDTO for recoverable deletion
 *
 * @example
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 */
export interface DeleteNetworkDeviceDTO {
  /**
   * Network device unique identifier
   * Required, valid UUID format
   * Device must exist in the system
   */
  id: string;
}
