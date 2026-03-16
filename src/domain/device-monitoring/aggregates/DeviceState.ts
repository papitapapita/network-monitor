import { AggregateRoot } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { FailureThreshold } from '../value-objects';
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

  /**
   * Called when no previous state row exists (device's first-ever poll).
   * No events are raised — unknown→online is not a recoverable transition.
   */
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

  /** Used by repository only. Bypasses all validation. */
  public static reconstitute(
    props: DeviceStateProps,
    deviceId: DeviceId
  ): DeviceState {
    return new DeviceState(props, deviceId);
  }

  /**
   * Applies the result of a ping. Raises events only on genuine transitions
   * and never on the first poll.
   *
   * @param isFirstPoll  True when createInitial() was used (no prior DB row).
   */
  public applyPingResult(
    isReachable: boolean,
    latencyMs: number | null,
    failureThreshold: FailureThreshold,
    checkedAt: Date,
    isFirstPoll: boolean
  ): void {
    const previouslyOnline = this.props.isOnline;

    const newConsecutiveFailures = isReachable
      ? 0
      : this.props.consecutiveFailures + 1;

    const newIsOnline = isReachable
      ? true
      : newConsecutiveFailures < failureThreshold.value
        ? previouslyOnline
        : false;

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
