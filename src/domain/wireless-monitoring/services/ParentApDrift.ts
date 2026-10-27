import { DeviceId } from 'domain/shared/ids';
import { WirelessDeviceConfig } from '../aggregates';
import { AlertDecision } from './IWirelessAlertEvaluator';

export const PARENT_AP_MISMATCH_METRIC = 'parent_ap_mismatch';

// A CPE that briefly roams, or flaps while misaligned, should not page anyone.
export const PARENT_AP_MISMATCH_POLLS = 3;

export interface ParentApNames {
  declared: string;
  reported: string;
}

// Kept out of IWirelessAlertEvaluator: it compares against the declared
// topology, not against metric thresholds.
// `declared` is the device's upstream in Device Inventory (DEV-180).
export function evaluateParentApDrift(
  config: WirelessDeviceConfig,
  declared: DeviceId | null,
  alertActive: boolean,
  deviceName: string,
  apNames: ParentApNames | null
): AlertDecision | null {
  const mismatchPersists =
    declared !== null &&
    config.parentApMismatchPolls >= PARENT_AP_MISMATCH_POLLS;

  if (!alertActive && mismatchPersists && apNames) {
    return {
      metric: PARENT_AP_MISMATCH_METRIC,
      action: 'OPEN',
      severity: 'WARNING',
      currentValue: config.parentApMismatchPolls,
      threshold: PARENT_AP_MISMATCH_POLLS,
      message: `${deviceName} está conectado a ${apNames.reported}, pero su AP declarado es ${apNames.declared}`
    };
  }

  const resolved =
    declared === null || config.parentApMismatchPolls === 0;
  if (alertActive && resolved) {
    return {
      metric: PARENT_AP_MISMATCH_METRIC,
      action: 'CLEAR',
      severity: 'WARNING',
      currentValue: 0,
      threshold: PARENT_AP_MISMATCH_POLLS,
      message: `${deviceName} ya no difiere de su AP declarado`
    };
  }

  return null;
}
