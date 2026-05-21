import { WirelessPollingConfig } from 'domain/wireless-monitoring/aggregates';
import { WirelessConfigResponseDTO } from '../dtos';
import { CreateWirelessConfigRequestDTO } from '../use-cases/CreateWirelessConfigUseCase';
import { UpdateWirelessConfigRequestDTO } from '../use-cases/UpdateWirelessConfigUseCase';

export class WirelessPollingConfigMapper {
  public static toDTO(
    config: WirelessPollingConfig
  ): WirelessConfigResponseDTO {
    return {
      id: config.id.toString(),
      deviceId: config.deviceId.toString(),
      ipAddress: config.ipAddress?.value ?? null,
      enabled: config.enabled,
      intervalSecs: config.intervalSecs,
      deviceType: config.deviceType,
      linkCapacityBps: config.linkCapacityBps,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      lastPolledAt: config.lastPolledAt?.toISOString() ?? null
    };
  }

  public static extractCreateData(dto: CreateWirelessConfigRequestDTO) {
    return {
      deviceId: dto.deviceId,
      deviceType: dto.deviceType,
      ipAddress: dto.ipAddress ?? null,
      intervalSecs: dto.intervalSecs ?? null,
      enabled: dto.enabled ?? null,
      linkCapacityBps: dto.linkCapacityBps ?? null,
      clientsProvisionedLimit: dto.clientsProvisionedLimit ?? null
    };
  }

  public static extractUpdateData(dto: UpdateWirelessConfigRequestDTO) {
    const updates: Record<string, unknown> = {};

    if (dto.ipAddress !== undefined) updates.ipAddress = dto.ipAddress;
    if (dto.intervalSecs !== undefined)
      updates.intervalSecs = dto.intervalSecs;
    if (dto.enabled !== undefined) updates.enabled = dto.enabled;
    if (dto.linkCapacityBps !== undefined)
      updates.linkCapacityBps = dto.linkCapacityBps;
    if (dto.clientsProvisionedLimit !== undefined)
      updates.clientsProvisionedLimit = dto.clientsProvisionedLimit;

    return updates;
  }
}
