import { Result } from 'domain/shared/core';
import { AlertSeverity } from 'domain/shared/enums';

export interface AlertRecordInput {
  deviceId: string;
  severity: AlertSeverity;
  source: string;
  type: string;
  description: string;
  details: Record<string, unknown>;
}

/**
 * Outbound port for persisting an operational alert into the shared alert
 * store. Distinct from IAlertPublisher (which delivers notifications): a
 * producer records the alert here so it appears in the unified alert list.
 */
export interface IAlertRecorder {
  open(input: AlertRecordInput): Promise<Result<void>>;
  resolve(
    deviceId: string,
    type: string,
    resolvedAt: Date
  ): Promise<Result<void>>;
}
