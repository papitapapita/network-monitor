import { WirelessSnapshot } from 'domain/wireless-monitoring/aggregates';
import { WirelessDeviceConfig } from 'domain/wireless-monitoring/aggregates';
import { WirelessThroughputDTO } from '../dtos';

// two intervals of silence: one missed cycle is a transient, two is a problem
const STALE_INTERVALS = 2;

export class WirelessThroughputMapper {
  public static toDTO(
    snapshot: WirelessSnapshot,
    config: WirelessDeviceConfig | null,
    now: Date
  ): WirelessThroughputDTO {
    const m = snapshot.metrics;
    const linkCapacityKbps = config?.linkCapacityKbps ?? null;

    const ageSeconds = Math.max(
      0,
      Math.round(
        (now.getTime() - snapshot.collectedAt.getTime()) / 1000
      )
    );

    const throughputTotalBps =
      m.throughputTxBps !== null && m.throughputRxBps !== null
        ? m.throughputTxBps + m.throughputRxBps
        : null;

    return {
      deviceId: snapshot.deviceId.toString(),
      deviceType: snapshot.deviceType,
      collectedAt: snapshot.collectedAt.toISOString(),
      ageSeconds,
      // no configuration means nothing is scheduled to refresh this reading
      stale:
        config === null
          ? true
          : ageSeconds >
            config.pollingInterval.seconds * STALE_INTERVALS,
      throughputTxBps: m.throughputTxBps,
      throughputRxBps: m.throughputRxBps,
      throughputTotalBps,
      linkCapacityKbps,
      utilisationPercent: this.utilisation(m, linkCapacityKbps)
    };
  }

  private static utilisation(
    metrics: WirelessSnapshot['metrics'],
    linkCapacityKbps: number | null
  ): number | null {
    if (linkCapacityKbps === null) return null;

    const percent = metrics.getLinkUtilizationPercent(
      linkCapacityKbps * 1000
    );
    return percent === null ? null : Math.round(percent * 100) / 100;
  }
}
