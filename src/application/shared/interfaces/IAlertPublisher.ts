import { Result } from 'domain/shared/core';
import { AlertSeverity } from 'domain/shared/enums';

export interface AlertNotification {
  deviceId: string;
  severity: AlertSeverity;
  source: string;
  subject: string;
  detail: string;
  occurredAt: Date;
  resolved: boolean;
  // The producer's own alert-type vocabulary (`device_unreachable`,
  // `wireless:<metric>:<severity>` — matches Alert.type). A plain string, not
  // an import of any producer's domain, kept to the same bar ADR-0001 sets
  // for this envelope: used by 2+ contexts, imports nothing context-specific.
  // Lets a publisher decorator key a decision (mute, in particular) off which
  // condition this is without parsing `subject`/`detail`.
  type: string;
}

export interface IAlertPublisher {
  publish(notification: AlertNotification): Promise<Result<void>>;
}

// Returned by a quiet-hours-aware publisher instead of forwarding the
// notification. Callers check for this exact string so a suppressed publish
// is not logged or treated the same as a real delivery failure — see
// QuietHoursAlertPublisher.
export const QUIET_HOURS_SUPPRESSED =
  'Notification suppressed: device is in quiet hours';

// Same idea, for a type the operator has muted globally — see
// MutedTypeAlertPublisher.
export const TYPE_MUTED_SUPPRESSED =
  'Notification suppressed: alert type is muted';
