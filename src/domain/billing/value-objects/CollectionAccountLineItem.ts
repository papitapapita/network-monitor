import { ValueObject, Result, Guard } from 'domain/shared/core';
import { Money } from 'domain/shared/value-objects';

const MAX_DESCRIPTION_LENGTH = 500;

interface CollectionAccountLineItemProps {
  readonly description: string;
  readonly unitPrice: Money;
  readonly quantity: number;
}

export class CollectionAccountLineItem extends ValueObject<CollectionAccountLineItemProps> {
  private constructor(props: CollectionAccountLineItemProps) {
    super(props);
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
    props: CollectionAccountLineItemProps
  ): Result<CollectionAccountLineItem> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.description, 'description'),
      Guard.isString(props.description, 'description'),
      Guard.againstNullOrUndefined(props.unitPrice, 'unitPrice'),
      Guard.againstNullOrUndefined(props.quantity, 'quantity'),
      Guard.isNumber(props.quantity, 'quantity')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<CollectionAccountLineItem>(
        guardResult.message!
      );
    }

    const description = props.description.trim();
    if (description.length === 0) {
      return Result.fail<CollectionAccountLineItem>(
        'description cannot be empty'
      );
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return Result.fail<CollectionAccountLineItem>(
        `description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`
      );
    }

    if (!Number.isInteger(props.quantity) || props.quantity < 1) {
      return Result.fail<CollectionAccountLineItem>(
        'quantity must be a positive integer'
      );
    }

    return Result.ok<CollectionAccountLineItem>(
      new CollectionAccountLineItem({
        description,
        unitPrice: props.unitPrice,
        quantity: props.quantity
      })
    );
  }
}
