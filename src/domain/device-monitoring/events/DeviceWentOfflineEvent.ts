import { DomainEvent } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

interface DeviceWentOfflineEventProps {
  readonly aggregateId: DeviceId;
  readonly consecutiveFailures: number;
  readonly dateTimeOccurred: Date;
}

// Record-only signal, unlike the old DeviceWentOfflineEvent this replaces
// pre-2026-09-02 — it feeds the alert record (NOT-097) so an outage is
// visible immediately, never the outbound notification, which still waits
// for RaiseOverdueDeviceDownAlertsUseCase to cross the effective delay.
export class DeviceWentOfflineEvent extends DomainEvent<DeviceWentOfflineEventProps> {
  get aggregateId(): DeviceId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get consecutiveFailures(): number {
    return this.props.consecutiveFailures;
  }
}
