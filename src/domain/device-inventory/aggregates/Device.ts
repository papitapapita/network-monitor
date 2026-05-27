import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import {
  DeviceId,
  DeviceModelId,
  LocationId
} from 'domain/shared/ids';
import { IPAddress, MACAddress } from 'domain/shared/value-objects';
import {
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

export class Device extends AggregateRoot<DeviceProps, DeviceId> {
  private constructor(props: DeviceProps, id: DeviceId) {
    super(props, id);
  }

  get deviceModelId(): DeviceModelId {
    return this.props.deviceModelId;
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

    // INVENTORY and DAMAGED devices must be identifiable by serial or MAC
    if (
      Device.requiresIdentifier(props.status) &&
      !props.serialNumber &&
      !props.macAddress
    ) {
      return Result.fail<Device>(
        `A device with status ${props.status.toString()} must have at least a serial number or MAC address`
      );
    }

    // ACTIVE devices must have an IP address
    if (props.status.isActive() && !props.ipAddress) {
      return Result.fail<Device>(
        'Cannot create an ACTIVE device without an IP address'
      );
    }

    // A categorised device must have an IP address
    if (props.category && !props.ipAddress) {
      return Result.fail<Device>(
        'A device with a category must have an IP address assigned'
      );
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

  // bypasses validation — for repository use only
  public static reconstitute(
    id: DeviceId,
    props: DeviceProps
  ): Device {
    return new Device(props, id);
  }

  // only WIRELESS_CPE and AP use the AirOS protocol; other categories do not
  public canHaveWirelessConfig(): boolean {
    if (this.props.category === null) return false;
    return (
      this.props.category.isWirelessCpe() ||
      this.props.category.isAp()
    );
  }

  // decommissioned is a terminal state
  public changeStatus(newStatus: DeviceStatus): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newStatus,
      'status'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (newStatus.isActive() && this.props.ipAddress === null) {
      return Result.fail<void>(
        'Cannot activate a device without an IP address assigned'
      );
    }

    if (
      Device.requiresIdentifier(newStatus) &&
      !this.props.serialNumber &&
      !this.props.macAddress
    ) {
      return Result.fail<void>(
        `Cannot transition to ${newStatus.toString()} without a serial number or MAC address`
      );
    }

    if (this.props.status.equals(newStatus)) {
      return Result.ok<void>();
    }

    const previousStatus = this.props.status;
    this.props.status = newStatus;
    this.touch();

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
    this.touch();

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

  public enableMonitoring(): Result<void> {
    if (this.props.monitoringEnabled) {
      return Result.ok<void>();
    }

    if (this.props.ipAddress === null) {
      return Result.fail<void>(
        'Cannot enable monitoring for a device without an IP address assigned'
      );
    }

    return this.setMonitoring(true);
  }

  public disableMonitoring(): Result<void> {
    if (!this.props.monitoringEnabled) {
      return Result.ok<void>();
    }

    return this.setMonitoring(false);
  }

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

    this.touch();

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

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private setMonitoring(enabled: boolean): Result<void> {
    this.props.monitoringEnabled = enabled;
    this.touch();

    this.addDomainEvent(
      new DeviceMonitoringToggledEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        monitoringEnabled: enabled,
        ipAddress: this.props.ipAddress as IPAddress,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  private static requiresIdentifier(status: DeviceStatus): boolean {
    return status.isInInventory() || status.isDamaged();
  }
}
