import { Device } from '../aggregates';
import {
  EligibilityDecision,
  IDeviceEligibilityService,
  IneligibilityReason
} from './IDeviceEligibilityService';

export type { EligibilityDecision, IneligibilityReason };

const ELIGIBLE: EligibilityDecision = { eligible: true };

// Answers "may we act on this device right now?" from the device itself, at
// the moment of use. Every other stop-polling path in the system works by
// flipping a flag from an event handler; dispatch is fire-and-forget, so a
// flag that never got flipped is a cached answer nothing invalidates. Reading
// the aggregate cannot go stale the same way.
export class DeviceEligibilityService
  implements IDeviceEligibilityService
{
  public canPoll(device: Device): EligibilityDecision {
    const live = this.checkLive(device);
    if (!live.eligible) {
      return live;
    }

    // COMMISSIONING polls on purpose (DEV-058/DEV-059) — a device is monitored
    // while it is being installed, not only once someone marks it ACTIVE.
    if (
      !device.status.isActive() &&
      !device.status.isCommissioning()
    ) {
      return this.deny(
        'DEVICE_RETIRED',
        `Device is ${device.status.value} and is not polled`
      );
    }

    if (!device.monitoringEnabled) {
      return this.deny(
        'MONITORING_DISABLED',
        'Device has monitoring disabled'
      );
    }

    return ELIGIBLE;
  }

  // Deliberately does not consult monitoringEnabled: that flag is exactly the
  // stale-cache problem this service exists to route around, and an alert
  // already in flight when monitoring was switched off is still true.
  public canAlert(device: Device): EligibilityDecision {
    const live = this.checkLive(device);
    if (!live.eligible) {
      return live;
    }

    if (device.status.isRetired()) {
      return this.deny(
        'DEVICE_RETIRED',
        `Device is ${device.status.value} and is not alerted on`
      );
    }

    return ELIGIBLE;
  }

  public canPollWireless(device: Device): EligibilityDecision {
    const pollable = this.canPoll(device);
    if (!pollable.eligible) {
      return pollable;
    }

    if (!device.canHaveWirelessConfig()) {
      return this.deny(
        'NOT_WIRELESS_CAPABLE',
        'Only WIRELESS_CPE and ACCESS_POINT devices can be polled for wireless metrics'
      );
    }

    return ELIGIBLE;
  }

  // isReplaced() reads replacedByDeviceId, which markReplaced() does not write
  // — the repository does, and only on reads that request the lineage include.
  // So this can false-negative. It is checked anyway because it names the real
  // reason when it is available; markReplaced() also forces a retired status,
  // so the status check behind it catches the same device regardless.
  private checkLive(device: Device): EligibilityDecision {
    if (device.isDeleted()) {
      return this.deny('DEVICE_DELETED', 'Device has been deleted');
    }

    if (device.isReplaced()) {
      return this.deny(
        'DEVICE_REPLACED',
        'Device has been replaced by newer hardware'
      );
    }

    return ELIGIBLE;
  }

  private deny(
    reason: IneligibilityReason,
    message: string
  ): EligibilityDecision {
    return { eligible: false, reason, message };
  }
}
