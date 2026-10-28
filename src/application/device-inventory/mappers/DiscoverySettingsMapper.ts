import { DiscoverySettings } from 'domain/device-inventory/value-objects';
import { DiscoverySettingsDTO } from '../dtos';

export class DiscoverySettingsMapper {
  static toDTO(
    settings: DiscoverySettings,
    lastRunAt: Date | null
  ): DiscoverySettingsDTO {
    return {
      enabled: settings.enabled,
      intervalHours: settings.intervalHours,
      segments: settings.segments,
      lastRunAt: lastRunAt?.toISOString() ?? null
    };
  }
}
