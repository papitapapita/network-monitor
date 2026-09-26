import { Alert } from 'domain/notifications/aggregates';
import {
  AlertResponseDTO,
  AlertListResponseDTO,
  AlertListItemDTO
} from '../dtos';

export class AlertMapper {
  public static toDTO(alert: Alert): AlertResponseDTO {
    return {
      id: alert.id.toString(),
      deviceId: alert.deviceId.toString(),
      severity: alert.severity,
      source: alert.source,
      type: alert.type,
      description: alert.description,
      details: alert.details,
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

  public static toListDTO(
    alerts: AlertListItemDTO[],
    total: number,
    limit: number,
    offset: number
  ): AlertListResponseDTO {
    return {
      alerts,
      total,
      hasMore: offset + alerts.length < total,
      limit,
      offset
    };
  }
}
