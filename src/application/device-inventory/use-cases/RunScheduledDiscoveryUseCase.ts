import { Result } from 'domain/shared/core';
import { DiscoverySource } from 'domain/device-inventory/enums';
import { IDiscoverySettingsRepository } from 'domain/device-inventory/repository';
import {
  RunScheduledDiscoveryResultDTO,
  ScheduledRouterOutcomeDTO,
  ScheduledSegmentOutcomeDTO
} from '../dtos';
import {
  IRouterNeighborQuery,
  ISegmentScanner,
  RouterNeighborsRow
} from '../interfaces';
import { DeviceSightingRecorder } from '../services';
import { SCAN_NEEDS_SERVER_ON_SITE } from './ScanNetworkSegmentUseCase';

const HOUR_MS = 3_600_000;

// DEV-211: once the interval has passed since the last run, sweep every
// segment, one after the other, and record what each one shows; then what
// each MikroTik hears around it (DEV-217).
export class RunScheduledDiscoveryUseCase {
  constructor(
    private readonly settings: IDiscoverySettingsRepository,
    private readonly scanner: ISegmentScanner,
    private readonly sightings: DeviceSightingRecorder,
    private readonly serverOnSite = true,
    private readonly routerNeighbors: IRouterNeighborQuery | null = null
  ) {}

  async execute(request: {
    now: Date;
  }): Promise<Result<RunScheduledDiscoveryResultDTO>> {
    const notRun = Result.ok({
      ran: false,
      segments: [],
      routers: []
    });

    const settings = await this.settings.get();
    if (settings.isFailure) return Result.fail(settings.error);
    const { enabled, intervalHours, segments } = settings.value;
    if (!enabled) return notRun;
    if (segments.length === 0 && this.routerNeighbors === null) {
      return notRun;
    }

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
    const routers = await this.runRouters(request.now);
    if (routers.isFailure) return Result.fail(routers.error);
    return Result.ok({
      ran: true,
      segments: outcomes,
      routers: routers.value
    });
  }

  // DEV-217: the routers are read all at once; one that cannot be read, or
  // whose neighbours cannot be recorded, does not stop the others.
  private async runRouters(
    seenAt: Date
  ): Promise<Result<ScheduledRouterOutcomeDTO[]>> {
    if (this.routerNeighbors === null) return Result.ok([]);
    const read = await this.routerNeighbors.findRouterNeighbors();
    if (read.isFailure) {
      return Result.fail(
        `Failed to read the routers' neighbours: ${read.error}`
      );
    }
    const outcomes: ScheduledRouterOutcomeDTO[] = [];
    for (const router of read.value.routers) {
      outcomes.push(await this.recordRouter(router, seenAt));
    }
    for (const unread of read.value.unreadRouters) {
      outcomes.push({
        deviceId: unread.deviceId,
        name: unread.name,
        neighborCount: null,
        newCount: null,
        error: unread.reason
      });
    }
    return Result.ok(outcomes);
  }

  private async recordRouter(
    router: RouterNeighborsRow,
    seenAt: Date
  ): Promise<ScheduledRouterOutcomeDTO> {
    const recorded = await this.sightings.record({
      source: DiscoverySource.ROUTER_NEIGHBOR,
      segment: null,
      where: router.routerName,
      seenAt,
      hosts: router.neighbors.map((n) => ({
        macAddress: n.macAddress,
        ipAddress: n.ipAddress,
        manufacturer: null,
        hostname: n.identity,
        // a MikroTik names its board; an AirOS radio its model as platform
        model: n.board ?? n.platform
      }))
    });
    const which = {
      deviceId: router.routerDeviceId,
      name: router.routerName
    };
    if (recorded.isFailure) {
      return {
        ...which,
        neighborCount: null,
        newCount: null,
        error: recorded.error
      };
    }
    return {
      ...which,
      neighborCount: router.neighbors.length,
      newCount: recorded.value.filter((o) => o.isNew).length,
      error: null
    };
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
