import { Result } from 'domain/shared/core';
import { DiscoverySource } from 'domain/device-inventory/enums';
import { IDiscoverySettingsRepository } from 'domain/device-inventory/repository';
import {
  RunScheduledDiscoveryResultDTO,
  ScheduledSegmentOutcomeDTO
} from '../dtos';
import { ISegmentScanner } from '../interfaces';
import { DeviceSightingRecorder } from '../services';
import { SCAN_NEEDS_SERVER_ON_SITE } from './ScanNetworkSegmentUseCase';

const HOUR_MS = 3_600_000;

// DEV-211: once the interval has passed since the last run, sweep every
// segment, one after the other, and record what each one shows.
export class RunScheduledDiscoveryUseCase {
  constructor(
    private readonly settings: IDiscoverySettingsRepository,
    private readonly scanner: ISegmentScanner,
    private readonly sightings: DeviceSightingRecorder,
    private readonly serverOnSite = true
  ) {}

  async execute(request: {
    now: Date;
  }): Promise<Result<RunScheduledDiscoveryResultDTO>> {
    const notRun = Result.ok({ ran: false, segments: [] });

    const settings = await this.settings.get();
    if (settings.isFailure) return Result.fail(settings.error);
    const { enabled, intervalHours, segments } = settings.value;
    if (!enabled || segments.length === 0) return notRun;

    const lastRunAt = await this.settings.lastRunAt();
    if (lastRunAt.isFailure) return Result.fail(lastRunAt.error);
    const last = lastRunAt.value;
    if (
      last &&
      request.now.getTime() - last.getTime() < intervalHours * HOUR_MS
    ) {
      return notRun;
    }

    // Stamped before sweeping: a run cut short by a restart waits for the
    // next interval instead of sweeping again at every boot.
    const stamped = await this.settings.recordRun(request.now);
    if (stamped.isFailure) return Result.fail(stamped.error);

    const outcomes: ScheduledSegmentOutcomeDTO[] = [];
    for (const segment of segments) {
      outcomes.push(await this.runSegment(segment, request.now));
    }
    return Result.ok({ ran: true, segments: outcomes });
  }

  private async runSegment(
    segment: { cidr: string; agentId: string | null },
    seenAt: Date
  ): Promise<ScheduledSegmentOutcomeDTO> {
    const failed = (error: string): ScheduledSegmentOutcomeDTO => ({
      ...segment,
      responsiveCount: null,
      newCount: null,
      error
    });

    if (segment.agentId === null && !this.serverOnSite) {
      return failed(SCAN_NEEDS_SERVER_ON_SITE);
    }

    const hosts = await this.scanner.scan(
      segment.cidr,
      segment.agentId
    );
    if (hosts.isFailure) return failed(hosts.error);

    const recorded = await this.sightings.record({
      source: DiscoverySource.SCAN,
      segment: segment.cidr,
      where: segment.cidr,
      seenAt,
      hosts: hosts.value
    });
    if (recorded.isFailure) return failed(recorded.error);

    return {
      ...segment,
      responsiveCount: hosts.value.length,
      newCount: recorded.value.filter((o) => o.isNew).length,
      error: null
    };
  }
}
