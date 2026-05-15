import {
  WirelessAlertRecord,
  WirelessAlertRecordProps
} from 'domain/wireless-monitoring';
import { DeviceId } from 'domain/shared';
import { WirelessAlertRecordId } from 'domain/shared/ids';

type PrismaWirelessAlertRecord = {
  id: string;
  deviceId: string;
  metric: string;
  severity: string;
  threshold: { toNumber(): number };
  triggeredAt: Date;
  clearedAt: Date | null;
  isActive: boolean;
  lastValue: { toNumber(): number };
  message: string;
};

type PersistenceData = {
  id: string;
  deviceId: string;
  metric: string;
  severity: string;
  threshold: number;
  triggeredAt: Date;
  clearedAt: Date | null;
  isActive: boolean;
  lastValue: number;
  message: string;
};

export class WirelessAlertRecordPrismaMapper {
  static toDomain(
    raw: PrismaWirelessAlertRecord
  ): WirelessAlertRecord {
    const deviceId = DeviceId.parse(raw.deviceId);
    if (deviceId.isFailure)
      throw new Error(`Invalid device ID: ${deviceId.error}`);
    const id = WirelessAlertRecordId.parse(raw.id);
    if (id.isFailure)
      throw new Error(`Invalid alert record ID: ${id.error}`);

    const props: WirelessAlertRecordProps = {
      deviceId: deviceId.value,
      metric: raw.metric,
      severity: raw.severity as 'WARNING' | 'CRITICAL',
      threshold: raw.threshold.toNumber(),
      triggeredAt: raw.triggeredAt,
      clearedAt: raw.clearedAt,
      isActive: raw.isActive,
      lastValue: raw.lastValue.toNumber(),
      message: raw.message
    };

    return WirelessAlertRecord.reconstitute(props, id.value);
  }

  static toPersistence(record: WirelessAlertRecord): PersistenceData {
    return {
      id: record.id.toString(),
      deviceId: record.deviceId.toString(),
      metric: record.metric,
      severity: record.severity,
      threshold: record.threshold,
      triggeredAt: record.triggeredAt,
      clearedAt: record.clearedAt,
      isActive: record.isActive,
      lastValue: record.lastValue,
      message: record.message
    };
  }
}
