import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { DeviceId, LocationId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared';
import {
  MACAddress,
  DeviceName,
  SerialNumber,
  DeviceStatus,
  DeviceCategory
} from '../value-objects';
import { DeviceOwnerType } from '../enums';
import { DeviceProps } from '../props';
import {
  DeviceCreatedEvent,
  DeviceStatusChangedEvent,
  DeviceLocationAssignedEvent,
  DeviceMonitoringToggledEvent,
  DeviceDetailsUpdatedEvent
} from '../events';

/**
 * Device Aggregate Root
 *
 * Represents a physical network device asset (router, switch, access point, CPE, etc.)
 * managed in the inventory system. This is distinct from the NetworkDevice aggregate,
 * which models the monitoring/operational view of a device.
 *
 * Responsibilities:
 * - Enforce business invariants for physical device assets
 * - Manage operational status lifecycle (INVENTORY → ACTIVE → MAINTENANCE, etc.)
 * - Track physical identity (serial number, MAC address, IP address)
 * - Control location assignment
 * - Gate monitoring enable/disable transitions
 * - Emit domain events for significant state changes
 */
export class Device extends AggregateRoot<DeviceProps, DeviceId> {
  private constructor(props: DeviceProps, id: DeviceId) {
    super(props, id);
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get deviceModelId(): DeviceId {
    return this.props.deviceModelId as unknown as DeviceId;
  }

  get locationId(): LocationId | null {
    return this.props.locationId;
  }

  get status(): DeviceStatus {
    return this.props.status;
  }

  get category(): DeviceCategory | null {
    return this.props.category;
  }

  get ownerType(): DeviceOwnerType | null {
    return this.props.ownerType;
  }

  get name(): DeviceName {
    return this.props.name;
  }

  get serialNumber(): SerialNumber | null {
    return this.props.serialNumber;
  }

  get macAddress(): MACAddress | null {
    return this.props.macAddress;
  }

  get ipAddress(): IPAddress | null {
    return this.props.ipAddress;
  }

  get description(): string | null {
    return this.props.description;
  }

  get installedDate(): Date | null {
    return this.props.installedDate;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get monitoringEnabled(): boolean {
    return this.props.monitoringEnabled;
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  /**
   * Creates a new Device aggregate, assigning a new DeviceId and emitting
   * a DeviceCreatedEvent.
   *
   * @param props - Device properties (without createdAt / updatedAt — set internally)
   * @returns Result containing the new Device or a validation error message
   */
  public static create(
    props: Omit<DeviceProps, 'createdAt' | 'updatedAt'>
  ): Result<Device> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        props.deviceModelId,
        'deviceModelId'
      ),
      Guard.againstNullOrUndefined(props.name, 'name'),
      Guard.againstNullOrUndefined(props.status, 'status')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<Device>(guardResult.message!);
    }

    const id = DeviceId.create();
    const now = new Date();

    const device = new Device(
      {
        ...props,
        locationId: props.locationId ?? null,
        ownerType: props.ownerType ?? null,
        category: props.category ?? null,
        serialNumber: props.serialNumber ?? null,
        macAddress: props.macAddress ?? null,
        ipAddress: props.ipAddress ?? null,
        description: props.description ?? null,
        installedDate: props.installedDate ?? null,
        createdAt: now,
        updatedAt: now
      },
      id
    );

    device.addDomainEvent(
      new DeviceCreatedEvent({
        aggregateId: device.id,
        deviceName: device.name,
        status: device.status,
        ownerType: device.ownerType,
        monitoringEnabled: device.monitoringEnabled,
        ipAddress: device.ipAddress ?? null,
        dateTimeOccurred: now
      })
    );

    return Result.ok<Device>(device);
  }

  /**
   * Reconstitutes a Device aggregate from a trusted persistence source,
   * bypassing validation. Use only in repository implementations when
   * loading data that was already validated at creation time.
   *
   * @param id - The persisted DeviceId
   * @param props - Full device properties from persistence
   * @returns Device instance
   */
  public static reconstitute(
    id: DeviceId,
    props: DeviceProps
  ): Device {
    return new Device(props, id);
  }

  // ============================================================================
  // Command Methods
  // ============================================================================

  /**
   * Changes the operational status of the device.
   * A decommissioned device cannot transition to any other status —
   * decommissioning is a terminal state.
   *
   * @param newStatus - The target DeviceStatus value object
   * @returns Result indicating success or failure
   */
  public changeStatus(newStatus: DeviceStatus): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newStatus,
      'status'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (this.props.status.isDecommissioned()) {
      return Result.fail<void>(
        'A decommissioned device cannot change status'
      );
    }

    if (newStatus.isActive() && this.props.ipAddress === null) {
      return Result.fail<void>(
        'Cannot activate a device without an IP address assigned'
      );
    }

    if (this.props.status.equals(newStatus)) {
      return Result.ok<void>();
    }

    const previousStatus = this.props.status;
    this.props.status = newStatus;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new DeviceStatusChangedEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        previousStatus,
        newStatus,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  /**
   * Assigns the device to a location or removes its current location.
   * Passing null clears the location assignment.
   *
   * @param locationId - The LocationId to assign, or null to unassign
   * @returns Result indicating success or failure
   */
  public assignLocation(locationId: LocationId | null): Result<void> {
    const previousLocationId = this.props.locationId;

    const isSameLocation =
      (previousLocationId === null && locationId === null) ||
      (previousLocationId !== null &&
        locationId !== null &&
        previousLocationId.equals(locationId));

    if (isSameLocation) {
      return Result.ok<void>();
    }

    this.props.locationId = locationId;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new DeviceLocationAssignedEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        previousLocationId,
        newLocationId: locationId,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  /**
   * Enables monitoring for this device.
   * No-op if monitoring is already enabled.
   *
   * @returns Result indicating success or failure
   */
  public enableMonitoring(): Result<void> {
    if (this.props.monitoringEnabled) {
      return Result.ok<void>();
    }

    if (this.props.ipAddress === null) {
      return Result.fail<void>(
        'Cannot enable monitoring for a device without an IP address assigned'
      );
    }
    this.props.monitoringEnabled = true;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new DeviceMonitoringToggledEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        monitoringEnabled: true,
        ipAddress: this.props.ipAddress as IPAddress,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  /**
   * Disables monitoring for this device.
   * No-op if monitoring is already disabled.
   *
   * @returns Result indicating success or failure
   */
  public disableMonitoring(): Result<void> {
    if (!this.props.monitoringEnabled) {
      return Result.ok<void>();
    }

    this.props.monitoringEnabled = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new DeviceMonitoringToggledEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        monitoringEnabled: false,
        ipAddress: this.props.ipAddress as IPAddress,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  /**
   * Updates the device's mutable details: name, description, category,
   * serial number, MAC address, IP address, and installed date.
   * Only fields that are explicitly provided (non-undefined) are changed.
   *
   * @param fields - Partial set of updatable fields
   * @returns Result indicating success or failure
   */
  public updateDetails(fields: {
    name?: string;
    description?: string | null;
    category?: DeviceCategory | null;
    serialNumber?: string | null;
    macAddress?: MACAddress | null;
    ipAddress?: IPAddress | null;
    installedDate?: Date | null;
    ownerType?: DeviceOwnerType;
  }): Result<void> {
    if (fields.name !== undefined) {
      const nameResult = DeviceName.create(fields.name);
      if (nameResult.isFailure) {
        return Result.fail(nameResult.error);
      }
      this.props.name = nameResult.value;
    }

    if (fields.description !== undefined) {
      if (
        fields.description !== null &&
        fields.description.length > 0
      ) {
        const guardResult = Guard.isString(
          fields.description,
          'description'
        );
        if (!guardResult.succeeded) {
          return Result.fail<void>(guardResult.message!);
        }
      }
      this.props.description = fields.description;
    }

    if (fields.category !== undefined) {
      this.props.category = fields.category;
    }

    if (
      fields.serialNumber !== undefined &&
      fields.serialNumber !== null
    ) {
      const serialNumberResult = SerialNumber.create(
        fields.serialNumber
      );
      if (serialNumberResult.isFailure) {
        return Result.fail(serialNumberResult.error);
      }
      this.props.serialNumber = serialNumberResult.value;
    } else if (fields.serialNumber === null) {
      this.props.serialNumber = null;
    }

    if (fields.macAddress !== undefined) {
      this.props.macAddress = fields.macAddress;
    }

    if (fields.ipAddress !== undefined) {
      this.props.ipAddress = fields.ipAddress;
    }

    if (fields.installedDate !== undefined) {
      if (fields.installedDate !== null) {
        const guardResult = Guard.isDate(
          fields.installedDate,
          'installedDate'
        );
        if (!guardResult.succeeded) {
          return Result.fail<void>(guardResult.message!);
        }
      }
      this.props.installedDate = fields.installedDate;
    }

    if (fields.ownerType !== undefined) {
      const guardResult = Guard.againstNullOrUndefined(
        fields.ownerType,
        'ownerType'
      );
      if (!guardResult.succeeded) {
        return Result.fail<void>(guardResult.message!);
      }
      this.props.ownerType = fields.ownerType;
    }

    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new DeviceDetailsUpdatedEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        updatedFields: {
          name:
            fields.name !== undefined ? this.props.name : undefined,
          description: fields.description,
          category: fields.category,
          serialNumber: fields.serialNumber,
          macAddress: fields.macAddress,
          ipAddress: fields.ipAddress,
          installedDate: fields.installedDate,
          ownerType: fields.ownerType
        },
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  public isDecommissioned(): boolean {
    return this.props.status.isDecommissioned();
  }

  public isInMaintenance(): boolean {
    return this.props.status.isInMaintenance();
  }

  public isActive(): boolean {
    return this.props.status.isActive();
  }

  public isInInventory(): boolean {
    return this.props.status.isInInventory();
  }

  public hasLocation(): boolean {
    return this.props.locationId !== null;
  }

  public isMonitored(): boolean {
    return this.props.monitoringEnabled;
  }
}
