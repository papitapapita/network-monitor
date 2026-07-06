import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import {
  ContractedServiceId,
  CustomerId,
  ServicePlanId,
  DeviceId
} from 'domain/shared/ids';
import { ContractedServiceStatus } from '../enums';
import { ContractedServiceProps } from '../props';
import {
  ContractedServiceCreatedEvent,
  DeviceAssignedToServiceEvent,
  ContractedServiceStatusChangedEvent
} from '../events';

export class ContractedService extends AggregateRoot<
  ContractedServiceProps,
  ContractedServiceId
> {
  private constructor(
    props: ContractedServiceProps,
    id: ContractedServiceId
  ) {
    super(props, id);
  }

  get customerId(): CustomerId {
    return this.props.customerId;
  }

  get servicePlanId(): ServicePlanId {
    return this.props.servicePlanId;
  }

  get deviceId(): DeviceId | null {
    return this.props.deviceId;
  }

  get status(): ContractedServiceStatus {
    return this.props.status;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    props: Omit<
      ContractedServiceProps,
      'createdAt' | 'updatedAt' | 'status'
    > & { status?: ContractedServiceStatus }
  ): Result<ContractedService> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.customerId, 'customerId'),
      Guard.againstNullOrUndefined(
        props.servicePlanId,
        'servicePlanId'
      ),
      Guard.againstNullOrUndefined(props.startDate, 'startDate'),
      Guard.isDate(props.startDate, 'startDate')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<ContractedService>(guardResult.message!);
    }

    const status = props.status ?? ContractedServiceStatus.PENDING;
    const deviceId = props.deviceId ?? null;

    // An ACTIVE service must be bonded to a device.
    if (status === ContractedServiceStatus.ACTIVE && deviceId === null) {
      return Result.fail<ContractedService>(
        'Cannot create an ACTIVE contracted service without a device assigned'
      );
    }

    const id = ContractedServiceId.create();
    const now = new Date();

    const service = new ContractedService(
      {
        ...props,
        deviceId,
        status,
        createdAt: now,
        updatedAt: now
      },
      id
    );

    service.addDomainEvent(
      new ContractedServiceCreatedEvent({
        aggregateId: service.id,
        customerId: service.customerId,
        servicePlanId: service.servicePlanId,
        status: service.status,
        dateTimeOccurred: now
      })
    );

    return Result.ok<ContractedService>(service);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: ContractedServiceId,
    props: ContractedServiceProps
  ): ContractedService {
    return new ContractedService(props, id);
  }

  public assignDevice(deviceId: DeviceId): Result<void> {
    const cancelledGuard = this.ensureNotCancelled();
    if (cancelledGuard.isFailure) return cancelledGuard;

    const guardResult = Guard.againstNullOrUndefined(
      deviceId,
      'deviceId'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (
      this.props.deviceId !== null &&
      this.props.deviceId.equals(deviceId)
    ) {
      return Result.ok<void>();
    }

    const previousDeviceId = this.props.deviceId;
    this.props.deviceId = deviceId;
    this.touch();

    this.addDomainEvent(
      new DeviceAssignedToServiceEvent({
        aggregateId: this.id,
        previousDeviceId,
        newDeviceId: deviceId,
        dateTimeOccurred: this.props.updatedAt
      })
    );

    return Result.ok<void>();
  }

  public releaseDevice(): Result<void> {
    const cancelledGuard = this.ensureNotCancelled();
    if (cancelledGuard.isFailure) return cancelledGuard;

    if (this.props.status === ContractedServiceStatus.ACTIVE) {
      return Result.fail<void>(
        'Cannot release the device of an ACTIVE service; suspend it first'
      );
    }

    if (this.props.deviceId === null) {
      return Result.ok<void>();
    }

    const previousDeviceId = this.props.deviceId;
    this.props.deviceId = null;
    this.touch();

    this.addDomainEvent(
      new DeviceAssignedToServiceEvent({
        aggregateId: this.id,
        previousDeviceId,
        newDeviceId: null,
        dateTimeOccurred: this.props.updatedAt
      })
    );

    return Result.ok<void>();
  }

  public activate(): Result<void> {
    const cancelledGuard = this.ensureNotCancelled();
    if (cancelledGuard.isFailure) return cancelledGuard;

    if (this.props.deviceId === null) {
      return Result.fail<void>(
        'Cannot activate a contracted service without a device assigned'
      );
    }

    return this.changeStatus(ContractedServiceStatus.ACTIVE);
  }

  public suspend(): Result<void> {
    const cancelledGuard = this.ensureNotCancelled();
    if (cancelledGuard.isFailure) return cancelledGuard;

    return this.changeStatus(ContractedServiceStatus.SUSPENDED);
  }

  public reactivate(): Result<void> {
    return this.activate();
  }

  public cancel(): Result<void> {
    const cancelledGuard = this.ensureNotCancelled();
    if (cancelledGuard.isFailure) return cancelledGuard;

    return this.changeStatus(ContractedServiceStatus.CANCELLED);
  }

  public changePlan(newServicePlanId: ServicePlanId): Result<void> {
    const cancelledGuard = this.ensureNotCancelled();
    if (cancelledGuard.isFailure) return cancelledGuard;

    const guardResult = Guard.againstNullOrUndefined(
      newServicePlanId,
      'servicePlanId'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (this.props.servicePlanId.equals(newServicePlanId)) {
      return Result.ok<void>();
    }

    this.props.servicePlanId = newServicePlanId;
    this.touch();
    return Result.ok<void>();
  }

  public isActive(): boolean {
    return this.props.status === ContractedServiceStatus.ACTIVE;
  }

  public isCancelled(): boolean {
    return this.props.status === ContractedServiceStatus.CANCELLED;
  }

  private changeStatus(
    newStatus: ContractedServiceStatus
  ): Result<void> {
    if (this.props.status === newStatus) {
      return Result.ok<void>();
    }

    const previousStatus = this.props.status;
    this.props.status = newStatus;
    this.touch();

    this.addDomainEvent(
      new ContractedServiceStatusChangedEvent({
        aggregateId: this.id,
        previousStatus,
        newStatus,
        dateTimeOccurred: this.props.updatedAt
      })
    );

    return Result.ok<void>();
  }

  private ensureNotCancelled(): Result<void> {
    if (this.props.status === ContractedServiceStatus.CANCELLED) {
      return Result.fail<void>(
        'Cannot modify a cancelled contracted service'
      );
    }
    return Result.ok<void>();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
