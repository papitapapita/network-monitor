import { Alert } from 'domain/notifications/aggregates';
import { AlertResponseDTO, AlertListResponseDTO } from '../dtos';

export class AlertMapper {
  static toDTO(alert: Alert): AlertResponseDTO {
    return {
      id: alert.alertId.toString(),
      deviceId: alert.deviceId.toString(),
      severity: alert.severity,
      status: alert.isOpen ? 'OPEN' : 'RESOLVED',
      startedAt: alert.startedAt.toISOString(),
      resolvedAt: alert.resolvedAt
        ? alert.resolvedAt.toISOString()
        : null,
      notifiedAt: alert.notifiedAt
        ? alert.notifiedAt.toISOString()
        : null,
      recoveryNotifiedAt: alert.recoveryNotifiedAt
        ? alert.recoveryNotifiedAt.toISOString()
        : null,
      durationSecs: alert.durationSecs
    };
  }

  static toListDTO(
    alerts: Alert[],
    total: number,
    limit: number,
    offset: number
  ): AlertListResponseDTO {
    return {
      alerts: alerts.map((a) => AlertMapper.toDTO(a)),
      total,
      hasMore: offset + alerts.length < total,
      limit,
      offset
    };
  }
}
