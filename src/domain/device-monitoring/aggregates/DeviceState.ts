import { AggregateRoot } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
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

  // isOnline: false represents "not yet observed", not a confirmed outage —
  // applyPingResult relies on isFirstPoll to tell the two apart
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

  // The probe could not be run at all, so reachability is unknown: record that
  // an attempt happened without touching status, lastSeen or failure counts.
  // Advancing lastCheckedAt keeps the device on its normal schedule — leaving
  // it stale would make the scheduler re-queue the device on every tick.
  public applyPollFailure(checkedAt: Date): void {
    this.props.lastCheckedAt = checkedAt;
    this.props.updatedAt = checkedAt;
  }

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

    // On the first poll the previous state is unknown rather than offline, so a
    // successful ping is not a recovery and must not raise CameOnline. A failed
    // one is still a genuine outage — a device that is dead when first seen has
    // to alert, or it would stay silent until its first recovery.
    const cameOnline = isFirstPoll
      ? false
      : !previouslyOnline && newIsOnline;
    const wentOffline = isFirstPoll
      ? !newIsOnline
      : previouslyOnline && !newIsOnline;

    if (cameOnline) {
      this.addDomainEvent(
        new DeviceCameOnlineEvent({
          aggregateId: this.id,
          latencyMs,
          dateTimeOccurred: checkedAt
        })
      );
    } else if (wentOffline) {
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
