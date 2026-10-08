import {
  AlertThresholds,
  AlertThresholdOverrides,
  AlertThresholdsProps,
  AlertThresholdOverridesProps,
  ChannelWidthThresholds
} from 'domain/wireless-monitoring';
import {
  AlertThresholdsDTO,
  AlertThresholdOverridesDTO
} from '../dtos';

function widthTableToDTO(
  table: ChannelWidthThresholds
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(table).sort(([a], [b]) => Number(a) - Number(b))
  );
}

export class AlertThresholdsMapper {
  static toDTO(thresholds: AlertThresholds): AlertThresholdsDTO {
    return {
      signalDbm: { ...thresholds.signalDbm },
      snrDb: { ...thresholds.snrDb },
      ccqPercent: { ...thresholds.ccqPercent },
      latencyMs: { ...thresholds.latencyMs },
      cpuPercent: thresholds.cpuPercent,
      memoryPercent: thresholds.memoryPercent,
      clockDriftSeconds: thresholds.clockDriftSeconds,
      saturationPercent: thresholds.saturationPercent,
      clientDropPercent: thresholds.clientDropPercent,
      minCapacityMbps: widthTableToDTO(thresholds.minCapacityMbps),
      maxDistanceKm: widthTableToDTO(thresholds.maxDistanceKm)
    };
  }

  static overridesToDTO(
    overrides: AlertThresholdOverrides
  ): AlertThresholdOverridesDTO {
    const { minCapacityMbps, maxDistanceKm, ...rest } =
      overrides.values;
    return {
      ...rest,
      ...(minCapacityMbps && {
        minCapacityMbps: widthTableToDTO(minCapacityMbps)
      }),
      ...(maxDistanceKm && {
        maxDistanceKm: widthTableToDTO(maxDistanceKm)
      })
    };
  }

  // Width keys arrive as JSON strings; the domain indexes by number, which
  // JavaScript object keys already coerce, so the shape carries over as is.
  static toProps(dto: AlertThresholdsDTO): AlertThresholdsProps {
    return dto as AlertThresholdsProps;
  }

  static toOverridesProps(
    dto: AlertThresholdOverridesDTO
  ): AlertThresholdOverridesProps {
    return dto as AlertThresholdOverridesProps;
  }
}
