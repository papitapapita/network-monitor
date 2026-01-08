import { IPAddress, MACAddress, NetworkDeviceId } from '../../';

/**
 * Props for DeviceReplacedEvent
 *
 * Published when a device is identified as a replacement for a recently deleted device.
 * This event captures the relationship between old and new devices, enabling
 * configuration migration and historical data linkage.
 *
 * @see REQ-002 Acceptance Criteria AC-002.9
 * @see REQ-002 Functional Requirement FR-002.8 (Device Replacement Workflow)
 */
export interface DeviceReplacedEventProps {
  readonly oldDeviceId: NetworkDeviceId; // The deleted device being replaced
  readonly newDeviceId: NetworkDeviceId; // The new replacement device
  readonly ipAddress: IPAddress; // Shared IP address (same for both)
  readonly oldMacAddress: MACAddress; // MAC address of the old device
  readonly newMacAddress: MACAddress; // MAC address of the new device
  readonly configMigrated: boolean; // Whether polling/management config was migrated
  readonly metadataMigrated: boolean; // Whether name/description/location was migrated
  readonly replacedBy: string; // User ID who confirmed the replacement
  readonly dateTimeOccurred: Date;
}
