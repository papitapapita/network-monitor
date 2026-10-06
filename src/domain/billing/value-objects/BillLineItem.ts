import { ValueObject, Result, Guard } from 'domain/shared/core';
import {
  ContractedServiceId,
  ServicePlanId
} from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { ServicePeriod } from './ServicePeriod';

const MAX_PLAN_NAME_LENGTH = 100;

interface BillLineItemProps {
  readonly contractedServiceId: ContractedServiceId;
  readonly servicePlanId: ServicePlanId;
  readonly planName: string;
  readonly monthlyPrice: Money;
  // What this line charges: the monthly price, or a prorated share of it.
  readonly amount: Money;
  // Null on lines issued before service periods were recorded.
  readonly servicePeriod: ServicePeriod | null;
}

type BillLineItemInput = Omit<
  BillLineItemProps,
  'amount' | 'servicePeriod'
> &
  Partial<Pick<BillLineItemProps, 'amount' | 'servicePeriod'>>;

export class BillLineItem extends ValueObject<BillLineItemProps> {
  private constructor(props: BillLineItemProps) {
    super(props);
  }

  get contractedServiceId(): ContractedServiceId {
    return this._props.contractedServiceId;
  }

  get servicePlanId(): ServicePlanId {
    return this._props.servicePlanId;
  }

  get planName(): string {
    return this._props.planName;
  }

  get monthlyPrice(): Money {
    return this._props.monthlyPrice;
  }

  get amount(): Money {
    return this._props.amount;
  }

  get servicePeriod(): ServicePeriod | null {
    return this._props.servicePeriod;
  }

  // amount defaults to the full monthly price.
  public static create(
    props: BillLineItemInput
  ): Result<BillLineItem> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(
        props.contractedServiceId,
        'contractedServiceId'
      ),
      Guard.againstNullOrUndefined(
        props.servicePlanId,
        'servicePlanId'
      ),
      Guard.againstNullOrUndefined(props.planName, 'planName'),
      Guard.isString(props.planName, 'planName'),
      Guard.againstNullOrUndefined(props.monthlyPrice, 'monthlyPrice')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<BillLineItem>(guardResult.message!);
    }

    const planName = props.planName.trim();
    if (planName.length === 0) {
      return Result.fail<BillLineItem>('planName cannot be empty');
    }
    if (planName.length > MAX_PLAN_NAME_LENGTH) {
      return Result.fail<BillLineItem>(
        `planName cannot exceed ${MAX_PLAN_NAME_LENGTH} characters`
      );
    }

    return Result.ok<BillLineItem>(
      new BillLineItem({
        ...props,
        planName,
        amount: props.amount ?? props.monthlyPrice,
        servicePeriod: props.servicePeriod ?? null
      })
    );
  }
}
