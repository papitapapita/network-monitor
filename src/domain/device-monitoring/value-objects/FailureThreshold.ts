import { ValueObject, Result, Guard } from 'domain/shared/core';
import { FailureThresholdProps } from '../props/FailureThresholdProps';

export class FailureThreshold extends ValueObject<FailureThresholdProps> {
  public static readonly MIN = 1;
  public static readonly DEFAULT = 3;
  public static readonly MAX = 100;

  get value(): number {
    return this._props.count;
  }

  private constructor(props: FailureThresholdProps) {
    super(props);
  }

  public static create(count: number): Result<FailureThreshold> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(count, 'failuresBeforeDown'),
      Guard.isNumber(count, 'failuresBeforeDown'),
      Guard.inRange(count, this.MIN, this.MAX, 'failuresBeforeDown')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<FailureThreshold>(guardResult.message!);
    }

    if (!Number.isInteger(count)) {
      return Result.fail<FailureThreshold>(
        'failuresBeforeDown must be an integer'
      );
    }

    return Result.ok<FailureThreshold>(
      new FailureThreshold({ count })
    );
  }

  public static createDefault(): FailureThreshold {
    return new FailureThreshold({
      count: this.DEFAULT
    });
  }

  public static reconstitute(
    props: FailureThresholdProps
  ): FailureThreshold {
    return new FailureThreshold(props);
  }

  public toString(): string {
    return this.value.toString();
  }
}
