import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { DeviceModelId, VendorId } from 'domain/shared/ids';
import { DeviceModelProps } from '../props';
export class DeviceModel extends AggregateRoot<
  DeviceModelProps,
  DeviceModelId
> {
  private constructor(props: DeviceModelProps, id: DeviceModelId) {
    super(props, id);
  }

  get vendorId(): VendorId {
    return this.props.vendorId;
  }

  get vendorName(): string {
    return this.props.vendorName;
  }

  get vendorSlug(): string {
    return this.props.vendorSlug;
  }

  get model(): string {
    return this.props.model;
  }

  get deviceType(): string {
    return this.props.deviceType;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    props: Omit<DeviceModelProps, 'createdAt' | 'updatedAt'>
  ): Result<DeviceModel> {
    const validationResult = DeviceModel.validate(props);
    if (validationResult.isFailure) {
      return Result.fail<DeviceModel>(validationResult.error);
    }

    const id = DeviceModelId.create();
    const now = new Date();

    const deviceModel = new DeviceModel(
      { ...props, createdAt: now, updatedAt: now },
      id
    );

    return Result.ok<DeviceModel>(deviceModel);
  }

  public static reconstitute(
    id: DeviceModelId,
    props: DeviceModelProps
  ): DeviceModel {
    return new DeviceModel(props, id);
  }

  public updateModel(newModel: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(newModel, 'model'),
      Guard.isString(newModel, 'model')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const trimmed = newModel.trim();
    if (trimmed.length === 0) {
      return Result.fail<void>('Model name cannot be empty');
    }
    if (trimmed.length > 150) {
      return Result.fail<void>(
        'Model name cannot exceed 150 characters'
      );
    }

    if (this.props.model === trimmed) return Result.ok<void>();

    this.props.model = trimmed;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  public updateDeviceType(newDeviceType: string): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newDeviceType,
      'deviceType'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (this.props.deviceType === newDeviceType)
      return Result.ok<void>();

    this.props.deviceType = newDeviceType;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  public updateVendor(
    vendorId: VendorId,
    vendorName: string,
    vendorSlug: string
  ): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(vendorId, 'vendorId'),
      Guard.againstNullOrUndefined(vendorName, 'vendorName'),
      Guard.againstNullOrUndefined(vendorSlug, 'vendorSlug')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    this.props.vendorId = vendorId;
    this.props.vendorName = vendorName;
    this.props.vendorSlug = vendorSlug;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  private static validate(
    props: Omit<DeviceModelProps, 'createdAt' | 'updatedAt'>
  ): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.vendorId, 'vendorId'),
      Guard.againstNullOrUndefined(props.model, 'model'),
      Guard.againstNullOrUndefined(props.deviceType, 'deviceType'),
      Guard.isString(props.model, 'model'),
      Guard.isString(props.deviceType, 'deviceType')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const model = props.model.trim();
    if (model.length === 0) {
      return Result.fail<void>('Model name cannot be empty');
    }
    if (model.length > 150) {
      return Result.fail<void>(
        'Model name cannot exceed 150 characters'
      );
    }

    return Result.ok<void>();
  }
}
