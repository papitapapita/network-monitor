import { AggregateRoot } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceStateProps } from '../props';
import { ReachabilityStatus } from '../value-objects';
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
  get status(): ReachabilityStatus {
    return this.props.status;
  }
  // derived: callers that only care whether the device is answering right now
  // should not have to reason about the third value
  get isOnline(): boolean {
    return this.props.status.isUp();
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

  // UNKNOWN, not DOWN: nothing has been observed yet, and applyPingResult reads
  // that to know the first result is not a transition
  public static createInitial(deviceId: DeviceId): DeviceState {
    return new DeviceState(
      {
        deviceId,
        status: ReachabilityStatus.createUnknown(),
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

  // The probe could not be run at all: record that an attempt happened without
  // touching status, lastSeen or failure counts. Deliberately NOT a move to
  // UNKNOWN — a local fault says nothing about the device, and demoting a
  // known-DOWN device here would suppress the outage it is already in.
  // Advancing lastCheckedAt keeps the device on its normal schedule — leaving
  // it stale would make the scheduler re-queue the device on every tick.
  public applyPollFailure(checkedAt: Date): void {
    this.props.lastCheckedAt = checkedAt;
    this.props.updatedAt = checkedAt;
  }

  // Monitoring was turned off, so nobody is watching this device any more and
  // its last reading must not be presented as current. lastSeen and the last
  // latency survive: they are facts about the past, still true. Nulling
  // lastCheckedAt makes the device due immediately if monitoring returns.
  public markUnknown(at: Date): void {
    this.props.status = ReachabilityStatus.createUnknown();
    this.props.consecutiveFailures = 0;
    this.props.lastCheckedAt = null;
    this.props.updatedAt = at;
  }

  // caller retries before calling this — isReachable is the definitive post-retry result
  public applyPingResult(
    isReachable: boolean,
    latencyMs: number | null,
    checkedAt: Date
  ): void {
    const wasUnknown = this.props.status.isUnknown();
    const wasUp = this.props.status.isUp();

    const newConsecutiveFailures = isReachable
      ? 0
      : this.props.consecutiveFailures + 1;

    this.props.status = isReachable
      ? ReachabilityStatus.createUp()
      : ReachabilityStatus.createDown();
    this.props.lastLatencyMs = latencyMs;
    this.props.consecutiveFailures = newConsecutiveFailures;
    this.props.lastCheckedAt = checkedAt;
    this.props.updatedAt = checkedAt;
    if (isReachable) this.props.lastSeen = checkedAt;

    // From UNKNOWN the previous reachability was never observed, so a successful
    // ping is not a recovery and must not raise CameOnline. A failed one is
    // still a genuine outage — a device that is dead the first time it is seen
    // has to alert, or it would stay silent until its first recovery.
    const cameOnline = wasUnknown ? false : !wasUp && isReachable;
    const wentOffline = wasUnknown
      ? !isReachable
      : wasUp && !isReachable;

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
