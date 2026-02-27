import { IPAddress, MACAddress, NetworkDeviceId } from '..';

/**
 * Props for NetworkDeviceActivatedEvent
 *
 * Published when a device transitions from DRAFT to ACTIVE state.
 * This indicates the device has been fully configured and is ready for operational use.
 *
 * @see REQ-002 Acceptance Criteria AC-002.2
 */
export interface NetworkDeviceActivatedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: IPAddress;
  readonly macAddress: MACAddress;
  readonly activatedBy: string; // User ID who performed the activation
  readonly dateTimeOccurred: Date;
}
