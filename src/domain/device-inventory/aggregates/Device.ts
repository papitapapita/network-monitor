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
    props: Omit<
      DeviceProps,
      'createdAt' | 'updatedAt' | 'monitoringEnabled'
    > & { monitoringEnabled?: boolean }
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

    // COMMISSIONING defaults monitoring on, but only when the caller
    // hasn't made an explicit choice — an explicit false is respected.
    const monitoringEnabled =
      props.monitoringEnabled ?? props.status.isCommissioning();

    const validationResult = Device.validate({
      status: props.status,
      serialNumber: props.serialNumber ?? null,
      macAddress: props.macAddress ?? null,
      ipAddress: props.ipAddress ?? null,
      locationId: props.locationId ?? null,
      monitoringEnabled,
      description: props.description ?? null,
      installedDate: props.installedDate ?? null
    });

    if (validationResult.isFailure) {
      return Result.fail<Device>(validationResult.error);
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
        monitoringEnabled,
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

  // decommissioned is a terminal state
  public changeStatus(newStatus: DeviceStatus): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newStatus,
      'status'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const validationResult = Device.validate({
      status: newStatus,
      serialNumber: this.props.serialNumber,
      macAddress: this.props.macAddress,
      ipAddress: this.props.ipAddress,
      locationId: this.props.locationId,
      monitoringEnabled: this.props.monitoringEnabled,
      description: this.props.description,
      installedDate: this.props.installedDate
    });

    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
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

    if (newStatus.isCommissioning() && !this.props.monitoringEnabled) {
      this.setMonitoring(true);
    }

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

    const validationResult = Device.validate({
      status: this.props.status,
      serialNumber: this.props.serialNumber,
      macAddress: this.props.macAddress,
      ipAddress: this.props.ipAddress,
      locationId,
      monitoringEnabled: this.props.monitoringEnabled,
      description: this.props.description,
      installedDate: this.props.installedDate
    });

    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
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

    const validationResult = Device.validate({
      status: this.props.status,
      serialNumber: this.props.serialNumber,
      macAddress: this.props.macAddress,
      ipAddress: this.props.ipAddress,
      locationId: this.props.locationId,
      monitoringEnabled: true,
      description: this.props.description,
      installedDate: this.props.installedDate
    });

    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    return this.setMonitoring(true);
  }

  public disableMonitoring(): Result<void> {
    if (!this.props.monitoringEnabled) {
      return Result.ok<void>();
    }

    return this.setMonitoring(false);
  }

  public canHaveWirelessConfig(): boolean {
    return (
      this.props.category?.isWirelessCpe() === true ||
      this.props.category?.isAp() === true
    );
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
    let nextName = this.props.name;
    if (fields.name !== undefined) {
      const nameResult = DeviceName.create(fields.name);
      if (nameResult.isFailure) {
        return Result.fail(nameResult.error);
      }
      nextName = nameResult.value;
    }

    let nextSerialNumber = this.props.serialNumber;
    if (fields.serialNumber !== undefined) {
      if (fields.serialNumber === null) {
        nextSerialNumber = null;
      } else {
        const serialNumberResult = SerialNumber.create(
          fields.serialNumber
        );
        if (serialNumberResult.isFailure) {
          return Result.fail(serialNumberResult.error);
        }
        nextSerialNumber = serialNumberResult.value;
      }
    }

    let nextOwnerType = this.props.ownerType;
    if (fields.ownerType !== undefined) {
      const guardResult = Guard.againstNullOrUndefined(
        fields.ownerType,
        'ownerType'
      );
      if (!guardResult.succeeded) {
        return Result.fail<void>(guardResult.message!);
      }
      nextOwnerType = fields.ownerType;
    }

    const nextDescription =
      fields.description !== undefined
        ? fields.description
        : this.props.description;
    const nextCategory =
      fields.category !== undefined
        ? fields.category
        : this.props.category;
    const nextMacAddress =
      fields.macAddress !== undefined
        ? fields.macAddress
        : this.props.macAddress;
    const nextIpAddress =
      fields.ipAddress !== undefined
        ? fields.ipAddress
        : this.props.ipAddress;
    const nextInstalledDate =
      fields.installedDate !== undefined
        ? fields.installedDate
        : this.props.installedDate;

    const validationResult = Device.validate({
      status: this.props.status,
      serialNumber: nextSerialNumber,
      macAddress: nextMacAddress,
      ipAddress: nextIpAddress,
      locationId: this.props.locationId,
      monitoringEnabled: this.props.monitoringEnabled,
      description: nextDescription,
      installedDate: nextInstalledDate
    });

    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props.name = nextName;
    this.props.description = nextDescription;
    this.props.category = nextCategory;
    this.props.serialNumber = nextSerialNumber;
    this.props.macAddress = nextMacAddress;
    this.props.ipAddress = nextIpAddress;
    this.props.installedDate = nextInstalledDate;
    this.props.ownerType = nextOwnerType;

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

  // Single source of truth for status-dependent invariants — every
  // mutator that can change status, identifiers, IP, location, or
  // monitoring must route its prospective (not-yet-committed) state
  // through this method.
  private static validate(state: {
    status: DeviceStatus;
    serialNumber: SerialNumber | null;
    macAddress: MACAddress | null;
    ipAddress: IPAddress | null;
    locationId: LocationId | null;
    monitoringEnabled: boolean;
    description: string | null;
    installedDate: Date | null;
  }): Result<void> {
    if (
      Device.requiresIdentifier(state.status) &&
      !state.serialNumber &&
      !state.macAddress
    ) {
      return Result.fail<void>(
        `A device with status ${state.status.toString()} must have at least a serial number or MAC address`
      );
    }

    if (state.status.isActive() && !state.ipAddress) {
      return Result.fail<void>(
        'An ACTIVE device must have an IP address assigned'
      );
    }

    if (state.status.isActive() && !state.locationId) {
      return Result.fail<void>(
        'An ACTIVE device must have a location assigned'
      );
    }

    if (state.status.isCommissioning() && !state.ipAddress) {
      return Result.fail<void>(
        'A COMMISSIONING device must have an IP address assigned'
      );
    }

    if (
      state.monitoringEnabled &&
      !(state.status.isActive() || state.status.isCommissioning())
    ) {
      return Result.fail<void>(
        'Monitoring can only be enabled for ACTIVE or COMMISSIONING devices'
      );
    }

    const descriptionResult = Device.validateDescription(
      state.description
    );
    if (descriptionResult.isFailure) {
      return descriptionResult;
    }

    const installedDateResult = Device.validateInstalledDate(
      state.installedDate
    );
    if (installedDateResult.isFailure) {
      return installedDateResult;
    }

    return Result.ok<void>();
  }

  private static validateDescription(
    description: string | null
  ): Result<void> {
    if (description !== null && description.length > 500) {
      return Result.fail<void>(
        'Device description cannot exceed 500 characters'
      );
    }
    return Result.ok<void>();
  }

  private static validateInstalledDate(
    installedDate: Date | null
  ): Result<void> {
    if (installedDate === null) {
      return Result.ok<void>();
    }

    const guardResult = Guard.isDate(installedDate, 'installedDate');
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (installedDate.getTime() > Date.now()) {
      return Result.fail<void>(
        'installedDate cannot be in the future'
      );
    }

    return Result.ok<void>();
  }
}
