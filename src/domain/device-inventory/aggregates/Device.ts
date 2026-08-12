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
  DeviceModelCorrectedEvent,
  DeviceDeletedEvent,
  DeviceRestoredEvent,
  DeviceReplacedEvent
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

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get deletedBy(): string | null {
    return this.props.deletedBy;
  }

  get replacedAt(): Date | null {
    return this.props.replacedAt;
  }

  get replacesDeviceId(): DeviceId | null {
    return this.props.replacesDeviceId;
  }

  get replacedByDeviceId(): DeviceId | null {
    return this.props.replacedByDeviceId;
  }

  public static create(
    props: Omit<
      DeviceProps,
      | 'createdAt'
      | 'updatedAt'
      | 'monitoringEnabled'
      | 'deletedAt'
      | 'deletedBy'
      | 'replacedAt'
      | 'replacesDeviceId'
      | 'replacedByDeviceId'
    > & {
      monitoringEnabled?: boolean;
      // Set only by ReplaceDeviceUseCase — a unit created as the successor of
      // a retired one carries the link from birth, so the lineage is never in
      // a half-written state.
      replacesDeviceId?: DeviceId | null;
      replacedAt?: Date | null;
    }
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
      installedDate: props.installedDate ?? null,
      deletedAt: null
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
        updatedAt: now,
        deletedAt: null,
        deletedBy: null,
        replacedAt: props.replacedAt ?? null,
        replacesDeviceId: props.replacesDeviceId ?? null,
        replacedByDeviceId: null
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

  // bypasses validation — for repository use only.
  //
  // The tombstone and lineage fields are optional because their absence has an
  // unambiguous meaning: never deleted, never replaced. That is exactly what a
  // row written before migration 20260811120000 carries.
  public static reconstitute(
    id: DeviceId,
    props: Omit<
      DeviceProps,
      | 'deletedAt'
      | 'deletedBy'
      | 'replacedAt'
      | 'replacesDeviceId'
      | 'replacedByDeviceId'
    > &
      Partial<
        Pick<
          DeviceProps,
          | 'deletedAt'
          | 'deletedBy'
          | 'replacedAt'
          | 'replacesDeviceId'
          | 'replacedByDeviceId'
        >
      >
  ): Device {
    return new Device(
      {
        ...props,
        deletedAt: props.deletedAt ?? null,
        deletedBy: props.deletedBy ?? null,
        replacedAt: props.replacedAt ?? null,
        replacesDeviceId: props.replacesDeviceId ?? null,
        replacedByDeviceId: props.replacedByDeviceId ?? null
      },
      id
    );
  }

  // The single mutation path. Every field a caller may change arrives together,
  // so the whole candidate state is validated once instead of field-by-field —
  // which is what lets a request that is legal as a whole (set an IP *and* go
  // ACTIVE, assign a location *and* go ACTIVE) succeed regardless of the order
  // its fields happen to be listed in. The narrower mutators below are thin
  // wrappers over this one; none of them re-implements a rule.
  public applyChanges(changes: DeviceChanges): Result<void> {
    // A tombstone is not editable. Without this every mutator below would
    // happily rewrite a device the operator has already deleted, and the
    // change would reappear if the device were later restored.
    if (this.isDeleted()) {
      return Result.fail<void>(
        'Cannot modify a deleted device — restore it first'
      );
    }

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

    // DEV-059: arriving at COMMISSIONING turns monitoring on, but like DEV-058
    // only when the caller expressed no preference — an explicit false in the
    // same request is respected.
    const monitoringEnabled =
      statusChanged &&
      next.status.isCommissioning() &&
      changes.monitoringEnabled === undefined
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
      installedDate: next.installedDate,
      deletedAt: this.props.deletedAt
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
          ipAddress: this.props.ipAddress,
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

  public isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  public isReplaced(): boolean {
    return this.props.replacedByDeviceId !== null;
  }

  // Reversible removal. The row and every metric hanging off it survive; the
  // device simply stops existing as far as every read path is concerned, until
  // either a restore brings it back or the grace period runs out and the purge
  // takes it for good.
  public softDelete(
    deletedBy: string | null,
    now: Date = new Date()
  ): Result<void> {
    if (this.isDeleted()) {
      return Result.fail<void>('Device is already deleted');
    }

    const guardResult = Guard.isDate(now, 'now');
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    // Deleting is also a decision to stop watching. Doing it here rather than
    // asking the caller to send monitoringEnabled: false separately is what
    // makes the polling pipeline react — the toggle event is its only trigger.
    const monitoringWasOn = this.props.monitoringEnabled;

    this.props.deletedAt = now;
    this.props.deletedBy = deletedBy;
    this.props.monitoringEnabled = false;
    this.touch();

    this.addDomainEvent(
      new DeviceDeletedEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        status: this.props.status,
        deletedBy,
        deletedAt: now,
        dateTimeOccurred: now
      })
    );

    if (monitoringWasOn) {
      this.addDomainEvent(
        new DeviceMonitoringToggledEvent({
          aggregateId: this.id,
          deviceName: this.props.name,
          monitoringEnabled: false,
          ipAddress: this.props.ipAddress,
          dateTimeOccurred: now
        })
      );
    }

    return Result.ok<void>();
  }

  // Monitoring deliberately stays off. Coming back from a deletion is not the
  // same as being put back in service — the operator re-enables polling once
  // they have decided the device belongs on the network again.
  public restore(
    now: Date = new Date(),
    graceDays: number = Device.DELETE_GRACE_DAYS
  ): Result<void> {
    const deletedAt = this.props.deletedAt;

    if (deletedAt === null) {
      return Result.fail<void>(
        'Cannot restore a device that is not deleted'
      );
    }

    const guardResult = Guard.isDate(now, 'now');
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (Device.graceExpired(deletedAt, now, graceDays)) {
      return Result.fail<void>(
        `Cannot restore a device whose ${graceDays}-day grace period expired`
      );
    }

    this.props.deletedAt = null;
    this.props.deletedBy = null;
    this.touch();

    this.addDomainEvent(
      new DeviceRestoredEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        status: this.props.status,
        deletedAt,
        dateTimeOccurred: now
      })
    );

    return Result.ok<void>();
  }

  // Retires this unit because different hardware has taken over its job. The
  // IP goes with the job, not the box, so it is released here for the
  // successor to claim — which is also what keeps the partial unique index on
  // ip_address satisfied when both rows are live.
  //
  // `retiredStatus` is the caller's: a failed unit is DAMAGED, an upgraded one
  // that still works goes back to INVENTORY, one that is done for good is
  // DECOMMISSIONED. Nothing here can tell those apart.
  public markReplaced(
    retiredStatus: DeviceStatus,
    now: Date = new Date()
  ): Result<void> {
    if (this.isDeleted()) {
      return Result.fail<void>('Cannot replace a deleted device');
    }

    if (this.isReplaced()) {
      return Result.fail<void>(
        'Device has already been replaced'
      );
    }

    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(retiredStatus, 'retiredStatus'),
      Guard.isDate(now, 'now')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (!retiredStatus.isRetired()) {
      return Result.fail<void>(
        `Cannot retire a replaced device as ${retiredStatus.toString()} — must be one of: ${DeviceStatus.retiredStatuses().join(', ')}`
      );
    }

    const previousStatus = this.props.status;
    const releasedIpAddress = this.props.ipAddress;
    const monitoringWasOn = this.props.monitoringEnabled;

    const validationResult = Device.validate({
      status: retiredStatus,
      serialNumber: this.props.serialNumber,
      macAddress: this.props.macAddress,
      ipAddress: null,
      locationId: this.props.locationId,
      monitoringEnabled: false,
      description: this.props.description,
      installedDate: this.props.installedDate,
      deletedAt: null
    });

    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props.status = retiredStatus;
    this.props.ipAddress = null;
    this.props.monitoringEnabled = false;
    this.props.replacedAt = now;
    this.touch();

    this.addDomainEvent(
      new DeviceReplacedEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        retiredStatus,
        previousDeviceModelId: this.props.deviceModelId,
        releasedIpAddress,
        replacedAt: now,
        dateTimeOccurred: now
      })
    );

    if (!previousStatus.equals(retiredStatus)) {
      this.addDomainEvent(
        new DeviceStatusChangedEvent({
          aggregateId: this.id,
          deviceName: this.props.name,
          previousStatus,
          newStatus: retiredStatus,
          dateTimeOccurred: now
        })
      );
    }

    if (monitoringWasOn) {
      this.addDomainEvent(
        new DeviceMonitoringToggledEvent({
          aggregateId: this.id,
          deviceName: this.props.name,
          monitoringEnabled: false,
          ipAddress: null,
          dateTimeOccurred: now
        })
      );
    }

    return Result.ok<void>();
  }

  public graceExpiredAt(
    now: Date,
    graceDays: number = Device.DELETE_GRACE_DAYS
  ): boolean {
    if (this.props.deletedAt === null) {
      return false;
    }
    return Device.graceExpired(this.props.deletedAt, now, graceDays);
  }

  public static readonly DELETE_GRACE_DAYS = 7;

  private static graceExpired(
    deletedAt: Date,
    now: Date,
    graceDays: number
  ): boolean {
    const graceMs = graceDays * 24 * 60 * 60 * 1000;
    return now.getTime() - deletedAt.getTime() > graceMs;
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

  // Every retired status needs one: a unit that is not on the network can only
  // be told apart from its shelf-mates by something written on the box.
  private static requiresIdentifier(status: DeviceStatus): boolean {
    return status.isRetired();
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
    deletedAt: Date | null;
  }): Result<void> {
    if (state.monitoringEnabled && state.deletedAt !== null) {
      return Result.fail<void>(
        'Monitoring cannot be enabled for a deleted device'
      );
    }

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
