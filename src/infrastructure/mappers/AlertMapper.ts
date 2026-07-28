import { AlertId, DeviceId } from 'domain/shared/ids';
import { Alert } from 'domain/notifications/aggregates';
import { AlertSeverity } from 'domain/shared/enums';

type PrismaAlertRecord = {
  id: string;
  deviceId: string;
  severity: string;
  source: string;
  type: string;
  description: string;
  details?: unknown;
  startedAt: Date;
  resolvedAt: Date | null;
  notifiedAt: Date | null;
  recoveryNotifiedAt: Date | null;
};

export class AlertMapper {
  public static toDomain(raw: PrismaAlertRecord): Alert {
    const alertIdResult = AlertId.parse(raw.id);
    if (alertIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid alertId "${raw.id}" in alert_events`
      );
    }

    const deviceIdResult = DeviceId.parse(raw.deviceId);
    if (deviceIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid deviceId "${raw.deviceId}" in alert_events`
      );
    }

    return Alert.reconstitute(alertIdResult.value, {
      deviceId: deviceIdResult.value,
      severity: AlertMapper.mapSeverity(raw.severity),
      source: raw.source,
      type: raw.type,
      description: raw.description,
      details: (raw.details as Record<string, unknown>) ?? {},
      startedAt: raw.startedAt,
      resolvedAt: raw.resolvedAt,
      notifiedAt: raw.notifiedAt,
      recoveryNotifiedAt: raw.recoveryNotifiedAt
    });
  }

  public static toPersistence(alert: Alert) {
    return {
      id: alert.id.toString(),
      deviceId: alert.deviceId.toString(),
      severity: alert.severity as string,
      source: alert.source,
      type: alert.type,
      description: alert.description,
      details: alert.details,
      startedAt: alert.startedAt,
      resolvedAt: alert.resolvedAt,
      notifiedAt: alert.notifiedAt,
      recoveryNotifiedAt: alert.recoveryNotifiedAt
    };
  }

  private static mapSeverity(raw: string): AlertSeverity {
    switch (raw) {
      case 'WARNING':
        return AlertSeverity.WARNING;
      case 'CRITICAL':
        return AlertSeverity.CRITICAL;
      default:
        throw new Error(
          `Data integrity violation: unknown AlertSeverity "${raw}"`
        );
    }
  }
}
