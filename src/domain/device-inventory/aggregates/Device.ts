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
import { DeviceProps, DeviceChanges } from '../props';
import {
  DeviceCreatedEvent,
  DeviceStatusChangedEvent,
  DeviceLocationAssignedEvent,
  DeviceMonitoringToggledEvent,
  DeviceDetailsUpdatedEvent,
  DeviceModelCorrectedEvent
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

  // The single mutation path. Every field a caller may change arrives together,
  // so the whole candidate state is validated once instead of field-by-field —
  // which is what lets a request that is legal as a whole (set an IP *and* go
  // ACTIVE, assign a location *and* go ACTIVE) succeed regardless of the order
  // its fields happen to be listed in. The narrower mutators below are thin
  // wrappers over this one; none of them re-implements a rule.
  public applyChanges(changes: DeviceChanges): Result<void> {
    if (changes.ownerType !== undefined) {
      const guardResult = Guard.againstNullOrUndefined(
        changes.ownerType,
        'ownerType'
      );
      if (!guardResult.succeeded) {
        return Result.fail<void>(guardResult.message!);
      }
    }

    if (changes.status !== undefined) {
      const guardResult = Guard.againstNullOrUndefined(
        changes.status,
        'status'
      );
      if (!guardResult.succeeded) {
        return Result.fail<void>(guardResult.message!);
      }
    }

    if (changes.deviceModelId !== undefined) {
      const guardResult = Guard.againstNullOrUndefined(
        changes.deviceModelId,
        'deviceModelId'
      );
      if (!guardResult.succeeded) {
        return Result.fail<void>(guardResult.message!);
      }
    }

    const next = this.resolve(changes);

    // DEV-063 is judged against the status the device has *now*, not the one it
    // is moving to — correcting the model of a unit that is still INVENTORY is
    // legal even when the same request commissions it.
    const modelChanged = !this.props.deviceModelId.equals(
      next.deviceModelId
    );
    if (modelChanged && !this.props.status.isInInventory()) {
      return Result.fail<void>(
        `Cannot change the device model of a device with status ${this.props.status.toString()} — only an INVENTORY device may have its model corrected`
      );
    }

    const statusChanged = !this.props.status.equals(next.status);

    // DEV-059: arriving at COMMISSIONING turns monitoring on, overriding an
    // explicit false in the same request. DEV-058's "respect an explicit
    // false" applies to creation only.
    const monitoringEnabled =
      statusChanged && next.status.isCommissioning()
        ? true
        : next.monitoringEnabled;

    const nothingProvided = Object.keys(changes).length === 0;
    if (nothingProvided) {
      return Result.ok<void>();
    }

    const validationResult = Device.validate({
      status: next.status,
      serialNumber: next.serialNumber,
      macAddress: next.macAddress,
      ipAddress: next.ipAddress,
      locationId: next.locationId,
      monitoringEnabled,
      description: next.description,
      installedDate: next.installedDate
    });

    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    const previousDeviceModelId = this.props.deviceModelId;
    const previousStatus = this.props.status;
    const previousLocationId = this.props.locationId;
    const previousMonitoring = this.props.monitoringEnabled;

    const locationChanged = !Device.sameLocation(
      previousLocationId,
      next.locationId
    );
    const detailsProvided = Device.touchesDetails(changes);
    const monitoringChanged =
      previousMonitoring !== monitoringEnabled;

    if (
      !modelChanged &&
      !statusChanged &&
      !locationChanged &&
      !monitoringChanged &&
      !detailsProvided
    ) {
      return Result.ok<void>();
    }

    this.props.deviceModelId = next.deviceModelId;
    this.props.name = next.name;
    this.props.description = next.description;
    this.props.category = next.category;
    this.props.serialNumber = next.serialNumber;
    this.props.macAddress = next.macAddress;
    this.props.ipAddress = next.ipAddress;
    this.props.installedDate = next.installedDate;
    this.props.ownerType = next.ownerType;
    this.props.status = next.status;
    this.props.locationId = next.locationId;
    this.props.monitoringEnabled = monitoringEnabled;

    this.touch();

    const now = new Date();

    if (modelChanged) {
      this.addDomainEvent(
        new DeviceModelCorrectedEvent({
          aggregateId: this.id,
          deviceName: this.props.name,
          previousDeviceModelId,
          newDeviceModelId: this.props.deviceModelId,
          dateTimeOccurred: now
        })
      );
    }

    if (detailsProvided) {
      this.addDomainEvent(
        new DeviceDetailsUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.props.name,
          updatedFields: {
            name:
              changes.name !== undefined
                ? this.props.name
                : undefined,
            description: changes.description,
            category: changes.category,
            serialNumber: changes.serialNumber,
            macAddress: changes.macAddress,
            ipAddress: changes.ipAddress,
            installedDate: changes.installedDate,
            ownerType: changes.ownerType
          },
          dateTimeOccurred: now
        })
      );
    }

    if (statusChanged) {
      this.addDomainEvent(
        new DeviceStatusChangedEvent({
          aggregateId: this.id,
          deviceName: this.props.name,
          previousStatus,
          newStatus: this.props.status,
          dateTimeOccurred: now
        })
      );
    }

    if (locationChanged) {
      this.addDomainEvent(
        new DeviceLocationAssignedEvent({
          aggregateId: this.id,
          deviceName: this.props.name,
          previousLocationId,
          newLocationId: this.props.locationId,
          dateTimeOccurred: now
        })
      );
    }

    if (monitoringChanged) {
      this.addDomainEvent(
        new DeviceMonitoringToggledEvent({
          aggregateId: this.id,
          deviceName: this.props.name,
          monitoringEnabled,
          ipAddress: this.props.ipAddress as IPAddress,
          dateTimeOccurred: now
        })
      );
    }

    return Result.ok<void>();
  }

  public changeStatus(newStatus: DeviceStatus): Result<void> {
    return this.applyChanges({ status: newStatus });
  }

  public assignLocation(locationId: LocationId | null): Result<void> {
    return this.applyChanges({ locationId });
  }

  // A data-entry correction, not a hardware swap. Restricted to INVENTORY
  // because that is the only status in which the unit has never been polled,
  // so no collected metric can end up attributed to the wrong hardware.
  // Replacing a unit with one of a different model is a separate operation —
  // see TODO "Device replacement" in docs/TODOS.md.
  public correctDeviceModel(
    deviceModelId: DeviceModelId
  ): Result<void> {
    return this.applyChanges({ deviceModelId });
  }

  public enableMonitoring(): Result<void> {
    return this.applyChanges({ monitoringEnabled: true });
  }

  public disableMonitoring(): Result<void> {
    return this.applyChanges({ monitoringEnabled: false });
  }

  public canHaveWirelessConfig(): boolean {
    return (
      this.props.category?.isWirelessCpe() === true ||
      this.props.category?.isAccessPoint() === true
    );
  }

  public updateDetails(fields: DeviceChanges): Result<void> {
    return this.applyChanges(fields);
  }

  private static readonly DETAIL_FIELDS = [
    'name',
    'description',
    'category',
    'serialNumber',
    'macAddress',
    'ipAddress',
    'installedDate',
    'ownerType'
  ] as const;

  private static touchesDetails(changes: DeviceChanges): boolean {
    return Device.DETAIL_FIELDS.some(
      (field) => changes[field] !== undefined
    );
  }

  private static sameLocation(
    a: LocationId | null,
    b: LocationId | null
  ): boolean {
    if (a === null || b === null) {
      return a === b;
    }
    return a.equals(b);
  }

  private resolve(changes: DeviceChanges): {
    deviceModelId: DeviceModelId;
    name: DeviceName;
    description: string | null;
    category: DeviceCategory | null;
    serialNumber: SerialNumber | null;
    macAddress: MACAddress | null;
    ipAddress: IPAddress | null;
    installedDate: Date | null;
    ownerType: DeviceOwnerType | null;
    status: DeviceStatus;
    locationId: LocationId | null;
    monitoringEnabled: boolean;
  } {
    const pick = <T>(incoming: T | undefined, current: T): T =>
      incoming !== undefined ? incoming : current;

    return {
      deviceModelId: pick(
        changes.deviceModelId,
        this.props.deviceModelId
      ),
      name: pick(changes.name, this.props.name),
      description: pick(changes.description, this.props.description),
      category: pick(changes.category, this.props.category),
      serialNumber: pick(
        changes.serialNumber,
        this.props.serialNumber
      ),
      macAddress: pick(changes.macAddress, this.props.macAddress),
      ipAddress: pick(changes.ipAddress, this.props.ipAddress),
      installedDate: pick(
        changes.installedDate,
        this.props.installedDate
      ),
      ownerType: pick(changes.ownerType, this.props.ownerType),
      status: pick(changes.status, this.props.status),
      locationId: pick(changes.locationId, this.props.locationId),
      monitoringEnabled: pick(
        changes.monitoringEnabled,
        this.props.monitoringEnabled
      )
    };
  }

  private touch(): void {
    this.props.updatedAt = new Date();
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
