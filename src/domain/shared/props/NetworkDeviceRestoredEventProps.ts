import { IPAddress, NetworkDeviceId } from '../../';

/**
 * Props for NetworkDeviceRestoredEvent
 *
 * Published when a soft-deleted device is restored within the 7-day grace period.
 * This event captures both the restoration action and the original deletion context.
 *
 * @see REQ-002 Acceptance Criteria AC-002.7
 */
export interface NetworkDeviceRestoredEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: IPAddress;
  readonly restoredBy: string; // User ID who performed the restoration
  readonly deletedAt: Date; // Original deletion timestamp (for audit trail)
  readonly dateTimeOccurred: Date;
}
