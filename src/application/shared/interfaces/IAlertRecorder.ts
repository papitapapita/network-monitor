import { Result } from 'domain/shared/core';
import { AlertSeverity } from 'domain/shared/enums';

export interface AlertRecordInput {
  deviceId: string;
  severity: AlertSeverity;
  source: string;
  type: string;
  description: string;
  details: Record<string, unknown>;
  // Set by a producer that opens its own ticket on a different schedule
  // (device-down defers ticketing to the moment it actually notifies, so a
  // blip that self-resolves never opens one — see NOT-097). Omitted/false
  // keeps today's behaviour: open immediately alongside the alert.
  skipTicket?: boolean;
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
