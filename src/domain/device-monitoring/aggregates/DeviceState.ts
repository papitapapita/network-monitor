import { AggregateRoot } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { DeviceStateProps } from '../props';
import {
  DeviceWentOfflineEvent,
  DeviceCameOnlineEvent
} from '../events';

export class DeviceState extends AggregateRoot<
  DeviceStateProps,
  DeviceId
> {
  private constructor(props: DeviceStateProps, id: DeviceId) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }
  get isOnline(): boolean {
    return this.props.isOnline;
  }
  get lastSeen(): Date | null {
    return this.props.lastSeen;
  }
  get lastLatencyMs(): number | null {
    return this.props.lastLatencyMs;
  }
  get consecutiveFailures(): number {
    return this.props.consecutiveFailures;
  }
  get lastCheckedAt(): Date | null {
    return this.props.lastCheckedAt;
  }

  // no events raised — unknown→online is not a recoverable transition
  public static createInitial(deviceId: DeviceId): DeviceState {
    return new DeviceState(
      {
        deviceId,
        isOnline: false,
        lastSeen: null,
        lastLatencyMs: null,
        consecutiveFailures: 0,
        lastCheckedAt: null,
        updatedAt: new Date()
      },
      deviceId
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: DeviceId,
    props: DeviceStateProps
  ): DeviceState {
    return new DeviceState(props, id);
  }

  // raises events only on genuine transitions, never on the first poll
  // caller retries before calling this — isReachable is the definitive post-retry result
  public applyPingResult(
    isReachable: boolean,
    latencyMs: number | null,
    checkedAt: Date,
    isFirstPoll: boolean
  ): void {
    const previouslyOnline = this.props.isOnline;

    const newConsecutiveFailures = isReachable
      ? 0
      : this.props.consecutiveFailures + 1;

    const newIsOnline = isReachable;

    this.props.isOnline = newIsOnline;
    this.props.lastLatencyMs = latencyMs;
    this.props.consecutiveFailures = newConsecutiveFailures;
    this.props.lastCheckedAt = checkedAt;
    this.props.updatedAt = checkedAt;
    if (isReachable) this.props.lastSeen = checkedAt;

    if (!isFirstPoll) {
      if (!previouslyOnline && newIsOnline) {
        this.addDomainEvent(
          new DeviceCameOnlineEvent({
            aggregateId: this.id,
            latencyMs,
            dateTimeOccurred: checkedAt
          })
        );
      } else if (previouslyOnline && !newIsOnline) {
        this.addDomainEvent(
          new DeviceWentOfflineEvent({
            aggregateId: this.id,
            consecutiveFailures: newConsecutiveFailures,
            dateTimeOccurred: checkedAt
          })
        );
      }
    }
  }
}
