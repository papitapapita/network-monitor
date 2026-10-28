import { AggregateRoot } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  RouterSystemReadingProps,
  RouterSystemStateProps
} from '../props';

export const ROUTER_READ_ERROR_MAX_LENGTH = 500;

// MON-161: the latest thing a MikroTik said about itself, one per router. A
// failed read is recorded beside the last good reading rather than over it,
// so the hardware a router last reported stays known while it is unreachable.
export class RouterSystemState extends AggregateRoot<
  RouterSystemStateProps,
  DeviceId
> {
  private constructor(props: RouterSystemStateProps, id: DeviceId) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }
  get reading(): RouterSystemReadingProps | null {
    return this.props.reading;
  }
  get readAt(): Date | null {
    return this.props.readAt;
  }
  get lastError(): string | null {
    return this.props.lastError;
  }
  get attemptedAt(): Date {
    return this.props.attemptedAt;
  }

  public static createInitial(
    deviceId: DeviceId,
    at: Date
  ): RouterSystemState {
    return new RouterSystemState(
      {
        deviceId,
        reading: null,
        readAt: null,
        lastError: null,
        attemptedAt: at
      },
      deviceId
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: DeviceId,
    props: RouterSystemStateProps
  ): RouterSystemState {
    return new RouterSystemState(props, id);
  }

  public recordReading(
    reading: RouterSystemReadingProps,
    at: Date
  ): void {
    this.props = {
      ...this.props,
      reading: { ...reading },
      readAt: at,
      lastError: null,
      attemptedAt: at
    };
  }

  public recordFailure(error: string, at: Date): void {
    this.props = {
      ...this.props,
      lastError: error.slice(0, ROUTER_READ_ERROR_MAX_LENGTH),
      attemptedAt: at
    };
  }
}
