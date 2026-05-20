import { ValueObject, Result, Guard } from 'domain/shared/core';
import { WirelessAlertProps } from '../props/WirelessAlertProps';

export class WirelessAlert extends ValueObject<WirelessAlertProps> {
  private constructor(props: WirelessAlertProps) {
    super(props);
  }

  get metric(): string {
    return this._props.metric;
  }
  get severity(): 'WARNING' | 'CRITICAL' {
    return this._props.severity;
  }
  get threshold(): number {
    return this._props.threshold;
  }
  get currentValue(): number {
    return this._props.currentValue;
  }
  get message(): string {
    return this._props.message;
  }
  get triggeredAt(): Date {
    return this._props.triggeredAt;
  }

  public static create(
    props: WirelessAlertProps
  ): Result<WirelessAlert> {
    const nullCheck = Guard.againstNullOrUndefined(
      props,
      'WirelessAlert props'
    );
    if (!nullCheck.succeeded) {
      return Result.fail<WirelessAlert>(nullCheck.message!);
    }

    const baseGuards = Guard.combine([
      Guard.againstNullOrUndefined(props.metric, 'metric'),
      Guard.isString(props.metric, 'metric'),
      Guard.againstNullOrUndefined(props.message, 'message'),
      Guard.isString(props.message, 'message'),
      Guard.againstNullOrUndefined(props.triggeredAt, 'triggeredAt'),
      Guard.isNumber(props.threshold, 'threshold'),
      Guard.isNumber(props.currentValue, 'currentValue')
    ]);

    if (!baseGuards.succeeded) {
      return Result.fail<WirelessAlert>(baseGuards.message!);
    }

    if (props.metric.trim().length === 0) {
      return Result.fail<WirelessAlert>('metric cannot be empty');
    }

    if (props.message.trim().length === 0) {
      return Result.fail<WirelessAlert>('message cannot be empty');
    }

    if (
      props.severity !== 'WARNING' &&
      props.severity !== 'CRITICAL'
    ) {
      return Result.fail<WirelessAlert>(
        `severity must be 'WARNING' or 'CRITICAL', got: ${props.severity}`
      );
    }

    return Result.ok<WirelessAlert>(new WirelessAlert(props));
  }

  public static reconstitute(
    props: WirelessAlertProps
  ): WirelessAlert {
    return new WirelessAlert(props);
  }

  public toString(): string {
    return `[${this._props.severity}] ${this._props.metric}: ${this._props.message}`;
  }
}
