import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { ServicePlanId } from 'domain/shared/ids';
import { ServicePlanProps } from '../props';
import {
  ServicePlanCreatedEvent,
  ServicePlanUpdatedEvent
} from '../events';

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

export class ServicePlan extends AggregateRoot<
  ServicePlanProps,
  ServicePlanId
> {
  private constructor(props: ServicePlanProps, id: ServicePlanId) {
    super(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get downloadMbps(): number {
    return this.props.downloadMbps;
  }

  get uploadMbps(): number {
    return this.props.uploadMbps;
  }

  get monthlyPrice(): number {
    return this.props.monthlyPrice;
  }

  get description(): string | null {
    return this.props.description;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    props: Omit<
      ServicePlanProps,
      'createdAt' | 'updatedAt' | 'isActive'
    > & { isActive?: boolean }
  ): Result<ServicePlan> {
    const validationResult = ServicePlan.validate(props);
    if (validationResult.isFailure) {
      return Result.fail<ServicePlan>(validationResult.error);
    }

    const id = ServicePlanId.create();
    const now = new Date();

    const plan = new ServicePlan(
      {
        ...props,
        name: props.name.trim(),
        description: props.description ?? null,
        isActive: props.isActive ?? true,
        createdAt: now,
        updatedAt: now
      },
      id
    );

    plan.addDomainEvent(
      new ServicePlanCreatedEvent({
        aggregateId: plan.id,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        dateTimeOccurred: now
      })
    );

    return Result.ok<ServicePlan>(plan);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: ServicePlanId,
    props: ServicePlanProps
  ): ServicePlan {
    return new ServicePlan(props, id);
  }

  public rename(newName: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(newName, 'name'),
      Guard.isString(newName, 'name')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      return Result.fail<void>('Service plan name cannot be empty');
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return Result.fail<void>(
        `Service plan name cannot exceed ${MAX_NAME_LENGTH} characters`
      );
    }

    if (this.props.name === trimmed) return Result.ok<void>();

    this.props.name = trimmed;
    this.emitUpdated(['name']);
    return Result.ok<void>();
  }

  public updatePricing(newMonthlyPrice: number): Result<void> {
    const priceResult = ServicePlan.validatePrice(newMonthlyPrice);
    if (priceResult.isFailure) {
      return Result.fail<void>(priceResult.error);
    }

    if (this.props.monthlyPrice === newMonthlyPrice) {
      return Result.ok<void>();
    }

    this.props.monthlyPrice = newMonthlyPrice;
    this.emitUpdated(['monthlyPrice']);
    return Result.ok<void>();
  }

  public updateBandwidth(
    downloadMbps: number,
    uploadMbps: number
  ): Result<void> {
    const bandwidthResult = ServicePlan.validateBandwidth(
      downloadMbps,
      uploadMbps
    );
    if (bandwidthResult.isFailure) {
      return Result.fail<void>(bandwidthResult.error);
    }

    if (
      this.props.downloadMbps === downloadMbps &&
      this.props.uploadMbps === uploadMbps
    ) {
      return Result.ok<void>();
    }

    this.props.downloadMbps = downloadMbps;
    this.props.uploadMbps = uploadMbps;
    this.emitUpdated(['downloadMbps', 'uploadMbps']);
    return Result.ok<void>();
  }

  public updateDescription(
    newDescription: string | null
  ): Result<void> {
    if (
      newDescription !== null &&
      newDescription.length > MAX_DESCRIPTION_LENGTH
    ) {
      return Result.fail<void>(
        `Service plan description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
      );
    }

    if (this.props.description === newDescription) {
      return Result.ok<void>();
    }

    this.props.description = newDescription;
    this.emitUpdated(['description']);
    return Result.ok<void>();
  }

  public activate(): Result<void> {
    if (this.props.isActive) return Result.ok<void>();
    this.props.isActive = true;
    this.emitUpdated(['isActive']);
    return Result.ok<void>();
  }

  public deactivate(): Result<void> {
    if (!this.props.isActive) return Result.ok<void>();
    this.props.isActive = false;
    this.emitUpdated(['isActive']);
    return Result.ok<void>();
  }

  private emitUpdated(changedFields: string[]): void {
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new ServicePlanUpdatedEvent({
        aggregateId: this.id,
        name: this.props.name,
        changedFields,
        dateTimeOccurred: this.props.updatedAt
      })
    );
  }

  private static validate(
    props: Omit<
      ServicePlanProps,
      'createdAt' | 'updatedAt' | 'isActive'
    >
  ): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.name, 'name'),
      Guard.isString(props.name, 'name')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const name = props.name.trim();
    if (name.length === 0) {
      return Result.fail<void>('Service plan name cannot be empty');
    }
    if (name.length > MAX_NAME_LENGTH) {
      return Result.fail<void>(
        `Service plan name cannot exceed ${MAX_NAME_LENGTH} characters`
      );
    }

    const bandwidthResult = ServicePlan.validateBandwidth(
      props.downloadMbps,
      props.uploadMbps
    );
    if (bandwidthResult.isFailure) {
      return bandwidthResult;
    }

    const priceResult = ServicePlan.validatePrice(props.monthlyPrice);
    if (priceResult.isFailure) {
      return priceResult;
    }

    if (
      props.description != null &&
      props.description.length > MAX_DESCRIPTION_LENGTH
    ) {
      return Result.fail<void>(
        `Service plan description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
      );
    }

    return Result.ok<void>();
  }

  private static validateBandwidth(
    downloadMbps: number,
    uploadMbps: number
  ): Result<void> {
    const guardResult = Guard.combine([
      Guard.isNumber(downloadMbps, 'downloadMbps'),
      Guard.isNumber(uploadMbps, 'uploadMbps')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (downloadMbps <= 0) {
      return Result.fail<void>('downloadMbps must be greater than 0');
    }
    if (uploadMbps <= 0) {
      return Result.fail<void>('uploadMbps must be greater than 0');
    }

    return Result.ok<void>();
  }

  private static validatePrice(monthlyPrice: number): Result<void> {
    const guardResult = Guard.isNumber(monthlyPrice, 'monthlyPrice');
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }
    if (monthlyPrice < 0) {
      return Result.fail<void>('monthlyPrice cannot be negative');
    }
    return Result.ok<void>();
  }
}
