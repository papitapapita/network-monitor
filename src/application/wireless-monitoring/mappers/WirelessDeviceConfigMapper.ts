import { WirelessDeviceConfig } from 'domain/wireless-monitoring/aggregates';
import {
  CreateWirelessConfigRequestDTO,
  UpdateWirelessConfigRequestDTO,
  WirelessConfigResponseDTO
} from '../dtos';

export class WirelessDeviceConfigMapper {
  public static toDTO(
    config: WirelessDeviceConfig
  ): WirelessConfigResponseDTO {
    return {
      id: config.id.toString(),
      deviceId: config.deviceId.toString(),
      ipAddress: config.ipAddress?.value ?? null,
      enabled: config.enabled,
      intervalSecs: config.pollingInterval.seconds,
      deviceType: config.deviceType,
      linkCapacityKbps: config.linkCapacityKbps,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      provisionedLanSpeedMbps: config.provisionedLanSpeedMbps,
      parentApDeviceId: config.parentApDeviceId?.toString() ?? null,
      lastPolledAt: config.lastPolledAt?.toISOString() ?? null
    };
  }

  public static extractCreateData(
    dto: CreateWirelessConfigRequestDTO
  ) {
    return {
      deviceId: dto.deviceId,
      ipAddress: dto.ipAddress ?? null,
      intervalSecs: dto.intervalSecs ?? null,
      enabled: dto.enabled ?? null,
      linkCapacityKbps: dto.linkCapacityKbps ?? null,
      clientsProvisionedLimit: dto.clientsProvisionedLimit ?? null,
      provisionedLanSpeedMbps: dto.provisionedLanSpeedMbps ?? null,
      parentApDeviceId: dto.parentApDeviceId ?? null
    };
  }

  public static extractUpdateData(
    dto: UpdateWirelessConfigRequestDTO
  ): {
    ipAddress?: string | null;
    intervalSecs?: number;
    enabled?: boolean;
    linkCapacityKbps?: number | null;
    clientsProvisionedLimit?: number | null;
    provisionedLanSpeedMbps?: number | null;
    parentApDeviceId?: string | null;
  } {
    const updates: {
      ipAddress?: string | null;
      intervalSecs?: number;
      enabled?: boolean;
      linkCapacityKbps?: number | null;
      clientsProvisionedLimit?: number | null;
      provisionedLanSpeedMbps?: number | null;
      parentApDeviceId?: string | null;
    } = {};

    if (dto.ipAddress !== undefined)
      updates.ipAddress = dto.ipAddress;
    if (dto.intervalSecs !== undefined)
      updates.intervalSecs = dto.intervalSecs;
    if (dto.enabled !== undefined) updates.enabled = dto.enabled;
    if (dto.linkCapacityKbps !== undefined)
      updates.linkCapacityKbps = dto.linkCapacityKbps;
    if (dto.clientsProvisionedLimit !== undefined)
      updates.clientsProvisionedLimit = dto.clientsProvisionedLimit;
    if (dto.provisionedLanSpeedMbps !== undefined)
      updates.provisionedLanSpeedMbps = dto.provisionedLanSpeedMbps;
    if (dto.parentApDeviceId !== undefined)
      updates.parentApDeviceId = dto.parentApDeviceId;

    return updates;
  }
}
