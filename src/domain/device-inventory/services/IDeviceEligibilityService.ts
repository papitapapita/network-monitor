import { Device } from '../aggregates';

export type IneligibilityReason =
  | 'DEVICE_DELETED'
  | 'DEVICE_REPLACED'
  | 'DEVICE_RETIRED'
  | 'MONITORING_DISABLED'
  | 'NOT_WIRELESS_CAPABLE';

export type EligibilityDecision =
  | { eligible: true }
  | {
      eligible: false;
      reason: IneligibilityReason;
      message: string;
    };

export interface IDeviceEligibilityService {
  canPoll(device: Device): EligibilityDecision;
  canAlert(device: Device): EligibilityDecision;
  canPollWireless(device: Device): EligibilityDecision;
}
