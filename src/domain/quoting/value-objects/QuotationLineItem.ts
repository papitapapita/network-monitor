import { ValueObject, Result, Guard } from 'domain/shared/core';
import { DeviceModelId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';

const MAX_DEVICE_MODEL_NAME_LENGTH = 150;
const MAX_VENDOR_NAME_LENGTH = 100;
const MAX_DEVICE_TYPE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 500;

interface QuotationLineItemProps {
  readonly deviceModelId: DeviceModelId | null;
  readonly deviceModelName: string;
  readonly vendorName: string;
  readonly deviceType: string;
  readonly imageUrl: string | null;
  readonly description: string;
  readonly unitPrice: Money;
  readonly quantity: number;
}

export class QuotationLineItem extends ValueObject<QuotationLineItemProps> {
  private constructor(props: QuotationLineItemProps) {
    super(props);
  }

  get deviceModelId(): DeviceModelId | null {
    return this._props.deviceModelId;
  }

  get deviceModelName(): string {
    return this._props.deviceModelName;
  }

  get vendorName(): string {
    return this._props.vendorName;
  }

  get deviceType(): string {
    return this._props.deviceType;
  }

  get imageUrl(): string | null {
    return this._props.imageUrl;
  }

  get description(): string {
    return this._props.description;
  }

  get unitPrice(): Money {
    return this._props.unitPrice;
  }

  get quantity(): number {
    return this._props.quantity;
  }

  get lineTotal(): Money {
    return this._props.unitPrice.multiply(this._props.quantity);
  }

  public static create(
    props: Omit<QuotationLineItemProps, 'deviceModelId'> & {
      deviceModelId?: DeviceModelId | null;
    }
  ): Result<QuotationLineItem> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        props.deviceModelName,
        'deviceModelName'
      ),
      Guard.isString(props.deviceModelName, 'deviceModelName'),
      Guard.againstNullOrUndefined(props.vendorName, 'vendorName'),
      Guard.isString(props.vendorName, 'vendorName'),
      Guard.againstNullOrUndefined(props.deviceType, 'deviceType'),
      Guard.isString(props.deviceType, 'deviceType'),
      Guard.againstNullOrUndefined(props.description, 'description'),
      Guard.isString(props.description, 'description'),
      Guard.againstNullOrUndefined(props.unitPrice, 'unitPrice'),
      Guard.againstNullOrUndefined(props.quantity, 'quantity'),
      Guard.isNumber(props.quantity, 'quantity')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<QuotationLineItem>(guardResult.message!);
    }

    const deviceModelName = props.deviceModelName.trim();
    if (deviceModelName.length === 0) {
      return Result.fail<QuotationLineItem>(
        'deviceModelName cannot be empty'
      );
    }
    if (deviceModelName.length > MAX_DEVICE_MODEL_NAME_LENGTH) {
      return Result.fail<QuotationLineItem>(
        `deviceModelName cannot exceed ${MAX_DEVICE_MODEL_NAME_LENGTH} characters`
      );
    }

    const vendorName = props.vendorName.trim();
    if (vendorName.length > MAX_VENDOR_NAME_LENGTH) {
      return Result.fail<QuotationLineItem>(
        `vendorName cannot exceed ${MAX_VENDOR_NAME_LENGTH} characters`
      );
    }

    const deviceType = props.deviceType.trim();
    if (deviceType.length > MAX_DEVICE_TYPE_LENGTH) {
      return Result.fail<QuotationLineItem>(
        `deviceType cannot exceed ${MAX_DEVICE_TYPE_LENGTH} characters`
      );
    }

    const description = props.description.trim();
    if (description.length === 0) {
      return Result.fail<QuotationLineItem>(
        'description cannot be empty'
      );
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return Result.fail<QuotationLineItem>(
        `description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
      );
    }

    if (
      props.imageUrl !== null &&
      props.imageUrl !== undefined &&
      props.imageUrl.length > MAX_IMAGE_URL_LENGTH
    ) {
      return Result.fail<QuotationLineItem>(
        `imageUrl cannot exceed ${MAX_IMAGE_URL_LENGTH} characters`
      );
    }

    if (!Number.isInteger(props.quantity) || props.quantity < 1) {
      return Result.fail<QuotationLineItem>(
        'quantity must be a positive integer'
      );
    }

    return Result.ok<QuotationLineItem>(
      new QuotationLineItem({
        deviceModelId: props.deviceModelId ?? null,
        deviceModelName,
        vendorName,
        deviceType,
        imageUrl: props.imageUrl ?? null,
        description,
        unitPrice: props.unitPrice,
        quantity: props.quantity
      })
    );
  }
}
