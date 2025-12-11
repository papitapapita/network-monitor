import { IDomainEvent, NetworkDeviceId } from '../';

/**
 * NetworkDeviceDeletedEvent
 *
 * Emitted when a network device is permanently deleted from the system.
 *
 * This is a critical event for:
 * - Audit trail (compliance, security)
 * - External system synchronization (CMDB, inventory)
 * - Cleanup operations (remove from monitoring dashboards, alerting systems)
 * - Analytics (track device lifecycle)
 *
 * Note: This event should be emitted BEFORE deletion to capture device context.
 * After deletion, the device data is permanently lost (CASCADE removes polling data).
 *
 * @example
 * // In DeleteNetworkDeviceUseCase, before calling repository.delete():
 * device.markForDeletion();
 * await repository.save(device); // Emits event
 * await repository.delete(device.id); // Physical deletion
 */
export class NetworkDeviceDeletedEvent implements IDomainEvent {
  public readonly dateTimeOccurred: Date;

  constructor(
    public readonly aggregateId: NetworkDeviceId,
    public readonly deviceName: string,
    public readonly ipAddress: string,
    public readonly macAddress: string,
    //public readonly deviceType: string,
    public readonly deletedBy?: string // Optional: who requested deletion
  ) {
    this.dateTimeOccurred = new Date();
  }

  public getAggregateId(): NetworkDeviceId {
    return this.aggregateId;
  }
}
