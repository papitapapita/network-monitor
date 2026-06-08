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
      linkCapacityBps: config.linkCapacityBps,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      lastPolledAt: config.lastPolledAt?.toISOString() ?? null,
      targetFirmwareVersion: config.targetFirmwareVersion,
      maxLinkDistanceM: config.maxLinkDistanceM
    };
  }

  public static extractCreateData(
    dto: CreateWirelessConfigRequestDTO
  ) {
    return {
      deviceId: dto.deviceId,
      deviceType: dto.deviceType,
      ipAddress: dto.ipAddress ?? null,
      intervalSecs: dto.intervalSecs ?? null,
      enabled: dto.enabled ?? null,
      linkCapacityBps: dto.linkCapacityBps ?? null,
      clientsProvisionedLimit: dto.clientsProvisionedLimit ?? null,
      targetFirmwareVersion: dto.targetFirmwareVersion ?? null,
      maxLinkDistanceM: dto.maxLinkDistanceM ?? null
    };
  }

  public static extractUpdateData(dto: UpdateWirelessConfigRequestDTO): {
    ipAddress?: string | null;
    intervalSecs?: number;
    enabled?: boolean;
    linkCapacityBps?: number | null;
    clientsProvisionedLimit?: number | null;
    targetFirmwareVersion?: string | null;
    maxLinkDistanceM?: number | null;
  } {
    const updates: {
      ipAddress?: string | null;
      intervalSecs?: number;
      enabled?: boolean;
      linkCapacityBps?: number | null;
      clientsProvisionedLimit?: number | null;
      targetFirmwareVersion?: string | null;
      maxLinkDistanceM?: number | null;
    } = {};

    if (dto.ipAddress !== undefined) updates.ipAddress = dto.ipAddress;
    if (dto.intervalSecs !== undefined)
      updates.intervalSecs = dto.intervalSecs;
    if (dto.enabled !== undefined) updates.enabled = dto.enabled;
    if (dto.linkCapacityBps !== undefined)
      updates.linkCapacityBps = dto.linkCapacityBps;
    if (dto.clientsProvisionedLimit !== undefined)
      updates.clientsProvisionedLimit = dto.clientsProvisionedLimit;
    if (dto.targetFirmwareVersion !== undefined)
      updates.targetFirmwareVersion = dto.targetFirmwareVersion;
    if (dto.maxLinkDistanceM !== undefined)
      updates.maxLinkDistanceM = dto.maxLinkDistanceM;

    return updates;
  }
}
