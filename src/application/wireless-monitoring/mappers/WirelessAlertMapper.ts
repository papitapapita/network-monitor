import { WirelessAlertRecord } from 'domain/wireless-monitoring';
import { WirelessAlertResponseDTO } from '../dtos/WirelessAlertResponseDTO';

export class WirelessAlertMapper {
  public static toDTO(
    record: WirelessAlertRecord
  ): WirelessAlertResponseDTO {
    return {
      id: record.id.toString(),
      deviceId: record.deviceId.toString(),
      metric: record.metric,
      severity: record.severity,
      threshold: record.threshold,
      lastValue: record.lastValue,
      message: record.message,
      triggeredAt: record.triggeredAt.toISOString(),
      clearedAt: record.clearedAt?.toISOString() ?? null,
      isActive: record.isActive
    };
  }
}
